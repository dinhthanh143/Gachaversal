const { Cards, UserContainer, Inventory } = require("../db");
const { getRarityStars } = require("../functions");
const items = require("../items/items");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

function getAscIcon(ascension) {
  const ascLevel = typeof ascension === 'number' ? ascension : 0;
  switch (ascLevel) {
    case 0: return "<:a0:1457863898425462838>"; 
    case 1: return "<:a1:1457863289462722653>"; 
    case 2: return "<:a2:1457864187165544651>"; 
    case 3: return "<:a3:1457864607224827985>";
    case 4: return "<:a4:1457864604888862760>"; 
    case 5: return "<:a5:1457864893783871569>"; 
    case 6: return "<:a6:1457864985119162643>"; 
    default: return ""; 
  }
}

// =========================================================
// 1. FETCH CARDS
// =========================================================
async function getSortedUserCards(userId) {
  const user = await UserContainer.findOne({ userId });
  if (!user) return null;

  // Default DB Sort: Creation Time (Oldest -> Newest)
  let userCards = await Cards.find({ ownerId: userId })
    .populate("masterData")
    .sort({ _id: 1 }); 

  if (!userCards || userCards.length === 0) return [];
  return userCards;
}

// ==========================================
// 🎒 INVENTORY COMMAND (!cards)
// ==========================================
async function cards(message) {
  try {
    const userId = message.author.id;
    const user = await UserContainer.findOne({ userId });

    const rawCards = await getSortedUserCards(userId);

    if (!rawCards) return message.reply("No account found.");
    if (rawCards.length === 0) return message.reply("You have no cards (XD).");

    // ====================================================
    // ✅ STEP 1: ASSIGN STATIC DISPLAY ID
    // ====================================================
    let processedCards = rawCards.map((card, index) => {
      const c = card.toObject(); 
      // Use persistent UID if available, else fallback to current array position
      c.displayId = c.uid ? c.uid : (index + 1);
      c.masterData = card.masterData; 
      return c;
    });

    // ====================================================
    // 🔍 STEP 2: SEARCH / FILTER LOGIC
    // ====================================================
    const args = message.content.split(" ");
    
    const getArgValue = (flag) => {
      const index = args.indexOf(flag);
      if (index !== -1 && args[index + 1]) {
        let value = [];
        for (let i = index + 1; i < args.length; i++) {
          if (args[i].startsWith("-")) break;
          value.push(args[i]);
        }
        return value.join(" ").toLowerCase();
      }
      return null;
    };

    const searchName = getArgValue("-n");
    const searchType = getArgValue("-t");
    const searchRarity = getArgValue("-r");
    const searchFranchise = getArgValue("-f");
    const searchAscension = getArgValue("-a");

    if (searchName || searchType || searchRarity || searchFranchise || searchAscension) {
      processedCards = processedCards.filter(card => {
        const master = card.masterData;
        if (!master) return false;

        if (searchName && !master.name.toLowerCase().includes(searchName)) return false;
        if (searchType && !master.type.toLowerCase().includes(searchType)) return false;
        if (searchRarity && card.rarity !== parseInt(searchRarity)) return false;
        if (searchFranchise && master.franchise && !master.franchise.toLowerCase().includes(searchFranchise)) return false;
        if (searchAscension && card.ascension !== parseInt(searchAscension)) return false;

        return true;
      });

      if (processedCards.length === 0) {
        return message.reply("🔍 No cards matched your search criteria.");
      }
    }

    // ====================================================
    // 3. VISUAL SORT (Modified)
    // ====================================================
    const selectedIdStr = user.selectedCard ? user.selectedCard.toString() : null;

    const displayCards = [...processedCards].sort((a, b) => {
      const aId = a._id.toString();
      const bId = b._id.toString();

      // 1. Selected Card always top
      if (aId === selectedIdStr) return -1;
      if (bId === selectedIdStr) return 1;

      // 2. Favorites next
      if (a.fav && !b.fav) return -1;
      if (!a.fav && b.fav) return 1;

      // 3. Rarity (Highest to Lowest)
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;

      // 4. Index (Lowest to Highest) 
      // This keeps the chronological acquisition order strictly within rarity tiers.
      return a.displayId - b.displayId;
    });

    // --- PAGINATION SETUP ---
    const pageSize = 7;
    let page = 0;
    const totalPages = Math.ceil(displayCards.length / pageSize);

    const generateEmbed = () => {
      const start = page * pageSize;
      const end = start + pageSize;
      const pageCards = displayCards.slice(start, end);

      const embed = new EmbedBuilder()
        .setColor("Random")
        .setThumbnail(message.author.displayAvatarURL())
        .setAuthor({
          name: `${message.author.username}'s Inventory`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`Card Inventory`)
        .setFooter({
          text: `Page ${page + 1}/${totalPages} | ${displayCards.length} cards found`,
        });

      const cardDesc = pageCards
        .map((card) => {
          if (!card.masterData) return `❌ **Unknown Card**`;
          const master = card.masterData;

          const isSelected = selectedIdStr === card._id.toString();
          const selectedDisplayment = isSelected ? ` **[SELECTED]**` : "";
          const favIcon = card.fav ? "❤️ " : "";
          
          let prefix = `**#${card.displayId}**`; 

          return `${prefix} ‧ **${master.name}** | Lv.**${card.level}** | ${selectedDisplayment} ${favIcon}\n${getRarityStars(card.rarity)} • ${master.type} • Ascension: ${getAscIcon(card.ascension)}`;
        })
        .join("\n\n");

      embed.setDescription(cardDesc || "No cards found on this page.");
      return embed;
    };

    // Buttons
    const prevBtn = new ButtonBuilder().setCustomId("prev").setLabel("◀").setStyle(ButtonStyle.Primary);
    const nextBtn = new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle(ButtonStyle.Primary);

    if (totalPages <= 1) {
        prevBtn.setDisabled(true);
        nextBtn.setDisabled(true);
    }

    const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    const msg = await message.reply({ embeds: [generateEmbed()], components: [row] });

    if (totalPages <= 1) return;

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id)
        return interaction.reply({ content: "Not yours!", ephemeral: true });

      collector.resetTimer({ time: 60000 });

      if (interaction.customId === "prev") page = page > 0 ? page - 1 : totalPages - 1;
      else if (interaction.customId === "next") page = page + 1 < totalPages ? page + 1 : 0;

      await interaction.update({ embeds: [generateEmbed()], components: [row] });
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
      return message.reply("Please provide a valid card number (e.g., `!fav 2`).");
    }

    const userCards = await getSortedUserCards(userId);
    if (!userCards || userCards.length === 0) return message.reply("No cards found.");

    // Match by Persistent UID first, fallback to Index
    const targetCard = userCards.find((c, i) => {
        const currentId = c.uid ? c.uid : (i + 1);
        return currentId === indexInput;
    });

    if (!targetCard) {
      return message.reply(`Card #${indexInput} not found.`);
    }

    targetCard.fav = !targetCard.fav;
    await targetCard.save();

    const status = targetCard.fav ? "❤️ **Favorited**" : "💔 **Unfavorited**";
    const cardName = targetCard.masterData ? targetCard.masterData.name : "Unknown Card";

    message.reply(`${status} ${getRarityStars(targetCard.rarity)} **${cardName}** Lv.**${targetCard.level}**`);
  } catch (err) {
    console.error(err);
    message.reply("Error updating favorites.");
  }
}

