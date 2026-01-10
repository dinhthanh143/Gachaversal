const { Index, Raids } = require("../db");
const { EmbedBuilder } = require("discord.js");
const { getRarityStars } = require("../functions");
const { goldIcon } = require("../commands/hourly_daily_weekly");
const { formatImage } = require("../commands/infoCard");
const { calculateTeamPower } = require("../raid/raidManager");
// ✅ IMPORTED: using the function from pullSystem
const { calculateStats } = require("../Banners/pullSystem");

const DIFFICULTIES = {
  1: { name: "Easy", color: "#2ecc71", minLv: 140, maxLv: 150 },
  2: { name: "Normal", color: "#3498db", minLv: 155, maxLv: 160 },
  3: { name: "Hard", color: "#9b59b6", minLv: 165, maxLv: 170 },
  4: { name: "Expert", color: "#e67e22", minLv: 175, maxLv: 185 },
  5: { name: "Insane", color: "#e74c3c", minLv: 190, maxLv: 205 },
  6: { name: "Nightmare", color: "#000000", minLv: 210, maxLv: 225 },
};

const ITEMS = {
  b1: { itemId: "b1", name: "Minor Blessing", emote: "✨" },
  b2: { itemId: "b2", name: "Major Blessing", emote: "🌟" },
  b3: { itemId: "b3", name: "Grand Blessing", emote: "💫" },
  b4: { itemId: "b4", name: "Divine Blessing", emote: "💠" },
};

const GROWTH = { HP: 1.017,
     ATK: 1.0175,
      DEF: 1.0145,
       SPD: 1.0126 };
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

async function generateUniqueRaidId() {
  let isUnique = false;
  let newId = 0;
  while (!isUnique) {
    newId = Math.floor(100000 + Math.random() * 900000);
    const existing = await Raids.findOne({ raidId: newId });
    if (!existing) isUnique = true;
  }
  return newId;
}

