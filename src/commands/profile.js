// src/commands/profile.js
const { UserContainer, Cards } = require("../db"); // ✅ Removed Inventory since we aren't checking tickets anymore
const { EmbedBuilder } = require("discord.js");
const { getRarityStars } = require("../functions");
const { formatImage } = require("./infoCard");
const { getAscIcon } = require("./inv_cards");

// ==========================================
// 🎨 PROGRESS BAR HELPERS
// ==========================================
const EMOJIS = {
  // Green (70% - 100%)
  green: {
    left: "<:g1:1455167942646824990>",
    mid: "<:g2:1455166531926233108>",
    right: "<:g3:1455167940658728970>",
  },
  // Blue (Energy)
  blue: {
    left: "<:b1:1455167938704179362>",
    mid: "<:b2:1455167983294087188>",
    right: "<:blue3:1455168960113807381>",
  },
  // Yellow (50% - 70%)
  yellow: {
    left: "<:y1:1455167850267410504>",
    mid: "<:y2:1455166520597413980>",
    right: "<:gr3:1455224186044944528>",
  },
  // Orange (30% - 50%)
  orange: {
    left: "<:o1:1455167852519751797>",
    mid: "<:o2:1455166538637250581>",
    right: "<:gr3:1455224186044944528>",
  },
  // Red (< 30%)
  red: {
    left: "<:r1:1455168985107664896>",
    mid: "<:r2:1455169010776801292>",
    right: "<:gr3:1455224186044944528>",
  },
  // Empty
  empty: {
    left: "<:gr1:1455224191136825357>",
    mid: "<:gr2:1455224188624441428>",
    right: "<:gr3:1455224186044944528>",
  },
};

function generateProgressBar(current, max, type = "hp") {
  const percent = Math.max(0, Math.min(1, current / max));
  const filled = Math.ceil(percent * 10); // 0 to 10 segments
  const barParts = [];

  // Determine Color Theme
  let theme = EMOJIS.green;

  if (type === "energy") {
    theme = EMOJIS.blue;
  } else if (type === "xp") {
    theme = EMOJIS.green; // Always green for XP
  } else {
    if (percent <= 0.3) theme = EMOJIS.red;
    else if (percent <= 0.5) theme = EMOJIS.orange;
    else if (percent <= 0.7) theme = EMOJIS.yellow;
  }

  // 1. Left Cap
  barParts.push(filled >= 1 ? theme.left : EMOJIS.empty.left);

  // 2. Middle Segments (8 slots)
  for (let i = 2; i <= 9; i++) {
    barParts.push(filled >= i ? theme.mid : EMOJIS.empty.mid);
  }

  // 3. Right Cap
  barParts.push(filled === 10 ? theme.right : EMOJIS.empty.right);

  return barParts.join("\u200D");
}

// ==========================================
// 👤 PROFILE COMMAND
// ==========================================
async function profile(message) {
  try {
    const targetUser = message.mentions.users.first() || message.author;
    const userId = targetUser.id;

    let user = await UserContainer.findOne({ userId });

    if (!user) {
      if (userId === message.author.id) {
        return message.reply(
          "You don't have a profile yet. Use `!start` or `!create` first."
        );
      } else {
        return message.reply(
          `**${targetUser.username}** has not started their journey yet.`
        );
      }
    }

    const userCards = await Cards.find({ ownerId: userId });

    let selectedCard = null;
    if (user.selectedCard) {
      selectedCard = await Cards.findById(user.selectedCard).populate(
        "masterData"
      );
    }

    // 5. XP Progress Bar
    const xpNeeded = 100 + (user.level - 1) * 50;
    const xpBar = generateProgressBar(user.xp, xpNeeded, "xp");
    const percentage = Math.min((user.xp / xpNeeded) * 100, 100);

    // Get Dungeon Info (Default to 1-1 if undefined)
    const area = user.dungeon?.currentArea || 1;
    const stage = user.dungeon?.currentStage || 1;

    const embed = new EmbedBuilder()
      .setColor("#ffa500")
      .setAuthor({
        name: `${targetUser.username}'s Profile`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true }),
      })
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: "💰 Wealth",
          value: `🪙: **${user.gold}**\n💎: **${user.gem}**`,
          inline: true,
        },
        {
          name: "⚡ Stamina",
          value: `**${user.stam}/${user.stamCap}**`,
          inline: true,
        },
        // ✅ CHANGED: Now shows Current Stage instead of Gacha Items
        {
          name: "📍 Current Location",
          value: `⚔️ **Stage ${area}-${stage}**`,
          inline: true,
        },
        {
          name: "📈 Progress",
          value: `**Level ${user.level}**\nXP: ${
            user.xp
          }/${xpNeeded}\n${xpBar} **${percentage.toFixed(0)}%**`,
          inline: false,
        },
        {
          name: "⭐ Selected Unit",
          value:
            selectedCard && selectedCard.masterData
              ? `**${selectedCard.masterData.name}**\nLv. ${
                  selectedCard.level
                } |  Ascension: ${getAscIcon(selectedCard.ascension)}
                \n${getRarityStars(selectedCard.rarity)}`
              : "*No unit selected*",
          inline: true,
        },
        {
          name: "🃏 Collection",
          value: `${userCards.length} Cards Collected`,
          inline: true,
        }
      )
      .setTimestamp();

    if (
      selectedCard &&
      selectedCard.masterData &&
      selectedCard.masterData.image
    ) {
      embed.setImage(formatImage(selectedCard.masterData.image, 280, 420));
    }

    message.reply({ embeds: [embed] });
  } catch (err) {
    console.error("PROFILE ERROR:", err);
    message.reply("Something went wrong while viewing the profile.");
  }
}

module.exports = { profile };
