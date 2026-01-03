const { UserContainer, Index, Inventory } = require("../db");
const {
  DUNGEON_AREAS,
  getFixedCardXp,
  getCardLevelCap,
} = require("../dungeon/dungeonData");
const Skills = require("./skills");
const createBattleEmbed = require("../ui/combatEmbed");
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

// =========================================
// 🎨 EMOJIS & UI HELPERS
// =========================================
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
  // Ensure we don't divide by zero
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

// =========================================
// ⏩ SKIP BATTLE FUNCTION
// =========================================
// =========================================
// ⏩ SKIP BATTLE FUNCTION
// =========================================
async function skipBattle(message, inputTimes = 1) {
  const userId = message.author.id;

  // 🔒 1. CHECK ACTIVE BATTLE (Prevent skipping while fighting)
  if (isUserBattling(userId)) {
    return message.reply("⚠️ You are already in a battle! Finish that one first.");
  }

  // 🔒 2. SET ACTIVE STATE
  setUserBattling(userId);

  try {
    // --- A. Validation & Loading ---
    const user = await UserContainer.findOne({ userId }).populate({
      path: "selectedCard",
      populate: { path: "masterData" },
    });

    if (!user || !user.selectedCard) {
      return message.reply("❌ You need to `!select` a card first!");
    }

    const areaId = user.dungeon.currentArea;
    const stageId = user.dungeon.currentStage;

    // Basic Area Checks
    if (areaId === 0) return message.reply("⚠️ Use `!area 1` first!");
    const areaData = DUNGEON_AREAS[areaId];
    if (!areaData || !areaData.stages[stageId]) return message.reply("❌ Invalid Stage data.");

    // --- B. Progression Check (Must clear stage manually first) ---
    if (
      areaId > user.dungeon.maxArea || 
      (areaId === user.dungeon.maxArea && stageId >= user.dungeon.maxStage)
    ) {
      return message.reply("🚫 You must manually clear this stage once before you can skip it!");
    }

    // --- C. Validate Run Count & Stamina ---
    let requestedRuns = parseInt(inputTimes);
    if (isNaN(requestedRuns) || requestedRuns < 1) requestedRuns = 1;
    if (requestedRuns > 20) requestedRuns = 20; // Hard Cap for safety

    const totalStamCost = requestedRuns * STAMINA_COST;
    if (user.stam < totalStamCost) {
      // If not enough stamina, calculate max possible runs
      const possibleRuns = Math.floor(user.stam / STAMINA_COST);
      if (possibleRuns === 0) {
        return message.reply(`⚠️ Not enough Stamina for even 1 battle! (Need ${STAMINA_COST} ⚡)`);
      }
      requestedRuns = possibleRuns;
    }

    // --- D. Prepare Data ---
    const playerCard = user.selectedCard;
    const mobTemplate = areaData.stages[stageId].mobs[0];
    const difficulty = areaData.stages[stageId].difficultyLevel;
    
    let totalGold = 0;
    let totalCardXp = 0;
    let totalAccountXp = 0;
    let cardLevelUps = 0;
    let accountLevelsGained = 0;
    const initialLevel = playerCard.level;

    // --- E. Execution Loop ---
    for (let i = 0; i < requestedRuns; i++) {
      const goldReward = mobTemplate.rewards.gold || 100;
      const cardXpReward = getFixedCardXp(difficulty);
      const accountXpGain = 15 + areaId * 5;

      totalGold += goldReward;
      totalCardXp += cardXpReward;
      totalAccountXp += accountXpGain;
      
      // Card XP Application
      playerCard.xp += cardXpReward;
      let cardCap = getCardLevelCap(playerCard.level);
      
      while (playerCard.xp >= cardCap) {
          playerCard.xp -= cardCap;
          playerCard.level++;
          cardLevelUps++;
          playerCard.stats.hp = Math.floor(playerCard.stats.hp * 1.025);
          playerCard.stats.atk = Math.floor(playerCard.stats.atk * 1.015);
          playerCard.stats.def = Math.floor(playerCard.stats.def * 1.01);
          playerCard.stats.speed = Math.floor(playerCard.stats.speed * 1.02);
          cardCap = getCardLevelCap(playerCard.level);
      }
      playerCard.xpCap = cardCap;
    }

    // --- F. Apply Account Changes ---
    user.stam -= (requestedRuns * STAMINA_COST);
    user.gold += totalGold;
    user.xp += totalAccountXp;

    // Account Level Up
    let lvlUpGold = 0;
    let lvlUpTickets = 0;
    while (user.xp >= 100 + (user.level - 1) * 10) {
      user.xp -= 100 + (user.level - 1) * 10;
      user.level++;
      accountLevelsGained++;
      user.stamCap += 2;
      user.stam += user.stamCap;
      const goldGain = 5000 + user.level * 500;
      lvlUpGold += goldGain;
      user.gold += goldGain;
      lvlUpTickets += 2;
    }

    // Handle Tickets
    if (lvlUpTickets > 0) {
      let userInv = await Inventory.findOne({ userId });
      if (!userInv) userInv = new Inventory({ userId, items: [] });
      const ticketItem = userInv.items.find((i) => i.itemId === "ticket");
      if (ticketItem) ticketItem.amount += lvlUpTickets;
      else userInv.items.push({ itemId: "ticket", amount: lvlUpTickets });
      await userInv.save();
    }

    // --- G. Save & Report ---
    await playerCard.save();
    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`⏩ Skipped ${requestedRuns} Battles`)
      .setColor("#0099ff")
      .setDescription(`Farmed **Stage ${areaId}-${stageId}**`)
      .addFields(
        { 
          name: "💰 Rewards", 
          value: `🪙 +${totalGold}\n${xpIcon} +${totalCardXp} (Card)\n🆙 +${totalAccountXp} (User)`, 
          inline: true 
        },
        { 
          name: "⚡ Stamina", 
          value: `Used: **${requestedRuns * STAMINA_COST}**\nRemaining: **${user.stam}/${user.stamCap}**`, 
          inline: true 
        }
      );

    if (cardLevelUps > 0) {
      embed.addFields({ 
          name: "📈 Card Growth", 
          value: `**${playerCard.masterData ? playerCard.masterData.name : 'Card'}**\nLv. ${initialLevel} ➔ **Lv. ${playerCard.level}**\nStats increased!`, 
          inline: false 
      });
    }

    if (accountLevelsGained > 0) {
      embed.addFields({
          name: "🎉 Account Level Up!",
          value: `Reached **Lv. ${user.level}**!\n(+${lvlUpGold} Gold, +${lvlUpTickets} Tickets)`,
          inline: false
      });
    }

    return message.channel.send({ embeds: [embed] });

  } catch (err) {
    console.error(err);
    message.reply("Error processing skip battle.");
  } finally {
    // 🔓 3. RELEASE STATE
    removeUserBattling(userId);
  }
}

