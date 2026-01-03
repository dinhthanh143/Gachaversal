const { Index } = require("../db");
const { EmbedBuilder } = require("discord.js");

// ✅ Helper function to scale Cloudinary images or handle placeholders
function formatImage(url, width, height) {
  if (!url) return null;
  
  if (url.includes("res.cloudinary.com")) {
    return url.replace("/upload/", `/upload/w_${width},h_${height},c_fill/`);
  }
  
  if (url.includes("via.placeholder.com")) {
    return `https://via.placeholder.com/${width}x${height}?text=Mob`;
  }
  
  return url;
}

async function infoCard(message) {
  try {
    // 1. Get ID from args
    const args = message.content.split(" ");
    const searchId = parseInt(args[1]);

    if (isNaN(searchId)) {
      return message.reply("Please provide a valid Card ID (e.g., `!info 1`).");
    }

    // 2. SEARCH BY ID
    const pokemon = await Index.findOne({ pokeId: searchId });

    if (!pokemon) {
      return message.reply(`Could not find any card with ID **#${searchId}**.`);
    }

    // ====================================================
    // 🔄 UPDATED SKILL SCALING LOGIC
    // ====================================================
    let desc = pokemon.skill.description;

    // Check if values exist and iterate through them
    if (pokemon.skill.values && pokemon.skill.values.length > 0) {
      
      pokemon.skill.values.forEach((valueArray, index) => {
        // Ensure it is actually an array (handle the [[...]] structure)
        if (Array.isArray(valueArray) && valueArray.length > 0) {
          const min = valueArray[0];
          const max = valueArray[valueArray.length - 1];

          let replaceText = "";
          if (min === max) {
            replaceText = `${min}`;
          } else {
            replaceText = `**[${min} - ${max}]**`;
          }

          // Replace the specific placeholder {0}, {1}, etc.
          const regex = new RegExp(`\\{${index}\\}`, "g");
          desc = desc.replace(regex, replaceText);
        }
      });
    }
    // ====================================================
 
    // -- Image Scaling --
    const scaledImage = formatImage(pokemon.image, 250, 400);

    const embed = new EmbedBuilder()
      .setColor(pokemon.cardColor || "#ffffff") 
      .setTitle(`${pokemon.name} ${pokemon.type.split(" ")[1] || ""}`) 
      .setAuthor({
        name: `${message.author.username}`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .addFields(
        {
          name: "Info",
          value:
            `**Global ID:** ${pokemon.pokeId}\n` +
            `**Franchise:** ${pokemon.franchise}\n` +
            `**Type:** ${pokemon.type}\n` +
            `**ATK:** ${pokemon.stats.atk}\n` +
            `**HP:** ${pokemon.stats.hp}\n` +
            `**Speed:** ${pokemon.stats.speed}\n` +
            `**Defense:** ${pokemon.stats.def}`,
        },
        {
          name: `Skill: ${pokemon.skill.name} ${pokemon.skill.icon || ""}`,
          value: desc,
        }
      )
      .setImage(scaledImage)
      .setFooter({ text: "bottom text XD" });

    message.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    message.reply("Something blew up inside the bot.");
  }
}

module.exports = { infoCard, formatImage };