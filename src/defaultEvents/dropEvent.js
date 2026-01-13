const { UserContainer, Index } = require("../db");
const { getRarityStars } = require("../functions");
const { calculateStats } = require("../Banners/pullSystem");
const { startDropBattle } = require("./dropBattle");
const { formatImage } = require("../commands/infoCard");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// Cooldown & Config
const channelCooldowns = new Set();
const COOLDOWN_TIME = 3 * 60 * 1000; // 30 Seconds (for testing) or 5 mins
const DROP_CHANCE = 0.02; // 50% Chance per message (Adjust as needed)

// ==========================================
// 📊 LEVEL & RARITY CONFIGURATION
// ==========================================

const RARITY_LEVELS = {
  1: 20,
  2: 20,
  3: 25,
  4: 30,
  5: 35,
  6: 25,
};

/**
 * Rolls rarity based on weighted chance.
 * Higher rarity = Lower chance.
 */
function rollWildRarity() {
  const roll = Math.random() * 100;
  // 6 Star: 1%
  if (roll < 1) return 6;
  // 5 Star: 4% (1 - 5)
  if (roll < 5) return 5;
  // 4 Star: 15% (5 - 20)
  if (roll < 20) return 4;
  // 3 Star: 30% (20 - 50)
  if (roll < 50) return 3;
  // 2 Star: 30% (50 - 80)
  if (roll < 80) return 2;
  // 1 Star: 20% (80 - 100)
  return 1;
}

function applyLevelGrowth(baseStats, targetLevel) {
  let s = { ...baseStats };
  for (let i = 1; i < targetLevel; i++) {
    s.hp = Math.floor(s.hp * 1.015);
    s.atk = Math.floor(s.atk * 1.015);
    s.def = Math.floor(s.def * 1.013);
    s.speed = Math.floor(s.speed * 1.01);
  }
  return s;
}

// ==========================================
// 🚀 MAIN SPAWN FUNCTION
// ==========================================

async function trySpawnCard(message) {
  if (message.author.bot) return;
  if (channelCooldowns.has(message.channel.id)) return;

  if (Math.random() > DROP_CHANCE) return;

  try {
    channelCooldowns.add(message.channel.id);
    setTimeout(
      () => channelCooldowns.delete(message.channel.id),
      COOLDOWN_TIME
    );

    const total = await Index.countDocuments();
    if (total === 0) return;

    const randomIndex = Math.floor(Math.random() * total);
    const cardData = await Index.findOne().skip(randomIndex);
    if (!cardData) return;

    // 1. Determine Rarity & Level
    const rarity = rollWildRarity();
    const level = RARITY_LEVELS[rarity] || 5;

    // 2. Calculate Stats (Base Rarity Stats -> Scaled by Level)
    const baseStats = calculateStats(cardData.stats, rarity);
    const finalStats = applyLevelGrowth(baseStats, level);

    // 3. Format Image (Handling potential async formatImage)
    const formattedImg = await formatImage(cardData.image, 330, 550);

    const embed = new EmbedBuilder()
      .setColor(cardData.cardColor ?? "#ffffff")
      .setTitle(`✨ A wild card appeared!`)
      .setDescription(
        `**${cardData.name}**\n` +
          `**Rarity:** ${getRarityStars(rarity)}\n` +
          `**Level:** ${level}\n` +
          `**Type:** ${cardData.type}\n` +
          `Challenge to capture it!`
      )
      .setImage(formattedImg)
      .setFooter({ text: "First to Challenge enters combat!" });

    const challengeBtn = new ButtonBuilder()
      .setCustomId("challenge_card")
      .setLabel("⚔️ Challenge")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(challengeBtn);

    const spawnMsg = await message.channel.send({
      embeds: [embed],
      components: [row],
    });

    const collector = spawnMsg.createMessageComponentCollector({
      time: 300000, // 5m
      max: 1,
    });

    let challenged = false;

    collector.on("collect", async (interaction) => {
      const challengerId = interaction.user.id;

      const user = await UserContainer.findOne({ userId: challengerId });
      if (!user) {
        return interaction.reply({
          content: "❌ You don't have an account! Use `!create` first.",
          ephemeral: true,
        });
      }

      challenged = true;

      const processingRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("processing")
          .setLabel(`Battling: ${interaction.user.username}...`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      await spawnMsg.edit({ components: [processingRow] });

      // ✅ PASSING LEVEL AND FINAL STATS TO BATTLE
      // Note: Ensure startDropBattle accepts 'level' as a parameter now!
      await startDropBattle(
        interaction,
        cardData,
        rarity,
        finalStats,
        spawnMsg,
        level
      );
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        const expiredRow = new ActionRowBuilder().addComponents(
          challengeBtn
            .setDisabled(true)
            .setLabel("Fled")
            .setStyle(ButtonStyle.Secondary)
        );
        spawnMsg
          .edit({
            content: "💨 The wild card fled...",
            components: [expiredRow],
          })
          .catch(() => {});
      }
    });
  } catch (error) {
    console.error("Auto Drop Error:", error);
    channelCooldowns.delete(message.channel.id);
  }
}

module.exports = { trySpawnCard };