// ==========================================
// 🎒 ITEM INVENTORY COMMAND (!inv)
// ==========================================
async function inv(message) {
  try {
    const userId = message.author.id;
    let user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("You don't have an account yet. Use `!start`.");
    
    const invData = await Inventory.findOne({ userId });
    const userItems = invData ? invData.items.filter((i) => i.amount > 0) : [];

    if (userItems.length === 0) return message.reply("Your inventory is empty! Go get some loot.");

    const pageSize = 7;
    let page = 0;
    const totalPages = Math.ceil(userItems.length / pageSize);

    const generateEmbed = () => {
      const start = page * pageSize;
      const end = start + pageSize;
      const pageItems = userItems.slice(start, end);

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setAuthor({ name: `${message.author.username}'s inventory`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTitle(`Item Inventory`)
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `Page ${page + 1}/${totalPages} | ${userItems.length} unique items | !useitem [ID] [QUANTITY] to use!`, });

      const desc = pageItems.map((item) => {
          const info = items[item.itemId];
          if (!info) return `❌ **Unknown Item** (ID: ${item.itemId}) x${item.amount}`;
          return `**${info.emoji} ${info.name}** (ID: \`${item.itemId}\`) x${item.amount}\n> ${info.description} • Type: ${info.type}`;
        }).join("\n\n");

      embed.setDescription(desc);
      return embed;
    };

    const prevBtn = new ButtonBuilder().setCustomId("prev").setLabel("◀ Prev").setStyle(ButtonStyle.Primary);
    const nextBtn = new ButtonBuilder().setCustomId("next").setLabel("Next ▶").setStyle(ButtonStyle.Primary);

    if (totalPages === 1) { prevBtn.setDisabled(true); nextBtn.setDisabled(true); }

    const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
    const msg = await message.reply({ embeds: [generateEmbed()], components: [row] });

    if (totalPages === 1) return;

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id) return interaction.reply({ content: "Not yours!", ephemeral: true });
      collector.resetTimer({ time: 60000 });
      if (interaction.customId === "prev") page = page > 0 ? page - 1 : totalPages - 1;
      else if (interaction.customId === "next") page = page + 1 < totalPages ? page + 1 : 0;
      await interaction.update({ embeds: [generateEmbed()], components: [row] });
    });

    collector.on("end", () => msg.edit({ components: [] }));
  } catch (e) {
    console.error(e);
    message.reply("Inventory exploded. Check console.");
  }
}

module.exports = { cards, inv, fav, getAscIcon };