const { UserContainer, Cards } = require("../db");
const { getRarityStars } = require("../functions");
const { getAscIcon } = require("../commands/inv_cards");
const { EmbedBuilder } = require("discord.js"); // ✅ Added EmbedBuilder
const borderLine = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
async function team(message) {
  const userId = message.author.id;

  try {
    const user = await UserContainer.findOne({ userId });

    if (!user) {
      return message.reply("❌ User profile not found.");
    }

    // Default to 4 empty slots if team array is missing/empty
    const teamSlots =
      user.team && user.team.length > 0 ? user.team : [null, null, null, null];

    // 1. Gather all UIDs that are not null
    const uidsToFetch = teamSlots.filter((uid) => uid !== null);

    // 2. Fetch all valid cards in one query
    const cards = await Cards.find({
      ownerId: userId,
      uid: { $in: uidsToFetch },
    }).populate("masterData");

    // 3. Map UIDs to Card Objects for easy lookup
    const cardMap = new Map();
    cards.forEach((c) => cardMap.set(c.uid, c));

    // 4. Build the Embed
    const embed = new EmbedBuilder()
      .setTitle(`🛡️ ${message.author.username}'s Team`)
      .setColor("#0099ff") // Nice blue theme
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setAuthor({
        name : `${message.author.username}`,
        iconURL : message.author.displayAvatarURL()
      })
      .setFooter({ text: "Use !teamset [uid] [slot] to change members" })
      .addFields({
        name: "\u200B", // Spacer
        value: borderLine,
        inline: false,
      });
    for (let i = 0; i < 4; i++) {
      const uid = teamSlots[i];
      const slotNum = i + 1;

      if (uid === null) {
        embed.addFields({
          name: `Slot #${slotNum}`,
          value: "⚫ *Empty Slot*",
          inline: false,
        });
      } else {
        const card = cardMap.get(uid);

        if (card && card.masterData) {
          const name = card.masterData.name;
          const lv = `Lv.${card.level}`;
          const type = card.masterData.type;
          const asc = `Asc.${getAscIcon(card.ascension)}`; // Usage from your code

          // Formatting the Value nicely
          // Line 1: Name & Stars
          // Line 2: Stats/Info
          const fieldVal =
            `**${name}** ${getRarityStars(card.rarity)}\n` +
            `🔸 [${lv}] [${type}] [${asc}]`;

          embed.addFields({
            name: `Slot #${slotNum} (UID: ${uid})`,
            value: fieldVal,
            inline: false,
          });
        } else {
          // Handle glitch case
          embed.addFields({
            name: `Slot #${slotNum}`,
            value: `⚠️ [Unknown Card] (UID: ${uid})`,
            inline: false,
          });
        }
      }
    }
    embed.addFields({
      name: "\u200B", // Spacer
      value: borderLine,
      inline: false,
    });
    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    message.reply("❌ Error displaying team.");
  }
}

module.exports = { team };
