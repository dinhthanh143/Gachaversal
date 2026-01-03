const { Cards, UserContainer, Inventory } = require("../db");
const { getRarityStars } = require("../functions");
const items = require("../items/items");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
async function getSortedUserCards(userId) {
  const user = await UserContainer.findOne({ userId });
  if (!user) return null;

  // 1. Fetch All
  let userCards = await Cards.find({ ownerId: userId })
    .populate("masterData")
    .sort({ rarity: -1, level: -1, _id: -1 }); // Default DB Sort

  if (!userCards || userCards.length === 0) return [];

  // 2. Apply Custom Sort (Selected > Fav > Rarity/Level)
  const selectedIdStr = user.selectedCard ? user.selectedCard.toString() : null;

  userCards.sort((a, b) => {
    const aId = a._id.toString();
    const bId = b._id.toString();

    // Priority 1: Selected Card (Always #1)
    if (aId === selectedIdStr) return -1;
    if (bId === selectedIdStr) return 1;

    // Priority 2: Favorites
    if (a.fav && !b.fav) return -1;
    if (!a.fav && b.fav) return 1;

    // Priority 3: Keep existing DB sort order (Rarity/Level)
    return 0;
  });

  return userCards;
}

// ==========================================
// 🎒 INVENTORY COMMAND (!cards)
// ==========================================
async function cards(message) {
  try {
    const userId = message.author.id;
    const user = await UserContainer.findOne({ userId });

    // Use Shared Sort
    const userCards = await getSortedUserCards(userId);

    if (!userCards) return message.reply("No account found.");
    if (userCards.length === 0) return message.reply("You have no cards.");

    const pageSize = 7;
    let page = 0;
    const totalPages = Math.ceil(userCards.length / pageSize);

    const generateEmbed = () => {
      const start = page * pageSize;
      const end = start + pageSize;
      const pageCards = userCards.slice(start, end);

      const embed = new EmbedBuilder()
        .setColor("Random")
        .setThumbnail(message.author.displayAvatarURL())
        .setAuthor({
          name: `${message.author.username}'s Inventory`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`Card Inventory`)
        .setFooter({
          text: `Page ${page + 1}/${totalPages} | ${userCards.length} cards`,
        });

      const cardDesc = pageCards
        .map((card, index) => {
          if (!card.masterData) return `❌ **Unknown Card**`;

          const master = card.masterData;
          // Check if this specific card ID matches the user's selected ID
          const isSelected =
            user.selectedCard &&
            user.selectedCard.toString() === card._id.toString();
          let selectedDisplayment = "";
          // Formatting
          let prefix = `**#${start + index + 1}**`;
          if (isSelected) {
            selectedDisplayment = ` **[SELECTED]**`;
          } else {
            selectedDisplayment = "";
          }

          const favIcon = card.fav ? "❤️ " : "";

          return `${prefix} ‧ **${master.name}** | Lv.**${
            card.level
          }** | ${selectedDisplayment} ${favIcon}\n${getRarityStars(card.rarity)} • ${master.type} `;
        })
        .join("\n\n");

      embed.setDescription(cardDesc);
      return embed;
    };

    // Buttons
    const prevBtn = new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("◀")
      .setStyle(ButtonStyle.Primary);
    const nextBtn = new ButtonBuilder()
      .setCustomId("next")
      .setLabel("▶")
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    const msg = await message.reply({
      embeds: [generateEmbed()],
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({ time: 60000 });
    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id)
        return interaction.reply({ content: "Not yours!", ephemeral: true });
      collector.resetTimer({ time: 60000 });

      if (interaction.customId === "prev")
        page = page > 0 ? page - 1 : totalPages - 1;
      else if (interaction.customId === "next")
        page = page + 1 < totalPages ? page + 1 : 0;

      await interaction.update({
        embeds: [generateEmbed()],
        components: [row],
      });
    });
    collector.on("end", () => msg.edit({ components: [] }));
  } catch (e) {
    console.error(e);
    message.reply("Inventory error.");
  }
}

