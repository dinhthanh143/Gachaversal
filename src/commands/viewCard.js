const { Cards, UserContainer } = require("../db");
const { getRarityStars } = require("../functions");
const { EmbedBuilder } = require("discord.js");
const { formatImage } = require("./infoCard");

async function view(message) {
  try {
    const args = message.content.split(" ").slice(1);
    const indexInput = parseInt(args[0]); 

    const userId = message.author.id;
    let user = await UserContainer.findOne({ userId });
    if (!user) return message.reply(`no account found`);

    if (isNaN(indexInput) || indexInput < 1) {
      return message.reply("Please provide a valid card number (e.g., `!view 1`).");
    }

    // ==========================================
    // 🔄 REPLICATE SORT LOGIC
    // ==========================================
    let userCards = await Cards.find({ ownerId: userId })
      .populate("masterData")
      .sort({ rarity: -1, level: -1, _id: -1 });

    const selectedIdStr = user.selectedCard ? user.selectedCard.toString() : null;

    userCards.sort((a, b) => {
      const aId = a._id.toString();
      const bId = b._id.toString();

      // 1. Selected First
      if (aId === selectedIdStr) return -1;
      if (bId === selectedIdStr) return 1;

      // 2. Fav Second
      if (a.fav && !b.fav) return -1;
      if (!a.fav && b.fav) return 1;

      // 3. Normal Sort (Already done by DB)
      return 0;
    });
    // ==========================================

    // GET TARGET CARD
    const cardIndex = indexInput - 1;
    const card = userCards[cardIndex];

    if (!card) return message.reply(`You don't have a card at number **${indexInput}**.`);
    if (!card.masterData) return message.reply("Error: Card data corrupted.");

    // PREPARE DATA
    const master = card.masterData;
    const rarityStars = getRarityStars(card.rarity);
    const xpCap = card.xpCap || 50;
    const favIcon = card.fav ? "❤️ " : "";

    // Skill Scaling Logic
    let finalSkillDesc = master.skill.description;
    if (master.skill.values && master.skill.values.length > 0) {
      const rarityIndex = card.rarity - 1;
      master.skill.values.forEach((valueArray, i) => {
        if (Array.isArray(valueArray) && valueArray.length > 0) {
          const val = valueArray[rarityIndex] !== undefined ? valueArray[rarityIndex] : valueArray[valueArray.length - 1];
          const regex = new RegExp(`\\{${i}\\}`, "g");
          finalSkillDesc = finalSkillDesc.replace(regex, val);
        }
      });
    }

    const scaledImg = formatImage(master.image, 330, 550);

    const embed = new EmbedBuilder()
      .setColor(master.cardColor || "#ffffff")
      .setAuthor({ name: `${message.author.username}'s Card`, iconURL: message.author.displayAvatarURL() })
      .setTitle(`${favIcon}${master.name} - Lv. ${card.level}`)
      .addFields(
        { name: "Info", value: `**Rarity:** ${rarityStars}\n**Type:** ${master.type}`, inline: false },
        { 
          name: "Stats", 
          value: `**ATK:** ${card.stats.atk}\n**HP:** ${card.stats.hp}\n**Speed:** ${card.stats.speed}\n**DEF:** ${card.stats.def}\n**XP:** ${card.xp} / ${xpCap}`, 
          inline: false 
        },
        { name: `Skill: ${master.skill.name} ${master.skill.icon}`, value: finalSkillDesc, inline: false }
      )
      .setImage(scaledImg)
      .setFooter({ text: `Card ID: ${card.id}` });

    return message.reply({ embeds: [embed] });

  } catch (error) {
    console.error(error);
    message.reply("Error viewing card.");
  }
}

module.exports = { view };