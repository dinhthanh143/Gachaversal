const { Mobs } = require("../db");
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require("discord.js");


// ==========================================
function formatImage(url, width, height) {
  if (!url) return null;
  
  if (url.includes("res.cloudinary.com")) {
    // Adds w_{width},h_{height},c_fill (crop to fit) after /upload/
    return url.replace("/upload/", `/upload/w_${width},h_${height},c_fill/`);
  }
  
  if (url.includes("via.placeholder.com")) {
    return `https://via.placeholder.com/${width}x${height}?text=Mob`;
  }
  return url;
}

async function mobInfo(message) {
  try {
    const query = message.content.split(" ").slice(1).join(" ");

    if (!query) {
      return message.reply("Please provide a Mob name. (e.g., `!minfo slime`)");
    }

    const mob = await Mobs.findOne({ name: { $regex: query, $options: "i" } });

    if (!mob) {
      return message.reply(`❌ Could not find any mob matching "**${query}**".`);
    }

    let desc = mob.skill.description || "No description.";
    const val = mob.skill.values;

    if (Array.isArray(val) && val.length > 0) {
      const min = val[0];
      const max = val[val.length - 1];
      desc = desc.replace("{0}", min === max ? min : `**[${min} - ${max}]**`);
    } else if (typeof val === 'number') {
      desc = desc.replace("{0}", val);
    }

    const skillIcon = mob.skill.icon || "⚔️"; 
    
    // ✅ FORCE IMAGE SIZE HERE (e.g., 600px width, 350px height)
    const fixedImage = formatImage(mob.image, 350, 600);

    const embed = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle(`💀 ${mob.name} 💀`)
      .setAuthor({
        name: `${message.author.username}`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .addFields(
        {
          name: "ℹ️ Info",
          value: `**Spawns in:** Dungeon1\n**Type:** ${mob.type || "Neutral"}`,
          inline: true
        },
        {
            name: "💰 Drops",
            value: `**Gold** | **XP**`,
            inline: true
        },
        {
          name: `${skillIcon} Skill: ${mob.skill.name}`,
          value: desc,
          inline: false
        }
      )
      .setImage(fixedImage) 
      .setFooter({ text: `Weakness: N/A` }); 

    message.reply({ embeds: [embed] });

  } catch (err) {
    console.error(err);
    message.reply("Error fetching mob info.");
  }
}
// ==========================================
// 2. !mindex (Interactive Pagination)
// ==========================================
async function mobIndex(message) {
  try {
    const PAGE_SIZE = 10;
    const totalMobs = await Mobs.countDocuments();
    const totalPages = Math.ceil(totalMobs / PAGE_SIZE);

    if (totalMobs === 0) return message.reply("No Mobs found in database.");

    // Initial Page (from args or 1)
    const args = message.content.split(" ");
    let currentPage = parseInt(args[1]) || 1;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    // Helper to generate the Embed for a specific page
    const generateEmbed = async (page) => {
        const mobsOnPage = await Mobs.find()
            .sort({ enemyId: 1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        const list = mobsOnPage
            .map((m) => `**#${m.enemyId}** - ${m.name} (${m.type || "Neutral"})`)
            .join("\n");

        return new EmbedBuilder()
            .setTitle(`List of Mobs`)
            .setDescription(list || "No mobs here.")
            .setColor(0xffd600)
            .setFooter({ text: `Page ${page}/${totalPages} | Total Mobs: ${totalMobs}` });
    };

    // Helper to generate Buttons (Disable Prev on first, Next on last)
    const generateButtons = (page) => {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("mindex_prev")
                .setLabel("◀ Prev")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId("mindex_next")
                .setLabel("Next ▶")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages)
        );
        return row;
    };

    // Send Initial Message
    const initialEmbed = await generateEmbed(currentPage);
    const initialRow = generateButtons(currentPage);
    const msg = await message.reply({ embeds: [initialEmbed], components: [initialRow] });

    // Create Collector (Listens for clicks)
    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 60000 
    });

    collector.on("collect", async (interaction) => {
        // Security: Only original author can click
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({ content: "Not your menu.", ephemeral: true });
        }

        // Logic
        if (interaction.customId === "mindex_prev") {
            if (currentPage > 1) currentPage--;
        } else if (interaction.customId === "mindex_next") {
            if (currentPage < totalPages) currentPage++;
        }

        // Update Message
        const newEmbed = await generateEmbed(currentPage);
        const newRow = generateButtons(currentPage);
        
        await interaction.update({ embeds: [newEmbed], components: [newRow] });
    });

    // Disable buttons on timeout
    collector.on("end", () => {
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("prev").setLabel("◀ Prev").setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId("next").setLabel("Next ▶").setStyle(ButtonStyle.Primary).setDisabled(true)
        );
        msg.edit({ components: [disabledRow] }).catch(() => {});
    });

  } catch (error) {
    console.error(error);
    message.reply("Error fetching mob index.");
  }
}

module.exports = { mobInfo, mobIndex };