// Shortcut Alias
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

    // 3. PREPARE FIGHTERS
    const playerCard = user.selectedCard;
    const mobTemplate = areaData.stages[stageId].mobs[0];

    let masterData = playerCard.masterData;
    if (!masterData) {
      masterData = await Index.findOne({ pokeId: playerCard.cardId });
    }

    const playerImage = masterData ? masterData.image : "";
    const playerName = masterData ? masterData.name : "Unknown Hero";

    // --- SETUP PLAYER SKILL ---
    let playerSkill = { name: "Basic Attack", values: [1.0] };
    if (masterData && masterData.skill) {
      const realValues = getSkillValues(masterData, playerCard.rarity);
      playerSkill = { name: masterData.skill.name, values: realValues };
    }
    // FETCH FULL SKILL DATA TO GET ENERGY COSTS
    const playerSkillRef = getSkillSafe(playerSkill.name);
    playerSkill.initialEnergy = playerSkillRef.initialEnergy !== undefined ? playerSkillRef.initialEnergy : 50;
    playerSkill.requiredEnergy = playerSkillRef.requiredEnergy || 100;


    const player = {
      name: playerName,
      level: playerCard.level,
      image: playerImage,
      type: masterData ? masterData.type : "Neutral ✨",
      stats: { ...playerCard.stats,
        critRate: 5, 
        critDmg: 140,
       },
      maxHp: playerCard.stats.hp,
      // ✅ USE DYNAMIC INITIAL ENERGY
      energy: playerSkill.initialEnergy,
      skill: playerSkill,
      effects: [],
      displayBars: "",
    };

    // --- SETUP ENEMY SKILL ---
    let enemySkill = mobTemplate.skill || { name: "Basic Attack", values: [1.0] };
    // FETCH FULL SKILL DATA FOR ENEMY
    const enemySkillRef = getSkillSafe(enemySkill.name);
    enemySkill.initialEnergy = enemySkillRef.initialEnergy !== undefined ? enemySkillRef.initialEnergy : 50;
    enemySkill.requiredEnergy = enemySkillRef.requiredEnergy || 100;

    const enemy = {
      name: mobTemplate.name,
      level: mobTemplate.level,
      image: mobTemplate.image,
      type: mobTemplate.type || "Neutral ✨",
      stats: {
        ...mobTemplate.stats,
        critRate: 5, 
        critDmg: 140,
      },
      maxHp: mobTemplate.stats.hp,
      // ✅ USE DYNAMIC INITIAL ENERGY
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
    
    // --- PASSIVE ACTIVATION ---
    const activatePassive = (unit, target) => {
      if (unit.skill && unit.skill.name.includes("[PASSIVE]")) {
        const skillLogic = getSkillSafe(unit.skill.name);
        // Execute immediately
        const result = skillLogic.execute(unit, target, unit.skill.values);
        logs.push(result.log);

        // FIND the effect it just applied and make it infinite (999 turns)
        if (unit.effects.length > 0) {
          unit.effects.forEach((e) => {
            // We assume the last added effect is the passive, or match by name
            if (e.name === unit.skill.name || e.name === "Wind's Edge") {
              e.turns = 999;
            }
          });
        }
      }
    };

    // Activate for Player and Enemy
    activatePassive(player, enemy);
    activatePassive(enemy, player);

    // -------------------------------------------------------------
    // ✅ UPDATED BARS: Uses actual 'requiredEnergy' instead of 100
    // -------------------------------------------------------------
    const updateBars = () => {
      const pMaxEnergy = player.skill.requiredEnergy || 100;
      const eMaxEnergy = enemy.skill.requiredEnergy || 100;

      player.displayBars =
        `${generateProgressBar(player.stats.hp, player.maxHp, "hp")}\n` +
        `${generateProgressBar(player.energy, pMaxEnergy, "energy")}`;

      enemy.displayBars =
        `${generateProgressBar(enemy.stats.hp, enemy.maxHp, "hp")}\n` +
        `${generateProgressBar(enemy.energy, eMaxEnergy, "energy")}`;
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
      // 1. Determine Speed
      const first = player.stats.speed >= enemy.stats.speed ? player : enemy;
      const second = first === player ? enemy : player;

      logs.push(`⚡ **${first.name}** has faster speed, it goes first!`);

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

      // 🔄 HELPER: Run Full Turn Cycle for ONE Unit
      const runTurnLifecycle = async (actor, target) => {
        if (target.stats.hp <= 0) return true; // Target dead, skip turn

        // A. ✅ START OF TURN EFFECTS (Ticks happen HERE, before action)
        const startLogs = applyStartTurnEffects(actor);
        if (startLogs.length > 0) {
          logs.push(...startLogs);

          // Update UI for ticks (e.g. Energy Loss)
          updateBars(); // Make sure bars update if energy changed
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

        // B. ACTION (Skill/Basic)
        // Check Silence *after* start ticks but *before* acting
        const isSilenced =
          actor.effects && actor.effects.some((e) => e.stat === "silence");

        // ✅ CHECK DYNAMIC REQUIRED ENERGY
        const skillCost = actor.skill.requiredEnergy || 100;

        if (actor.energy >= skillCost && !isSilenced) {
          const skillLogic = getSkillSafe(actor.skill.name);
          const skillResult = skillLogic.execute(
            actor,
            target,
            actor.skill.values
          );
          // ✅ CONSUME DYNAMIC ENERGY
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

        // Basic Attack Logic (Always runs if target alive)
        if (target.stats.hp > 0) {
          const basicLogic = getSkillSafe("Basic Attack");
          const basicResult = basicLogic.execute(actor, target);

          const isPassiveSkill =
            actor.skill && actor.skill.name.includes("[PASSIVE]");
          
          // Regen Energy logic:
          // 1. Must NOT be Silenced
          // 2. Must NOT have a Passive Skill (Passive users don't need energy)
          if (!isSilenced && !isPassiveSkill) {
            actor.energy = Math.min(skillCost, actor.energy + 25); // Cap at max
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

        // C. ✅ END OF TURN EFFECTS (Decrement/Expire happens HERE)
        const endLogs = applyEndTurnEffects(actor);
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

      // --- RUN TURN SEQUENCE ---
      // 1. First Unit
      let gameOver = await runTurnLifecycle(first, second);
      if (gameOver) {
        battleOver = true;
        playerWon = first === player;
        break;
      }

      // 2. Second Unit
      gameOver = await runTurnLifecycle(second, first);
      if (gameOver) {
        battleOver = true;
        playerWon = second === player;
        break;
      }

      turn++;
    }

    // ... [Rest of Rewards Logic - Unchanged] ...
    if (!battleOver && turn > MAX_TURNS) {
      battleOver = true;
      playerWon = false;
      logs.push("⌛ **Time Limit Exceeded!** You couldn't finish in time.");
    }

    if (playerWon) {
      user.stam -= STAMINA_COST;
      const difficulty = areaData.stages[stageId].difficultyLevel;
      const cardXpReward = getFixedCardXp(difficulty);
      playerCard.xp += cardXpReward;

      let cardCap = playerCard.xpCap || getCardLevelCap(playerCard.level);
      let cardLevelUps = 0;

      // ---------------------------------------------------------
      // ✅ UPDATED LEVEL UP CALCULATION
      // ---------------------------------------------------------
      while (playerCard.xp >= cardCap) {
        playerCard.xp -= cardCap;
        playerCard.level++;
        cardLevelUps++;
        playerCard.stats.hp = Math.floor(playerCard.stats.hp * 1.025);
        playerCard.stats.atk = Math.floor(playerCard.stats.atk * 1.015);
        playerCard.stats.def = Math.floor(playerCard.stats.def * 1.01);
        playerCard.stats.speed = Math.floor(playerCard.stats.speed * 1.02);
        cardCap = getCardLevelCap(playerCard.level);
      }
      playerCard.xpCap = cardCap;
      // ---------------------------------------------------------

      const accountXpGain = 15 + areaId * 5;
      user.xp += accountXpGain;
      let accountLevelUp = false;
      let lvlUpGold = 0;
      let lvlUpTickets = 0;
      while (user.xp >= 100 + (user.level - 1) * 10) {
        user.xp -= 100 + (user.level - 1) * 10;
        user.level++;
        accountLevelUp = true;
        user.stamCap += 2;
        user.stam += user.stamCap;
        const goldGain = 5000 + user.level * 500;
        lvlUpGold += goldGain;
        user.gold += goldGain;
        lvlUpTickets += 2;
      }

      const goldReward = mobTemplate.rewards.gold;
      let unlockMsg = "";
      let bonusGold = 0;
      let bonusTickets = 0;
      const isProgression =
        areaId === user.dungeon.maxArea && stageId === user.dungeon.maxStage;
      if (isProgression) {
        const totalStagesInArea = Object.keys(areaData.stages).length;
        if (stageId % 3 === 0) {
          bonusTickets += 1;
          unlockMsg += `\n🎁 Defeated ${areaId}-${stageId} for the first time! Gained **1 🎫 Ticket**.`;
        }
        if (stageId === totalStagesInArea) {
          bonusGold += 15000;
          bonusTickets += 3;
          unlockMsg += `\n🎉 **Area Cleared:** Defeated ${areaId}-${stageId} (Boss)!\nGained **15,000 🪙** & **3 🎫 Tickets**.`;
          user.dungeon.maxArea++;
          user.dungeon.maxStage = 1;
          unlockMsg += "\n🔓 **New Area Unlocked!**";
        } else {
          user.dungeon.maxStage++;
          if (!unlockMsg.includes("Milestone"))
            unlockMsg = "🔓 **Stage Cleared!** Next stage unlocked.";
        }
      }
      user.gold += goldReward + bonusGold;

      const totalTicketsToAdd = bonusTickets + lvlUpTickets;
      if (totalTicketsToAdd > 0) {
        let userInv = await Inventory.findOne({ userId });
        if (!userInv) userInv = new Inventory({ userId, items: [] });
        const ticketItem = userInv.items.find((i) => i.itemId === "ticket");
        if (ticketItem) ticketItem.amount += totalTicketsToAdd;
        else
          userInv.items.push({ itemId: "ticket", amount: totalTicketsToAdd });
        await userInv.save();
      }

      await playerCard.save();
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
          value: `🪙 **+${goldReward}** \n ${xpIcon} **+${cardXpReward}** (Card)\n 🆙 **+${accountXpGain}** (Account)`,
          inline: true,
        })
        .setFooter({
          text: `Type !next stage or move to the next Area to dive deeper into the Dungeon.`,
        });
      if (cardLevelUps > 0)
        winEmbed.addFields({
          name: "Card Level Up!",
          value: `🆙 ${player.name} is now **Lv.${playerCard.level}**!`,
          inline: true,
        });
      if (isProgression && unlockMsg)
        winEmbed.addFields({
          name: "Progression",
          value: unlockMsg,
          inline: false,
        });
      await message.channel.send({ embeds: [winEmbed] });

      if (accountLevelUp) {
        const lvlEmbed = new EmbedBuilder()
          .setColor("#00FF00")
          .setAuthor({
            name: `${message.author.username}`,
            iconURL: message.author.displayAvatarURL({ dynamic: true }),
          })
          .setTitle("🎉 ACCOUNT LEVEL UP!")
          .setDescription(`You reached **Level ${user.level}**!`)
          .addFields(
            {
              name: "⚡ Stamina Refilled",
              value: `Current: **${user.stam}/${user.stamCap}** (+2 Cap)`,
              inline: true,
            },
            { name: "💰 Bonus Gold", value: `+${lvlUpGold} 🪙`, inline: true },
            {
              name: "🎫 Bonus Tickets",
              value: `+${lvlUpTickets} Tickets`,
              inline: true,
            }
          );
        await message.channel.send({ embeds: [lvlEmbed] });
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