// ==========================================
// ❤️ FAVORITE COMMAND (!fav <index>)
// ==========================================
async function fav(message) {
  try {
    const args = message.content.split(" ").slice(1);
    const indexInput = parseInt(args[0]);
    const userId = message.author.id;

    if (isNaN(indexInput) || indexInput < 1) {
      return message.reply(
        "Please provide a valid card number (e.g., `!fav 2`)."
      );
    }

    // 1. GET CARDS WITH SAME SORT LOGIC
    const userCards = await getSortedUserCards(userId);
    if (!userCards || userCards.length === 0)
      return message.reply("No cards found.");

    // 2. FIND TARGET BY INDEX
    const cardIndex = indexInput - 1;
    const targetCard = userCards[cardIndex];

    if (!targetCard) {
      return message.reply(`Card #${indexInput} not found.`);
    }

    // 3. TOGGLE FAV
    targetCard.fav = !targetCard.fav;
    await targetCard.save();

    const status = targetCard.fav ? "❤️ **Favorited**" : "💔 **Unfavorited**";
    const cardName = targetCard.masterData
      ? targetCard.masterData.name
      : "Unknown Card";

    message.reply(`${status} ${getRarityStars(targetCard.rarity)} **${cardName}** Lv.**${targetCard.level}** `);
  } catch (err) {
    console.error(err);
    message.reply("Error updating favorites.");
  }
}
//inv
async function inv(message) {
  try {
    const userId = message.author.id;

    // 1. Check User Account
    let user = await UserContainer.findOne({ userId });
    if (!user) {
      return message.reply("You don't have an account yet. Use `!start`.");
    }

    // 2. Fetch Inventory
    const invData = await Inventory.findOne({ userId });

    // Filter out items with 0 amount (just in case)
    // If invData is null, create an empty list
    const userItems = invData ? invData.items.filter((i) => i.amount > 0) : [];

    // 3. CHECK EMPTY
    if (userItems.length === 0) {
      return message.reply("Your inventory is empty! Go get some loot.");
    }

    // --- PAGINATION SETUP ---
    const pageSize = 10;
    let page = 0;
    const totalPages = Math.ceil(userItems.length / pageSize);

    const generateEmbed = () => {
      const start = page * pageSize;
      const end = start + pageSize;
      const pageItems = userItems.slice(start, end);

      const embed = new EmbedBuilder()
        .setColor("#0099ff") // Blue for Inventory
        .setAuthor({
          name: `${message.author.username}'s inventory`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`Item Inventory`)
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({
          text: `Page ${page + 1}/${totalPages} | ${
            userItems.length
          } unique items`,
        });

      const desc = pageItems
        .map((item, index) => {
          // Look up static data from items.js
          const info = items[item.itemId];

          if (!info) {
            return `❌ **Unknown Item** (ID: ${item.itemId}) x${item.amount}`;
          }

          // Same style as cards: Bold Header + Quote Block Description
          return `**${info.emoji} ${info.name}** x${item.amount}
> ${info.description} • Type: ${info.type}`;
        })
        .join("\n\n");

      embed.setDescription(desc);
      return embed;
    };

    // --- BUTTONS ---
    const prevBtn = new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Primary);

    const nextBtn = new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Primary);

    // Disable buttons if there is only 1 page
    if (totalPages === 1) {
      prevBtn.setDisabled(true);
      nextBtn.setDisabled(true);
    }

    const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    const msg = await message.reply({
      embeds: [generateEmbed()],
      components: [row],
    });

    // If only 1 page, don't start the collector (saves memory)
    if (totalPages === 1) return;

    const collector = msg.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: "Not yours!", ephemeral: true });
      }

      collector.resetTimer({ time: 60000 }); // Reset timer on interaction

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

    collector.on("end", () => msg.edit({ components: [] }));
  } catch (e) {
    console.error(e);
    message.reply("Inventory exploded. Check console.");
  }
}

module.exports = { cards, inv, fav };
