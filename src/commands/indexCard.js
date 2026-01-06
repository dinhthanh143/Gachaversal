const { Index } = require("../db");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

async function indexCard(message) {
  try {
    const args = message.content.split(" ").slice(1);
    let filter = {};
    let title = "Character Index";

    // --- 🔍 HANDLE FILTERS (-n, -t, or -f) ---
    if (args.length > 0) {
      const flag = args[0].toLowerCase();
      const query = args.slice(1).join(" "); // Joins remaining words

      if (flag === "-n" && query) {
        // Search by Name
        filter = { name: { $regex: query, $options: "i" } };
        title = `Index Search: Name containing "${query}"`;
      } else if (flag === "-t" && query) {
        // Search by Type
        filter = { type: { $regex: query, $options: "i" } };
        title = `Index Search: Type "${query}"`;
      } else if (flag === "-f" && query) {
        // ✅ NEW: Search by Franchise
        filter = { franchise: { $regex: query, $options: "i" } };
        title = `Index Search: Franchise "${query}"`;
      }
    }

    // --- 📂 FETCH DATA ---
    const allPoke = await Index.find(filter).sort({ pokeId: 1 });

    if (!allPoke || allPoke.length === 0) {
      return message.reply("❌ No characters found matching your criteria.");
    }

    // --- 📄 PAGINATION LOGIC ---
    const pageSize = 15;
    let page = 0;
    const totalPages = Math.ceil(allPoke.length / pageSize);

    const generateEmbed = () => {
      const start = page * pageSize;
      const end = start + pageSize;
      const currentList = allPoke.slice(start, end);

      const listText = currentList
        .map((p) => `**#${p.pokeId}** - ${p.name} ${p.type.split(" ")[1]}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(listText)
        .setThumbnail("https://res.cloudinary.com/pachi/image/upload/v1766809482/unnamed_fvqbhu.jpg")
        .setColor(0xffd600) 
        .setFooter({ text: `Page ${page + 1}/${totalPages} | Total Characters: ${allPoke.length}` });

      return embed;
    };

    // --- 🔘 BUTTONS ---
    if (totalPages === 1) {
      return message.reply({ embeds: [generateEmbed()] });
    }

    const prevBtn = new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Primary);

    const nextBtn = new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    const msg = await message.reply({
      embeds: [generateEmbed()],
      components: [row],
    });

    // --- 🖱️ INTERACTION COLLECTOR ---
    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: "Not your index!", ephemeral: true });
      }

      collector.resetTimer({ time: 60000 });

      if (interaction.customId === "prev") {
        page = page > 0 ? page - 1 : totalPages - 1;
      } else if (interaction.customId === "next") {
        page = page + 1 < totalPages ? page + 1 : 0;
      }

      await interaction.update({
        embeds: [generateEmbed()],
        components: [row],
      });
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });

  } catch (error) {
    console.error(error);
    message.reply("An error occurred while fetching the index.");
  }
}

module.exports = { indexCard };