async function createRaid(message) {
  try {
    const roll = Math.random() * 100;
    let rarity = 1;
    if (roll > 95) rarity = 6;
    else if (roll > 85) rarity = 5;
    else if (roll > 60) rarity = 4;
    else if (roll > 30) rarity = 2;
    else if (roll > 10) rarity = 3;

    const diffConfig = DIFFICULTIES[rarity];
    const level = randomInt(diffConfig.minLv, diffConfig.maxLv);
    const raidId = await generateUniqueRaidId();

    const randomAgg = await Index.aggregate([{ $sample: { size: 1 } }]);
    if (!randomAgg || randomAgg.length === 0)
      return message.reply("❌ Index Empty.");
    const baseData = randomAgg[0];
    const scaledImg = await formatImage(baseData.image, 250, 380);

    // 3. CALCULATE STATS
    // ------------------------------------------
    // ✅ Step A: Get Baseline Stats for this Rarity (Using Imported Function)
    const rarityStats = calculateStats(baseData.stats, rarity);

    // ✅ Step B: Scale by Raid Level
    const levelsToGrow = Math.max(0, level - 1);

    const realStats = {
      hp: Math.floor(rarityStats.hp * Math.pow(GROWTH.HP, levelsToGrow)),
      atk: Math.floor(rarityStats.atk * Math.pow(GROWTH.ATK, levelsToGrow)),
      def: Math.floor(rarityStats.def * Math.pow(GROWTH.DEF, levelsToGrow)),
      speed: Math.floor(rarityStats.speed * Math.pow(GROWTH.SPD, levelsToGrow)),
    };

    const hpMultiplier = 16 - rarity;
    const raidHp = realStats.hp * hpMultiplier;

    let finalSkillDesc = baseData.skill.description;
    if (baseData.skill.values && baseData.skill.values.length > 0) {
      const rarityIndex = Math.max(0, rarity - 1);
      baseData.skill.values.forEach((valArray, i) => {
        if (Array.isArray(valArray) && valArray.length > 0) {
          const val =
            valArray[rarityIndex] !== undefined
              ? valArray[rarityIndex]
              : valArray[valArray.length - 1];
          const regex = new RegExp(`\\{${i}\\}`, "g");
          finalSkillDesc = finalSkillDesc.replace(regex, `**${val}**`);
        }
      });
    }

    const rewardLines = [];
    const dbItems = [];
    const dbCards = [];
    let gemReward = 0;
    let ticketReward = 0;

    const goldReward = Math.floor(
      1200 * Math.pow(rarity, 1.5) * (1 + level / 40)
    );
    rewardLines.push(
      `x__${goldReward.toLocaleString()}__ ${goldIcon || "💰"} Gold`
    );

    if (rarity >= 4) {
      gemReward = rarity === 4 ? 5 : rarity === 5 ? 10 : 20;
      rewardLines.push(`x__${gemReward}__ 💎 Gems`);
    }

    if (rarity >= 5) {
      ticketReward = rarity === 5 ? 1 : 3;
      rewardLines.push(`x__${ticketReward}__ 🎫 Tickets`);
    }

    const b1Qty = randomInt(40, 60) * rarity;
    rewardLines.push(`x__${b1Qty}__ ${ITEMS.b1.emote} ${ITEMS.b1.name} (75%)`);
    dbItems.push({
      itemId: ITEMS.b1.itemId,
      name: ITEMS.b1.name,
      qty: b1Qty,
      chance: 0.75,
    });

    if (rarity >= 2) {
      const b2Qty = randomInt(10, 20) * (rarity - 1);
      rewardLines.push(
        `x__${b2Qty}__ ${ITEMS.b2.emote} ${ITEMS.b2.name} (40%)`
      );
      dbItems.push({
        itemId: ITEMS.b2.itemId,
        name: ITEMS.b2.name,
        qty: b2Qty,
        chance: 0.4,
      });
    }

    if (rarity <= 3) {
      rewardLines.push(
        `x__10__ ${getRarityStars(2)} **${baseData.name}** (50% per card)`
      );
      rewardLines.push(
        `x__8__ ${getRarityStars(3)} **${baseData.name}** (30% per card)`
      );
      rewardLines.push(
        `x__5__ ${getRarityStars(4)} **${baseData.name}** (10% per card)`
      );

      dbCards.push({
        rarity: 2,
        qty: 10,
        chance: 0.5,
        cardId: baseData.pokeId,
      });
      dbCards.push({ rarity: 3, qty: 8, chance: 0.3, cardId: baseData.pokeId });
      dbCards.push({ rarity: 4, qty: 5, chance: 0.1, cardId: baseData.pokeId });
    } else if (rarity === 4) {
      const qty5 = randomInt(2, 3);
      rewardLines.push(
        `x__${qty5}__ ${getRarityStars(5)} **${baseData.name}** (15% per card)`
      );
      rewardLines.push(
        `x__1__ ${getRarityStars(6)} **${baseData.name}** (0.8%)`
      );

      dbCards.push({
        rarity: 5,
        qty: qty5,
        chance: 0.15,
        cardId: baseData.pokeId,
      });
      dbCards.push({
        rarity: 6,
        qty: 1,
        chance: 0.008,
        cardId: baseData.pokeId,
      });
    } else if (rarity === 5) {
      const qty6 = randomInt(2, 3);
      rewardLines.push(
        `x__5__ ${getRarityStars(5)} **${baseData.name}** (25% per card)`
      );
      rewardLines.push(
        `x__${qty6}__ ${getRarityStars(6)} **${baseData.name}** (1.7% per card)`
      );

      dbCards.push({
        rarity: 5,
        qty: 5,
        chance: 0.25,
        cardId: baseData.pokeId,
      });
      dbCards.push({
        rarity: 6,
        qty: qty6,
        chance: 0.017,
        cardId: baseData.pokeId,
      });
    } else if (rarity === 6) {
      rewardLines.push(
        `x__10__ ${getRarityStars(5)} **${baseData.name}** (30% per card)`
      );
      rewardLines.push(
        `x__5__ ${getRarityStars(6)} **${baseData.name}** (2.3% per card)`
      );

      dbCards.push({
        rarity: 5,
        qty: 10,
        chance: 0.3,
        cardId: baseData.pokeId,
      });
      dbCards.push({
        rarity: 6,
        qty: 5,
        chance: 0.023,
        cardId: baseData.pokeId,
      });
    }

    const rarityStars = getRarityStars(rarity);
    const bossPowerLevel = calculateTeamPower(realStats);
    const embed = new EmbedBuilder()
      .setColor(baseData.cardColor || diffConfig.color)
      .setTitle(`☠️ RAID BOSS: ${baseData.name} [${diffConfig.name}]`)
      .setAuthor({
        name: `${message.author.username} summoned a Raid!`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(
        `A powerful **Lv. ${level} ${baseData.name}** has appeared! Gather your team and attack!`
      )
      .setThumbnail(message.client.user.displayAvatarURL())
      .addFields(
        {
          name: "📊 Boss Info",
          value: `**Rarity:** ${rarityStars}\n**Type:** ${baseData.type}\n**Difficulty:** ${diffConfig.name}\n**Power Level : ${bossPowerLevel}**`,
          inline: true,
        },
        {
          name: "⚔️ Stats",
          value: `🩸 **HP:** ${raidHp.toLocaleString()} (Base: ${realStats.hp.toLocaleString()})\n⚔️ **ATK:** ${realStats.atk.toLocaleString()}\n🛡️ **DEF:** ${realStats.def.toLocaleString()}\n💨 **SPD:** ${realStats.speed.toLocaleString()}`,
          inline: false,
        },
        {
          name: `Skill: ${baseData.skill.name} ${baseData.skill.icon || ""}`,
          value: finalSkillDesc,
          inline: false,
        },
        {
          name: "🎁 Participation Rewards",
          value: rewardLines.join("\n"),
          inline: false,
        }
      )
      .setImage(scaledImg)
      .setFooter({
        text: `Raid ID: ${raidId} | Raid expires in 40 mins | Type !raid join ${raidId} to enter`,
      });

    const sentMessage = await message.author.send({ embeds: [embed] });

    const newRaid = new Raids({
      raidId: raidId,
      enemyId: baseData.pokeId,
      rarity: rarity,
      level: level,
      stats: {
        realHp: realStats.hp,
        atk: realStats.atk,
        hp: raidHp,
        def: realStats.def,
        speed: realStats.speed,
      },
      currentHp: raidHp,
      isDefeated: false,
      participants: [],
      rewards: {
        gold: goldReward,
        gem: gemReward,
        ticket: ticketReward,
        items: dbItems,
        cards: dbCards,
      },
      channelId: message.channel.id,
      messageId: sentMessage.id,
    });

    await newRaid.save();
  } catch (err) {
    console.error(err);
    message.reply("❌ Error creating raid.");
  }
}

module.exports = { createRaid };
