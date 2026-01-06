const { Cards, Index } = require("../db");
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require("discord.js");
const { getRarityStars } = require("../functions");
const { formatImage } = require("../commands/infoCard");
// Level Caps Configuration (Same as your rewards system)
const LEVEL_CAPS = {
  1: 40,
  2: 50,
  3: 60,
  4: 80,
  5: 90,
  6: 100,
};

// Helper for stars

async function ascension(message) {
  try {
    const userId = message.author.id;
    const args = message.content.split(" ");

    // 1. Input Validation
    if (args.length < 3) {
      return message.reply("⚠️ Usage: `!ascension [Target Card Index] [Fodder Card Index]`\nExample: `!asc 1 5` (Ascend card #1 using card #5)");
    }

    const targetIndex = parseInt(args[1]) - 1;
    const fodderIndex = parseInt(args[2]) - 1;

    if (isNaN(targetIndex) || isNaN(fodderIndex)) {
      return message.reply("⚠️ Please provide valid numeric numbers for your inventory.");
    }

    // 2. Fetch User Inventory
    // We need to fetch all cards to map the "Index" correctly (assuming standard sorting)
    const userCards = await Cards.find({ ownerId: userId });

    if (!userCards[targetIndex] || !userCards[fodderIndex]) {
      return message.reply("❌ One of the cards specified does not exist in your inventory.");
    }

    const targetCard = userCards[targetIndex];
    const fodderCard = userCards[fodderIndex];

    // Populate Master Data for Names/Images
    const targetMaster = await Index.findOne({ pokeId: targetCard.cardId });
    const fodderMaster = await Index.findOne({ pokeId: fodderCard.cardId }); // Should be same, but fetching to be safe

    if (!targetMaster || !fodderMaster) {
      return message.reply("❌ Error loading card data. Contact admin.");
    }

    // 3. LOGIC CHECKS

    // A. Check if they are the same card instance
    if (targetCard._id.toString() === fodderCard._id.toString()) {
      return message.reply("⚠️ You cannot consume a card to ascend itself!");
    }

    // B. Check Max Ascension
    if (targetCard.ascension >= 6) {
      return message.reply("⚠️ This card has already reached **Max Ascension (Rank 6)**!");
    }

    // C. Check Level Cap (Target must be max level for current rarity)
    const currentLevelCap = LEVEL_CAPS[targetCard.rarity] || 100;
    if (targetCard.level < currentLevelCap) {
      return message.reply(
        `🛑 **Lv. ${targetCard.level} ${targetMaster.name} ${getRarityStars(targetCard.rarity)}** has not reached their full potential.\n` +
        `Required Level: **${currentLevelCap}**`
      );
    }

    // D. Check Matching Character
    if (targetCard.cardId !== fodderCard.cardId) {
      return message.reply(`❌ You must sacrifice a copy of **${targetMaster.name}** with the same rarity to ascend this card.`);
    }

    // E. Check Matching Rarity
    if (targetCard.rarity !== fodderCard.rarity) {
      return message.reply(`❌ The material card must be the same rarity (**${getRarityStars(targetCard.rarity)}**).`);
    }

    // 4. CONFIRMATION EMBED
    const confirmEmbed = new EmbedBuilder()
      .setColor("#E67E22")
      .setTitle("🔥 Ascension Ritual")
      .setDescription(
        `Are you sure you want to **consume**:\n` +
        `❌ **Lv. ${fodderCard.level} ${fodderMaster.name}** ${getRarityStars(fodderCard.rarity)} (Index: ${fodderIndex + 1})\n\n` +
        `To **Ascend**:\n` +
        `✨ **Lv. ${targetCard.level} ${targetMaster.name}** ${getRarityStars(targetCard.rarity)} (Index: ${targetIndex + 1})\n` +
        `**Rank:** ${targetCard.ascension || 0} ➔ **${(targetCard.ascension || 0) + 1}**`
      )
      .addFields(
        { name: "Projected Stats", value: `
        ⚔️ ATK: +6.75%
        🩸 HP: +10%
        🛡️ DEF: +6%
        💨 SPD: +2.5%
        `, inline: false }
      )
      .setThumbnail(formatImage(targetMaster.image,110,140));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("confirm_asc").setLabel("Confirm Ascension").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("cancel_asc").setLabel("Cancel").setStyle(ButtonStyle.Danger)
    );

    const replyMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });

    // 5. COLLECTOR
    const filter = (i) => i.user.id === userId;
    const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000, max: 1, componentType: ComponentType.Button });

    collector.on("collect", async (interaction) => {
      try {
        await interaction.deferUpdate();

        if (interaction.customId === "cancel_asc") {
          await replyMsg.edit({ content: "❌ Ascension cancelled.", embeds: [], components: [] });
          return;
        }

        if (interaction.customId === "confirm_asc") {
          // Double check existence (in case deleted during wait)
          const exists = await Cards.exists({ _id: fodderCard._id });
          if (!exists) {
            return replyMsg.edit({ content: "❌ The material card is no longer available.", embeds: [], components: [] });
          }

          // --- EXECUTE ASCENSION ---
          
          // 1. Delete Fodder
          await Cards.deleteOne({ _id: fodderCard._id });

          // 2. Update Target Stats
          targetCard.ascension = (targetCard.ascension || 0) + 1;
          
          const oldStats = { ...targetCard.stats };

          // Apply Multipliers
          targetCard.stats.atk = Math.floor(targetCard.stats.atk * 1.0675);
          targetCard.stats.hp = Math.floor(targetCard.stats.hp * 1.10);
          targetCard.stats.def = Math.floor(targetCard.stats.def * 1.06);
          targetCard.stats.speed = Math.floor(targetCard.stats.speed * 1.025);

          await targetCard.save();

          // 3. Success Embed
          const successEmbed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle(`🎉 Ascension Successful!`)
            .setDescription(`**${targetMaster.name}** has transcended to **Ascension Rank ${targetCard.ascension}**!`)
            .setThumbnail(formatImage(targetMaster.image,110,140))
            .addFields({
              name: "Stat Improvements",
              value: `
              ⚔️ ATK: ${oldStats.atk} ➔ **${targetCard.stats.atk}**
              🩸 HP: ${oldStats.hp} ➔ **${targetCard.stats.hp}**
              🛡️ DEF: ${oldStats.def} ➔ **${targetCard.stats.def}**
              💨 SPD: ${oldStats.speed} ➔ **${targetCard.stats.speed}**
              `,
              inline: false
            });

          await replyMsg.edit({ content: null, embeds: [successEmbed], components: [] });
        }
      } catch (err) {
        console.error("Ascension Error:", err);
        replyMsg.edit({ content: "❌ An error occurred during the ritual.", embeds: [], components: [] });
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        replyMsg.edit({ content: "⌛ Ascension request timed out.", embeds: [], components: [] }).catch(() => {});
      }
    });

  } catch (error) {
    console.error("Ascension Command Error:", error);
    message.reply("An error occurred processing the command.");
  }
}

module.exports = { ascension };