const { UserContainer, Inventory } = require("../db");
const items = require("../items/items");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

// Visual Constants
const BORDER_THICK = "**▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬**";
const LINE_THIN = "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯";

async function shop(message) {
  try {
    const userId = message.author.id;
    let user = await UserContainer.findOne({ userId });

    if (!user) {
      return message.reply("You need an account to view the shop! Use `!start`.");
    }

    // 1. DYNAMIC CATALOG
    const shopList = Object.entries(items)
      .filter(([key, item]) => item.price !== undefined)
      .map(([key, item]) => ({
        itemId: key,
        ...item
      }));

    // 2. Fetch Inventory
    let inv = await Inventory.findOne({ userId });
    const getOwnedCount = (id) =>
      inv ? inv.items.find((i) => i.itemId === id)?.amount || 0 : 0;

    // 3. Pagination
    const pageSize = 5;
    let page = 0;
    const totalPages = Math.ceil(shopList.length / pageSize);

    // 4. GENERATE EMBED
    const generateShopInterface = async () => {
      user = await UserContainer.findOne({ userId });
      inv = await Inventory.findOne({ userId });

      const start = page * pageSize;
      const end = start + pageSize;
      const currentItems = shopList.slice(start, end);

      const embed = new EmbedBuilder()
        .setColor("#E0A64F") // ✨ Premium Merchant Gold
        .setTitle("🛒 General Store")
        .setThumbnail("https://cdn-icons-png.flaticon.com/512/3081/3081559.png")
        .setDescription(
          `${BORDER_THICK}\n` +
          `**👛 Your Wallet**\n` +
          `💰 **${user.gold}** Gold   💎 **${user.gem}** Gems\n` +
          `${BORDER_THICK}\n` +
          `*Type \`!buy [item_id]\` to purchase items.*`
        )
        .setFooter({ text: `Page ${page + 1}/${totalPages} • Have fun purchasing` });

      if (currentItems.length > 0) {
        currentItems.forEach((item) => {
          const owned = getOwnedCount(item.itemId);
          const currencyIcon = item.currency === "gem" ? "💎" : "💰";

          embed.addFields({
            name: `${item.emoji} ${item.name} \`(${item.itemId})\``,
            value: `> 🏷️ Price: **${item.price}** ${currencyIcon}\n> 🎒 In Bag: **${owned}**\n${LINE_THIN}`,
            inline: false,
          });
        });
      } else {
        embed.setDescription("The shelves are empty...");
      }

      // NAVIGATION
      const navRow = new ActionRowBuilder();
      const prevBtn = new ButtonBuilder().setCustomId("prev").setLabel("◀ Prev").setStyle(ButtonStyle.Primary);
      const nextBtn = new ButtonBuilder().setCustomId("next").setLabel("Next ▶").setStyle(ButtonStyle.Primary);

      if (totalPages <= 1) {
        prevBtn.setDisabled(true);
        nextBtn.setDisabled(true);
      }

      navRow.addComponents(prevBtn, nextBtn);
      return { embeds: [embed], components: [navRow] };
    };

    const initialData = await generateShopInterface();
    const msg = await message.reply(initialData);

    if (totalPages <= 1) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: 60000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: "Not yours.", ephemeral: true });
      }

      if (interaction.customId === "prev") {
        page = page > 0 ? page - 1 : totalPages - 1;
      } else if (interaction.customId === "next") {
        page = page + 1 < totalPages ? page + 1 : 0;
      }

      await interaction.update(await generateShopInterface());
    });

    collector.on("end", () => msg.edit({ components: [] }).catch(() => {}));
  } catch (error) {
    console.error(error);
    message.reply("Shop error.");
  }
}

module.exports = { shop };