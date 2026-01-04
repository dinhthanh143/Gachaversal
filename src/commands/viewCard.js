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
    if (!user) return message.reply(`No account found.`);

    if (isNaN(indexInput) || indexInput < 1) {
      return message.reply("Please provide a valid card number (e.g., `!view 1`).");
    }

    // ==========================================
    // 1. FETCH CARDS (STRICT CHRONOLOGICAL SORT)
    // ==========================================
    // Must match the updated "getSortedUserCards" logic from inventory
    // Sort: _id (Ascending) -> Oldest to Newest
    let userCards = await Cards.find({ ownerId: userId })
      .populate("masterData")
      .sort({ _id: 1 }); // ✅ CHANGED TO MATCH INVENTORY

    if (!userCards || userCards.length === 0) {
      return message.reply("You have no cards to view.");
    }

    // ==========================================
    // 2. GET TARGET BY INDEX
    // ==========================================
    // The input index maps directly to the array position
    const cardIndex = indexInput - 1;
    const card = userCards[cardIndex];

    if (!card) {
      return message.reply(`You don't have a card at number **#${indexInput}**.`);
    }
    
    if (!card.masterData) {
      return message.reply("Error: Card data corrupted (Master Data missing).");
    }

    // ==========================================
    // 3. PREPARE DISPLAY DATA
    // ==========================================
    const master = card.masterData;
    const rarityStars = getRarityStars(card.rarity);
    const xpCap = card.xpCap || 50; // Default if missing
    const favIcon = card.fav ? "❤️ " : "";
    
    // Check if Selected
    const isSelected = user.selectedCard && user.selectedCard.toString() === card._id.toString();
    const selectedText = isSelected ? " **[SELECTED]**" : "";

    // Skill Scaling Logic (Replace {0}, {1} placeholders)
    let finalSkillDesc = master.skill.description;
    if (master.skill.values && master.skill.values.length > 0) {
      // Rarity is 1-based, array is 0-based
      const rarityIndex = Math.max(0, card.rarity - 1);
      
      master.skill.values.forEach((valueArray, i) => {
        if (Array.isArray(valueArray) && valueArray.length > 0) {
          // Get value for this rarity, or fallback to last available value
          const val = valueArray[rarityIndex] !== undefined 
            ? valueArray[rarityIndex] 
            : valueArray[valueArray.length - 1];
            
          const regex = new RegExp(`\\{${i}\\}`, "g");
          finalSkillDesc = finalSkillDesc.replace(regex, val);
        }
      });
    }

    const scaledImg = await formatImage(master.image, 330, 550);

    const embed = new EmbedBuilder()
      .setColor(master.cardColor || "#ffffff")
      .setAuthor({ 
        name: `${message.author.username}'s Card`, 
        iconURL: message.author.displayAvatarURL() 
      })
      .setTitle(`${favIcon}${master.name} - Lv. ${card.level}${selectedText}`)
      .addFields(
        { 
          name: "Info", 
          value: `**Rarity:** ${rarityStars}\n**Type:** ${master.type}\n**Franchise:** ${master.franchise || "Unknown"}`, 
          inline: false 
        },
        { 
          name: "Stats", 
          value: `⚔️ **ATK:** ${card.stats.atk}\n🩸 **HP:** ${card.stats.hp}\n💨 **SPD:** ${card.stats.speed}\n🛡️ **DEF:** ${card.stats.def}\n✨ **XP:** ${card.xp} / ${xpCap}`, 
          inline: false 
        },
        { 
          name: `Skill: ${master.skill.name} ${master.skill.icon || ""}`, 
          value: finalSkillDesc, 
          inline: false 
        }
      )
      .setImage(scaledImg)
      .setFooter({ text: `Card Index: #${indexInput} | ID: ${master.pokeId}` });

    return message.reply({ embeds: [embed] });

  } catch (error) {
    console.error(error);
    message.reply("Error viewing card.");
  }
}

module.exports = { view };