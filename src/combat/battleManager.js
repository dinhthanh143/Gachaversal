// src/combat/battleManager.js
const { UserContainer, Index, Inventory } = require("../db");
const { DUNGEON_AREAS } = require("../dungeon/dungeonData");
const { Skills, checkPreAttackPassives } = require("./skills");
const createBattleEmbed = require("../ui/combatEmbed");
const { processBattleRewards } = require("./combatRewards");
const { updateQuestProgress } = require("../quest/questManager"); // ✅ Imported Quest Manager
const { EmbedBuilder } = require("discord.js");
const {
  isUserBattling,
  setUserBattling,
  removeUserBattling,
} = require("../utils/activeStates");
const { applyStartTurnEffects, applyEndTurnEffects } = require("./effects");

const xpIcon = "<:xp:1454544536390078647>";
const LOADING_GIF =
  "https://res.cloudinary.com/pachi/image/upload/v1767026500/Screenshot_2025-12-29_234113_t9vs0s.png";
const MAX_TURNS = 30;
const STAMINA_COST = 10;

const EMOJIS = {
  green: {
    left: "<:g1:1455167942646824990>",
    mid: "<:g2:1455166531926233108>",
    right: "<:g3:1455167940658728970>",
  },
  blue: {
    left: "<:b1:1455167938704179362>",
    mid: "<:b2:1455167983294087188>",
    right: "<:blue3:1455168960113807381>",
  },
  yellow: {
    left: "<:y1:1455167850267410504>",
    mid: "<:y2:1455166520597413980>",
    right: "<:gr3:1455224186044944528>",
  },
  orange: {
    left: "<:o1:1455167852519751797>",
    mid: "<:o2:1455166538637250581>",
    right: "<:gr3:1455224186044944528>",
  },
  red: {
    left: "<:r1:1455168985107664896>",
    mid: "<:r2:1455169010776801292>",
    right: "<:gr3:1455224186044944528>",
  },
  empty: {
    left: "<:gr1:1455224191136825357>",
    mid: "<:gr2:1455224188624441428>",
    right: "<:gr3:1455224186044944528>",
  },
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function generateProgressBar(current, max, type = "hp") {
  const safeMax = max > 0 ? max : 100;
  const percent = Math.max(0, Math.min(1, current / safeMax));
  const filled = Math.ceil(percent * 10);
  const barParts = [];
  let theme = EMOJIS.green;
  if (type === "energy") {
    theme = EMOJIS.blue;
  } else {
    if (percent <= 0.3) theme = EMOJIS.red;
    else if (percent <= 0.5) theme = EMOJIS.orange;
    else if (percent <= 0.7) theme = EMOJIS.yellow;
  }
  barParts.push(filled >= 1 ? theme.left : EMOJIS.empty.left);
  for (let i = 2; i <= 9; i++) {
    barParts.push(filled >= i ? theme.mid : EMOJIS.empty.mid);
  }
  barParts.push(filled === 10 ? theme.right : EMOJIS.empty.right);
  return barParts.join("\u200D");
}

function getSkillValues(masterData, rarity) {
  if (
    !masterData.skill ||
    !masterData.skill.values ||
    masterData.skill.values.length === 0
  ) {
    return [1.0];
  }
  const rarityIndex = Math.max(0, rarity - 1);
  return masterData.skill.values.map((valArray) => {
    if (Array.isArray(valArray)) {
      return valArray[rarityIndex] !== undefined
        ? valArray[rarityIndex]
        : valArray[valArray.length - 1];
    }
    return valArray;
  });
}

function getSkillSafe(skillName) {
  if (Skills[skillName]) return Skills[skillName];
  if (Skills["Basic Attack"]) return Skills["Basic Attack"];
  return {
    name: "Unknown",
    execute: (att, def) => ({
      damage: 0,
      log: `${att.name} tried to attack but tripped!`,
    }),
  };
}

function formatDrops(report) {
  const fields = [];
  let cardValue = "None";
  if (report.drops.length > 0) {
    const dropCounts = {};
    report.drops.forEach((d) => (dropCounts[d] = (dropCounts[d] || 0) + 1));
    cardValue = Object.entries(dropCounts)
      .map(([name, count]) => `x${count} **${name}**`)
      .join("\n");
  }
  fields.push({ name: "🎴 Cards Received", value: cardValue, inline: true });

  let itemValue = "None";
  if (report.itemDrops.length > 0) {
    const itemCounts = {};
    report.itemDrops.forEach((item) => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
    });
    itemValue = Object.entries(itemCounts)
      .map(([name, count]) => `x${count} **${name}**`)
      .join("\n");
  }
  fields.push({ name: "🎒 Items Received", value: itemValue, inline: true });
  return fields;
}

