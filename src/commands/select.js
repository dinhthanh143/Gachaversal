const { UserContainer, Cards } = require("../db");
const { getRarityStars } = require("../functions");
const { EmbedBuilder } = require("discord.js");
const { formatImage } = require("./infoCard");

async function select(message) {
  try {
    const args = message.content.split(" ").slice(1);
    const userId = message.author.id;

    // 1. Check User
    let user = await UserContainer.findOne({ userId });
    if (!user) {
      return message.reply("No Account. Try creating one first.");
    }

    // ====================================================
    // 🔍 CASE 1: NO ARGS -> VIEW SELECTED CARD
    // ====================================================
    if (args.length === 0) {
      if (!user.selectedCard) {
        return message.reply(
          "You don't have a unit selected! Use `!select <ID>` to equip one."
        );
      }

      // Fetch the specific selected card
      const card = await Cards.findById(user.selectedCard).populate("masterData");

      if (!card || !card.masterData) {
        return message.reply("Your selected card data is corrupted.");
      }

      // --- DATA PREP ---
      const master = card.masterData;
      const rarityStars = getRarityStars(card.rarity);
      const scaledImg = await formatImage(master.image, 330, 550);
      const xpCap = card.xpCap || 50;

      // Skill Scaling Logic
      let finalSkillDesc = master.skill.description;
      if (master.skill.values && master.skill.values.length > 0) {
        const rarityIndex = Math.max(0, card.rarity - 1);
        master.skill.values.forEach((valueArray, i) => {
          if (Array.isArray(valueArray) && valueArray.length > 0) {
            const val = valueArray[rarityIndex] !== undefined 
              ? valueArray[rarityIndex] 
              : valueArray[valueArray.length - 1];
            const regex = new RegExp(`\\{${i}\\}`, "g");
            finalSkillDesc = finalSkillDesc.replace(regex, val);
          }
        });
      }

      // Build Embed
      const embed = new EmbedBuilder()
        .setColor(master.cardColor || "#ffffff")
        .setAuthor({
          name: `${message.author.username}'s Selected Unit`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`${master.name} - Lv. ${card.level}`)
        .addFields({
          name: "Info",
          value: `**Rarity:** ${rarityStars}\n**Type:** ${master.type}`,
        })
        .addFields(
          {
            name: "Stats",
            value:
              `⚔️ **ATK:** ${card.stats.atk}\n` +
              `🩸 **HP:** ${card.stats.hp}\n` +
              `💨 **SPD:** ${card.stats.speed}\n` +
              `🛡️ **DEF:** ${card.stats.def}\n` +
              `✨ **XP:** ${card.xp} / ${xpCap}`,
          },
          {
            name: `Skill: ${master.skill.name} ${master.skill.icon || ""}`,
            value: finalSkillDesc,
          }
        )
        .setImage(scaledImg)
        .setFooter({ text: `Card ID: ${card.id}` });

      return message.reply({ embeds: [embed] });
    }

    // ====================================================
    // 🖱️ CASE 2: ARGS EXIST -> SELECT A NEW CARD
    // ====================================================
    const indexInput = parseInt(args[0]);

    if (isNaN(indexInput) || indexInput < 1) {
      return message.reply("Invalid ID. Try again (e.g., `!select 1`)");
    }

    // ✅ FETCH ALL & USE STABLE CHRONOLOGICAL SORT
    // Sort: _id (Ascending) -> Oldest to Newest
    let userCards = await Cards.find({ ownerId: userId })
      .populate("masterData")
      .sort({ _id: 1 }); // ✅ CHANGED TO MATCH INVENTORY

    if (!userCards || userCards.length === 0) {
        return message.reply("You have no cards.");
    }

    // Pick card by stable index (1-based from input maps directly to array index)
    const cardIndex = indexInput - 1;
    const card = userCards[cardIndex];

    if (!card) {
      return message.reply(`Card **#${indexInput}** not found in your inventory.`);
    }
    if (!card.masterData) {
      return message.reply("Card data corrupted.");
    }

    // Save Selection
    user.selectedCard = card._id;
    await user.save();

    // Success Message
    message.reply(
      `Successfully equipped **#${indexInput} ${card.masterData.name}** (Lv. ${card.level}) ${getRarityStars(card.rarity)}`
    );

  } catch (error) {
    console.error(error);
    message.reply("Error processing request.");
  }
}

module.exports = { select };