// =========================================
// ⏩ SKIP BATTLE
// =========================================
async function skipBattle(message, inputTimes = 1) {
  const userId = message.author.id;

  if (isUserBattling(userId)) {
    return message.reply(
      "⚠️ You are already in a battle! Finish that one first."
    );
  }
  setUserBattling(userId);

  try {
    const user = await UserContainer.findOne({ userId }).populate({
      path: "selectedCard",
      populate: { path: "masterData" },
    });

    if (!user || !user.selectedCard) {
      return message.reply("❌ You need to `!select` a card first!");
    }

    const areaId = user.dungeon.currentArea;
    const stageId = user.dungeon.currentStage;

    if (areaId === 0) return message.reply("⚠️ Use `!area 1` first!");
    const areaData = DUNGEON_AREAS[areaId];
    if (!areaData || !areaData.stages[stageId])
      return message.reply("❌ Invalid Stage data.");

    if (
      areaId > user.dungeon.maxArea ||
      (areaId === user.dungeon.maxArea && stageId >= user.dungeon.maxStage)
    ) {
      return message.reply(
        "🚫 You must manually clear this stage once before you can skip it!"
      );
    }

    let requestedRuns = 1;

    // 1. Handle "all" input
    if (typeof inputTimes === "string" && inputTimes.toLowerCase() === "all") {
      const maxPossible = Math.floor(user.stam / STAMINA_COST);

      if (maxPossible <= 0) {
        return message.reply(
          `⚠️ Not enough Stamina for even 1 battle! (Need ${STAMINA_COST} ⚡)`
        );
      }
      // No limit cap here anymore, it uses all available stamina
      requestedRuns = maxPossible;
    }
    // 2. Handle specific number input
    else {
      requestedRuns = parseInt(inputTimes);
      if (isNaN(requestedRuns) || requestedRuns < 1) requestedRuns = 1;

      // No MAX_BATCH_LIMIT check here anymore

      const totalStamCost = requestedRuns * STAMINA_COST;

      // STRICT CHECK: Return error if specific amount is requested but not enough stamina
      if (user.stam < totalStamCost) {
        return message.reply(
          `⚠️ You don't have enough **${totalStamCost} ⚡** to do **${requestedRuns}** runs. You only have **${user.stam} ⚡**.`
        );
      }
    }

    const initialLevel = user.selectedCard.level;
    user.stam -= requestedRuns * STAMINA_COST;

    // ✅ QUEST UPDATE (SKIP)
    await updateQuestProgress(
      user,
      "SPEND_STAMINA",
      requestedRuns * STAMINA_COST,
      message
    );
    await updateQuestProgress(user, "BATTLE_COMPLETE", requestedRuns, message);

    const report = await processBattleRewards(
      userId,
      user,
      user.selectedCard,
      areaData.stages[stageId],
      requestedRuns
    );

    const embed = new EmbedBuilder()
      .setTitle(`⏩ Skipped ${requestedRuns} Battles`)
      .setColor("#0099ff")
      .setAuthor({
        name: `${message.author.username}`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(`Farmed **Stage ${areaId}-${stageId}**`)
      .addFields(
        {
          name: "💰 Rewards",
          value: `🪙 +${report.gold}\n${xpIcon} +${report.cardXp} (Card)\n${xpIcon} +${report.accountXp} (User)`,
          inline: true,
        },
        {
          name: "⚡ Stamina",
          value: `Used: **${requestedRuns * STAMINA_COST}**\nRemaining: **${
            user.stam
          }/${user.stamCap}**`,
          inline: true,
        }
      );
    if (report.levelsGained > 0) {
      embed.addFields({
        name: "📈 Card Growth",
        value: `**${user.selectedCard.masterData.name}**\nLv. ${initialLevel} ➔ **Lv. ${user.selectedCard.level}**\nStats increased!`,
        inline: true,
      });
    }
 embed.addFields({
      name: "\u200B",
      value: "\u200B",
      inline: false,
    });
    const dropFields = formatDrops(report);
    embed.addFields(dropFields);

    if (report.accountLevelUp) {
      const capMsg = report.stamCapIncreased ? "and increased cap" : "";
      embed.addFields({
        name: "🎉 Account Level Up!",
        value: `Reached **Lv. ${user.level}**!\n(+${report.lvlUpGold} Gold, +${report.lvlUpTickets} Tickets, Stamina fully refilled ${capMsg}!)`,
        inline: false,
      });
    }

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    message.reply("Error processing skip battle.");
  } finally {
    removeUserBattling(userId);
  }
}

async function sbt(message, inputTimes) {
  return await skipBattle(message, inputTimes);
}

// =========================================
// ⚔️ MAIN BATTLE FUNCTION
// =========================================
async function startBattle(message) {
  const userId = message.author.id;
  if (isUserBattling(userId)) {
    return message.reply(
      "⚠️ You are already in a battle! Finish that one first."
    );
  }
  setUserBattling(userId);
  try {
    const loadingEmbed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("⚔️ Preparing for Battle...")
      .setDescription("Entering the dungeon...")
      .setImage(LOADING_GIF);

    const battleMsg = await message.reply({ embeds: [loadingEmbed] });

    const user = await UserContainer.findOne({ userId }).populate({
      path: "selectedCard",
      populate: { path: "masterData" },
    });

    if (!user || !user.selectedCard) {
      return battleMsg.edit({
        content: "❌ You need to `!select` a card first!",
        embeds: [],
      });
    }
    if (user.stam < STAMINA_COST) {
      return battleMsg.edit({
        content: `⚠️ Not enough Stamina! (Need ${STAMINA_COST} ⚡)`,
        embeds: [],
      });
    }

    const areaId = user.dungeon.currentArea;
    const stageId = user.dungeon.currentStage;

    if (areaId === 0)
      return battleMsg.edit({ content: "⚠️ Use `!area 1` first!", embeds: [] });
    const areaData = DUNGEON_AREAS[areaId];
    if (!areaData || !areaData.stages[stageId])
      return battleMsg.edit({ content: "❌ Invalid Stage data.", embeds: [] });

    // PREPARE FIGHTERS
    const playerCard = user.selectedCard;
    const mobTemplate = areaData.stages[stageId].mobs[0];

    let masterData = playerCard.masterData;
    if (!masterData)
      masterData = await Index.findOne({ pokeId: playerCard.cardId });

    const playerImage = masterData ? masterData.image : "";
    const playerName = masterData ? masterData.name : "Unknown Hero";

    let playerSkill = { name: "Basic Attack", values: [1.0] };
    if (masterData && masterData.skill) {
      const realValues = getSkillValues(masterData, playerCard.rarity);
      playerSkill = { name: masterData.skill.name, values: realValues };
    }
    const playerSkillRef = getSkillSafe(playerSkill.name);
    playerSkill.initialEnergy =
      playerSkillRef.initialEnergy !== undefined
        ? playerSkillRef.initialEnergy
        : 50;
    playerSkill.requiredEnergy = playerSkillRef.requiredEnergy || 100;

    const player = {
      name: playerName,
      level: playerCard.level,
      image: playerImage,
      type: masterData ? masterData.type : "Neutral ✨",
      stats: { ...playerCard.stats, critRate: 5, critDmg: 140 },
      maxHp: playerCard.stats.hp,
      energy: playerSkill.initialEnergy,
      skill: playerSkill,
      effects: [],
      displayBars: "",
    };

    let enemySkill = mobTemplate.skill || {
      name: "Basic Attack",
      values: [1.0],
    };
    const enemySkillRef = getSkillSafe(enemySkill.name);
    enemySkill.initialEnergy =
      enemySkillRef.initialEnergy !== undefined
        ? enemySkillRef.initialEnergy
        : 50;
    enemySkill.requiredEnergy = enemySkillRef.requiredEnergy || 100;

    const enemy = {
      name: mobTemplate.name,
      level: mobTemplate.level,
      image: mobTemplate.image,
      type: mobTemplate.type || "Neutral ✨",
      stats: { ...mobTemplate.stats, critRate: 5, critDmg: 140 },
      maxHp: mobTemplate.stats.hp,
      energy: enemySkill.initialEnergy,
      skill: enemySkill,
      effects: [],
      displayBars: "",
    };

    const battleTitle = `⚔️ Battling Stage ${areaId}-${stageId}`;
    let turn = 1;
    let logs = [];
    let battleOver = false;
    let playerWon = false;

    logs.push(`⚔️ Battle Started!`);

    // Passives
    const activatePassive = (unit, target) => {
      if (unit.skill && unit.skill.name.includes("[PASSIVE]")) {
        const skillLogic = getSkillSafe(unit.skill.name);
        const result = skillLogic.execute(unit, target, unit.skill.values);
        logs.push(result.log);
        if (unit.effects.length > 0) {
          unit.effects.forEach((e) => {
            if (e.name === unit.skill.name || e.name === "Wind's Edge")
              e.turns = 999;
          });
        }
      }
    };
    activatePassive(player, enemy);
    activatePassive(enemy, player);

    const updateBars = () => {
      const pMaxEnergy = player.skill.requiredEnergy || 100;
      const eMaxEnergy = enemy.skill.requiredEnergy || 100;
      player.displayBars = `${generateProgressBar(
        player.stats.hp,
        player.maxHp,
        "hp"
      )}\n${generateProgressBar(player.energy, pMaxEnergy, "energy")}`;
      enemy.displayBars = `${generateProgressBar(
        enemy.stats.hp,
        enemy.maxHp,
        "hp"
      )}\n${generateProgressBar(enemy.energy, eMaxEnergy, "energy")}`;
    };

    await wait(2000);
    updateBars();
    let embedData = await createBattleEmbed(
      player,
      player.type,
      enemy.type,
      playerCard.rarity,
      mobTemplate.rarity,
      enemy,
      logs,
      turn,
      null,
      battleTitle
    );
    const battleBuffer = embedData.buffer;

    await battleMsg.edit({
      content: null,
      embeds: [embedData.embed],
      files: embedData.files,
    });

    while (!battleOver && turn <= MAX_TURNS) {
      const first = player.stats.speed >= enemy.stats.speed ? player : enemy;
      const second = first === player ? enemy : player;

      logs.push(` **${first.name}** has faster speed, it goes first!`);
      embedData = await createBattleEmbed(
        player,
        player.type,
        enemy.type,
        playerCard.rarity,
        mobTemplate.rarity,
        enemy,
        logs,
        turn,
        battleBuffer,
        battleTitle
      );
      await battleMsg.edit({
        embeds: [embedData.embed],
        files: embedData.files,
      });
      await wait(1500);

      const runTurnLifecycle = async (actor, target) => {
        if (target.stats.hp <= 0) return true;

        const startLogs = applyStartTurnEffects(actor);
        if (startLogs.length > 0) {
          logs.push(...startLogs);
          updateBars();
          embedData = await createBattleEmbed(
            player,
            player.type,
            enemy.type,
            playerCard.rarity,
            mobTemplate.rarity,
            enemy,
            logs,
            turn,
            battleBuffer,
            battleTitle
          );
          await battleMsg.edit({
            embeds: [embedData.embed],
            files: embedData.files,
          });
          await wait(1000);
        }

        const isStunned =
          actor.effects && actor.effects.some((e) => e.stat === "stun");
        if (isStunned) {
          logs.push(`🚫 **${actor.name}** is **Stunned** and couldn't act!`);
          updateBars();
          embedData = await createBattleEmbed(
            player,
            player.type,
            enemy.type,
            playerCard.rarity,
            mobTemplate.rarity,
            enemy,
            logs,
            turn,
            battleBuffer,
            battleTitle
          );
          await battleMsg.edit({
            embeds: [embedData.embed],
            files: embedData.files,
          });
          await wait(1500);
        } else {
          const isSilenced =
            actor.effects && actor.effects.some((e) => e.stat === "silence");
          const isPassiveSkill =
            actor.skill && actor.skill.name.includes("[PASSIVE]");
          const skillCost = actor.skill.requiredEnergy || 100;
          const canUseSkill = !isSilenced || isPassiveSkill;

          if (actor.energy >= skillCost && canUseSkill) {
            const skillLogic = getSkillSafe(actor.skill.name);
            const skillResult = skillLogic.execute(
              actor,
              target,
              actor.skill.values
            );
            actor.energy -= skillCost;
            logs.push(skillResult.log);
            updateBars();
            embedData = await createBattleEmbed(
              player,
              player.type,
              enemy.type,
              playerCard.rarity,
              mobTemplate.rarity,
              enemy,
              logs,
              turn,
              battleBuffer,
              battleTitle
            );
            await battleMsg.edit({
              embeds: [embedData.embed],
              files: embedData.files,
            });
            await wait(1000);
          }

          if (target.stats.hp > 0) {
            // ✅ 1. PRE-ATTACK PHASE (Check Ammo, etc.)
            const preLog = checkPreAttackPassives(actor);
            if (preLog) {
              logs.push(preLog);
              updateBars();
              embedData = await createBattleEmbed(
                player,
                player.type,
                enemy.type,
                playerCard.rarity,
                mobTemplate.rarity,
                enemy,
                logs,
                turn,
                battleBuffer,
                battleTitle
              );
              await battleMsg.edit({
                embeds: [embedData.embed],
                files: embedData.files,
              });
              await wait(2000);
            }

            // ✅ 2. ATTACK PHASE
            const basicLogic = getSkillSafe("Basic Attack");
            const basicResult = basicLogic.execute(actor, target);

            if (!isSilenced && !isPassiveSkill) {
              let baseEnergyGain = 25;
              if (actor.effects) {
                const regenBuff = actor.effects.find(
                  (e) => e.stat === "energyRegen"
                );
                if (regenBuff) {
                  baseEnergyGain = Math.floor(
                    baseEnergyGain * (1 + regenBuff.amount / 100)
                  );
                }
              }
              actor.energy = Math.min(skillCost, actor.energy + baseEnergyGain);
            }

            logs.push(basicResult.log);
            updateBars();
            embedData = await createBattleEmbed(
              player,
              player.type,
              enemy.type,
              playerCard.rarity,
              mobTemplate.rarity,
              enemy,
              logs,
              turn,
              battleBuffer,
              battleTitle
            );
            await battleMsg.edit({
              embeds: [embedData.embed],
              files: embedData.files,
            });
            await wait(2000);
          }
        }

        const endLogs = applyEndTurnEffects(actor, target);
        if (endLogs.length > 0) {
          logs.push(...endLogs);
          updateBars();
          embedData = await createBattleEmbed(
            player,
            player.type,
            enemy.type,
            playerCard.rarity,
            mobTemplate.rarity,
            enemy,
            logs,
            turn,
            battleBuffer,
            battleTitle
          );
          await battleMsg.edit({
            embeds: [embedData.embed],
            files: embedData.files,
          });
          await wait(1000);
        }
        return target.stats.hp <= 0;
      };

      let gameOver = await runTurnLifecycle(first, second);
      if (gameOver) {
        battleOver = true;
        playerWon = first === player;
        break;
      }
      gameOver = await runTurnLifecycle(second, first);
      if (gameOver) {
        battleOver = true;
        playerWon = second === player;
        break;
      }
      turn++;
    }

    if (!battleOver && turn > MAX_TURNS) {
      battleOver = true;
      playerWon = false;
      logs.push("⌛ **Time Limit Exceeded!** You couldn't finish in time.");
    }

    // --- REWARDS ON WIN ---
    if (playerWon) {
      user.stam -= STAMINA_COST;

      // ✅ QUEST UPDATE (START BATTLE)
      await updateQuestProgress(user, "SPEND_STAMINA", STAMINA_COST, message);
      await updateQuestProgress(user, "BATTLE_COMPLETE", 1, message);

      const report = await processBattleRewards(
        userId,
        user,
        playerCard,
        areaData.stages[stageId],
        1
      );

      let unlockMsg = "";
      let bonusGold = 0;
      let bonusTickets = 0;
      const isProgression =
        areaId === user.dungeon.maxArea && stageId === user.dungeon.maxStage;

      // ✅ UPDATED PROGRESSION LOGIC (All stages grant 1 ticket on first clear)
      if (isProgression) {
        const totalStagesInArea = Object.keys(areaData.stages).length;

        if (stageId === totalStagesInArea) {
          // --- BOSS STAGE (End of Area) ---
          bonusGold += 15000;
          bonusTickets += 3;
          unlockMsg += `\n🎉 **Area Cleared:** Defeated ${areaId}-${stageId} (Boss)!\nGained **15,000 🪙** & **3 🎫 Tickets**.`;
          user.dungeon.maxArea++;
          user.dungeon.maxStage = 1;
          unlockMsg += "\n🔓 **New Area Unlocked!**";
        } else {
          // --- NORMAL STAGE (First Clear) ---
          bonusTickets += 1;
          unlockMsg += `\n🎁 **First Clear Bonus:** Gained **1 🎫 Ticket**!`;
          user.dungeon.maxStage++;
          unlockMsg += "\n🔓 **Stage Cleared!** Next stage unlocked.";
        }
      }

      user.gold += bonusGold;
      if (bonusTickets > 0) {
        let userInv = await Inventory.findOne({ userId });
        if (!userInv) userInv = new Inventory({ userId, items: [] });
        const ticketItem = userInv.items.find((i) => i.itemId === "ticket");
        if (ticketItem) ticketItem.amount += bonusTickets;
        else userInv.items.push({ itemId: "ticket", amount: bonusTickets });
        await userInv.save();
      }
      await user.save();

      const winEmbed = new EmbedBuilder()
        .setColor("#FFD700")
        .setAuthor({
          name: `${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`🏆 Victory!`)
        .setDescription(
          `**Congrats ${message.author.username}!**, Your **${player.name}** Cleared stage **${areaId}-${stageId}**!`
        )
        .addFields({
          name: "Rewards",
          value: `🪙 **+${report.gold + bonusGold}** \n ${xpIcon} **+${
            report.cardXp
          }** (Card)\n 🆙 **+${report.accountXp}** (Account)`,
          inline: true,
        })
        .setFooter({
          text: `Type !next stage or move to the next Area to dive deeper into the Dungeon.`,
        });

      if (report.levelsGained > 0)
        winEmbed.addFields({
          name: "Card Level Up!",
          value: `🆙 ${player.name} is now **Lv.${playerCard.level}**!`,
          inline: true,
        });

      const dropFields = formatDrops(report);
      winEmbed.addFields(dropFields);

      if (isProgression && unlockMsg)
        winEmbed.addFields({
          name: "Progression",
          value: unlockMsg,
          inline: false,
        });

      await message.channel.send({ embeds: [winEmbed] });

      if (report.accountLevelUp) {
        const capDisplay = report.stamCapIncreased ? "(+2 Cap)" : "(Max Cap)";
        const lvlEmbed = new EmbedBuilder()
          .setColor("#00FF00")
          .setAuthor({
            name: `${message.author.username}`,
            iconURL: message.author.displayAvatarURL({ dynamic: true }),
          })
          .setTitle("🎉 ACCOUNT LEVEL UP!")
          .setDescription(
            `Congratstulation ${message.author.username}! You reached **Level ${user.level}**!`
          )
          .addFields(
            {
              name: "⚡ Stamina Refilled",
              value: `Current: **${user.stam}/${user.stamCap}** ${capDisplay}`,
              inline: true,
            },
            {
              name: "💰 Bonus Gold",
              value: `+${report.lvlUpGold} 🪙`,
              inline: true,
            },
            {
              name: "🎫 Bonus Tickets",
              value: `+${report.lvlUpTickets} Tickets`,
              inline: true,
            }
          );
        await message.reply({ embeds: [lvlEmbed] });
      }
    } else {
      user.stam -= 2;
      await user.save();
      let lossReason = turn > MAX_TURNS ? "Time Limit Exceeded" : "Knocked Out";
      await message.reply(
        `💀 **Defeat (${lossReason})...**\n${player.name} fell in battle. You lost 2 Stamina.`
      );
    }
  } catch (err) {
    console.error(err);
    message.reply("Error processing battle.");
  } finally {
    removeUserBattling(userId);
  }
}

module.exports = { startBattle, skipBattle, sbt };
