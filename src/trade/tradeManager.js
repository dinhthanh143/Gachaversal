const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { Trade, UserContainer, Cards, Inventory } = require("../db");
const {
  isUserTrading,
  setUserTrading,
  removeUserTrading,
  isUserBattling,
} = require("../utils/activeStates");
const itemsList = require("../items/items");
const { getRarityStars, getNextUid } = require("../functions");
const { getAscIcon } = require("../commands/inv_cards");



async function checkActiveTrade(userId) {
  return await Trade.findOne({
    $or: [{ senderId: userId }, { receiverId: userId }],
  });
}

async function getActiveTrade(userId) {
  return await Trade.findOne({
    $or: [{ senderId: userId }, { receiverId: userId }],
  });
}

async function getUsernames(client, senderId, receiverId) {
  let sName = "User 1";
  let rName = "User 2";
  try {
    const sUser = await client.users.fetch(senderId);
    const rUser = await client.users.fetch(receiverId);
    if (sUser) sName = sUser.username;
    if (rUser) rName = rUser.username;
  } catch (e) {
    console.log("Could not fetch usernames for trade dashboard");
  }
  return { sName, rName };
}


function formatItemOffer(itemsArr) {
  if (!itemsArr || itemsArr.length === 0) return "None";
  const lines = itemsArr.map((i) => {
    const itemDef = itemsList[i.itemId];
    const name = itemDef ? itemDef.name : "Unknown Item";
    const emoji = itemDef ? itemDef.emoji : "";
    return `x${i.amount} ${emoji}**${name}** (\`${i.itemId}\`)`;
  });
  return lines.length > 0 ? lines.join("\n") : "None";
}

async function formatCardOffer(cardIds) {
  if (!cardIds || cardIds.length === 0) return "None";
  const fullCards = await Cards.find({ _id: { $in: cardIds } }).populate(
    "masterData"
  );
  if (!fullCards || fullCards.length === 0) return "None";

  const groups = {};
  for (const card of fullCards) {
    if (!card.masterData) continue;
    const key = `${card.cardId}_${card.rarity}_${card.level}_${card.ascension}`;
    if (!groups[key]) {
      groups[key] = {
        count: 0,
        name: card.masterData.name,
        rarity: card.rarity,
        level: card.level,
        ascension: card.ascension,
      };
    }
    groups[key].count++;
  }

  const lines = Object.values(groups).map((g) => {
    const stars = getRarityStars(g.rarity);
    const ascIcon = getAscIcon(g.ascension);
    return `x${g.count} **${g.name}** ${stars} [Lv.${g.level}] ${ascIcon}`;
  });
  return lines.length > 0 ? lines.join("\n") : "None";
}


async function generateTradeDashboard(client, tradeDoc) {
  const { sName, rName } = await getUsernames(
    client,
    tradeDoc.senderId,
    tradeDoc.receiverId
  );

  const sCardsStr = await formatCardOffer(tradeDoc.offers.sender.cards);
  const sItemsStr = formatItemOffer(tradeDoc.offers.sender.items);
  // ✅ Format Gold
  const sGold =
    tradeDoc.offers.sender.gold > 0
      ? `💰 **${tradeDoc.offers.sender.gold.toLocaleString()}** Gold`
      : "None";

  const rCardsStr = await formatCardOffer(tradeDoc.offers.receiver.cards);
  const rItemsStr = formatItemOffer(tradeDoc.offers.receiver.items);
  // ✅ Format Gold
  const rGold =
    tradeDoc.offers.receiver.gold > 0
      ? `💰 **${tradeDoc.offers.receiver.gold.toLocaleString()}** Gold`
      : "None";

  const safeVal = (str) => (str && str.trim().length > 0 ? str : "None");

  const embed = new EmbedBuilder()
    .setColor("#00AAFF")
    .setTitle(`🤝 Active Trade System`)
    .setDescription(
      `**${sName}** ↔️ **${rName}**\n\nTrade is active! Use commands to add items/cards/gold.`
    )
    .addFields(
      {
        name: `👤 ${sName} (Sender)`,
        // ✅ Added Gold Field
        value: `**Gold:** ${sGold}\n**Cards:**\n${safeVal(
          sCardsStr
        )}\n\n**Items:**\n${safeVal(sItemsStr)}\n\n${
          tradeDoc.offers.sender.confirmed
            ? "✅ **Confirmed**"
            : "⏳ *Waiting...*"
        }`,
        inline: true,
      },
      {
        name: `👤 ${rName} (Receiver)`,
        // ✅ Added Gold Field
        value: `**Gold:** ${rGold}\n**Cards:**\n${safeVal(
          rCardsStr
        )}\n\n**Items:**\n${safeVal(rItemsStr)}\n\n${
          tradeDoc.offers.receiver.confirmed
            ? "✅ **Confirmed**"
            : "⏳ *Waiting...*"
        }`,
        inline: true,
      }
    )
    .setFooter({ text: `Trade ID: ${tradeDoc._id} | Expires in 10 mins` })
    .setTimestamp();

  return embed;
}

async function updateTradeDashboardMessage(message, tradeDoc) {
  const dashboard = await generateTradeDashboard(message.client, tradeDoc);
  try {
    const channel = await message.client.channels.fetch(tradeDoc.channelId);
    if (!channel) throw new Error("Channel not found");
    const msg = await channel.messages.fetch(tradeDoc.messageId);
    if (!msg) throw new Error("Message not found");
    await msg.edit({ embeds: [dashboard] });
  } catch (err) {
    console.log("Trade dashboard missing, creating new one...");
    const newMsg = await message.channel.send({ embeds: [dashboard] });
    tradeDoc.channelId = message.channel.id;
    tradeDoc.messageId = newMsg.id;
    await tradeDoc.save();
  }
}

// ==========================================
// 2. CORE LOGIC: EXECUTE SWAP (DB ALIGNED)
// ==========================================
async function executeTradeSwap(trade) {
  // 1. Fetch Users first (Need them for Gold AND un-equipping logic)
  const senderUser = await UserContainer.findOne({ userId: trade.senderId });
  const receiverUser = await UserContainer.findOne({ userId: trade.receiverId });

  // Helper to safely compare ObjectIds
  const isEquipped = (user, cardId) => 
    user.selectedCard && user.selectedCard.toString() === cardId.toString();

  // -------------------------------------------------
  // A. Process Sender's Cards (Giving to Receiver)
  // -------------------------------------------------
  if (trade.offers.sender.cards.length > 0) {
    for (const cardId of trade.offers.sender.cards) {
      const card = await Cards.findById(cardId);
      if (card) {
        // 1. Check if Sender had this equipped. If so, unequip it.
        if (senderUser && isEquipped(senderUser, card._id)) {
          senderUser.selectedCard = null;
        }

        // 2. Transfer ownership
        const newUid = await getNextUid(trade.receiverId);
        card.ownerId = trade.receiverId;
        card.uid = newUid; 
        card.fav = false; 
        // REMOVED: card.selectedCard = null (Doesn't exist on Card schema)
        
        await card.save();
      }
    }
  }

  // -------------------------------------------------
  // B. Process Receiver's Cards (Giving to Sender)
  // -------------------------------------------------
  if (trade.offers.receiver.cards.length > 0) {
    for (const cardId of trade.offers.receiver.cards) {
      const card = await Cards.findById(cardId);
      if (card) {
        // 1. Check if Receiver had this equipped. If so, unequip it.
        if (receiverUser && isEquipped(receiverUser, card._id)) {
          receiverUser.selectedCard = null;
        }

        // 2. Transfer ownership
        const newUid = await getNextUid(trade.senderId);
        card.ownerId = trade.senderId;
        card.uid = newUid;
        card.fav = false; 
        
        await card.save();
      }
    }
  }

  // -------------------------------------------------
  // C. Swap Items
  // -------------------------------------------------
  const processItems = async (sourceId, targetId, items) => {
    if (!items || items.length === 0) return;
    const sourceInv = await Inventory.findOne({ userId: sourceId });
    let targetInv = await Inventory.findOne({ userId: targetId });
    if (!targetInv) targetInv = await Inventory.create({ userId: targetId, items: [] });

    for (const item of items) {
      const sItem = sourceInv.items.find((i) => i.itemId === item.itemId);
      if (sItem) sItem.amount = Math.max(0, sItem.amount - item.amount);
      
      const tItem = targetInv.items.find((i) => i.itemId === item.itemId);
      if (tItem) tItem.amount += item.amount;
      else targetInv.items.push({ itemId: item.itemId, amount: item.amount });
    }
    await sourceInv.save();
    await targetInv.save();
  };

  await processItems(trade.senderId, trade.receiverId, trade.offers.sender.items);
  await processItems(trade.receiverId, trade.senderId, trade.offers.receiver.items);

  // -------------------------------------------------
  // D. Swap Gold & Save User Changes
  // -------------------------------------------------
  if (trade.offers.sender.gold > 0 || trade.offers.receiver.gold > 0) {
    // Deduct
    senderUser.gold -= trade.offers.sender.gold;
    receiverUser.gold -= trade.offers.receiver.gold;

    // Add
    senderUser.gold += trade.offers.receiver.gold;
    receiverUser.gold += trade.offers.sender.gold;
  }

  // Save the users (This saves Gold changes AND selectedCard changes)
  if (senderUser) await senderUser.save();
  if (receiverUser) await receiverUser.save();
}

// ==========================================
// 3. COMMAND: INITIATE TRADE
// ==========================================
async function initiateTrade(message) {
  const sender = message.author;
  const target = message.mentions.users.first();

  try {
    if (!target) return message.reply("⚠️ Usage: `!trade @User`");
    if (target.id === sender.id)
      return message.reply("⚠️ You cannot trade with yourself.");
    if (target.bot) return message.reply("⚠️ You cannot trade with bots.");

    if (isUserTrading(sender.id))
      return message.reply("⚠️ You are already busy with a trade request!");
    if (isUserTrading(target.id))
      return message.reply(
        `⚠️ **${target.username}** is busy with another trade.`
      );
    if (isUserBattling && isUserBattling(sender.id))
      return message.reply("⚠️ You cannot trade while battling!");

    if (await checkActiveTrade(sender.id))
      return message.reply(
        "⚠️ You already have an active trade open in the database."
      );
    if (await checkActiveTrade(target.id))
      return message.reply(
        `⚠️ **${target.username}** is already in another trade.`
      );

    const senderProfile = await UserContainer.findOne({ userId: sender.id });
    const targetProfile = await UserContainer.findOne({ userId: target.id });
    if (!senderProfile || !targetProfile)
      return message.reply("❌ Both users must have an account (`!start`).");

    setUserTrading(sender.id);
    setUserTrading(target.id);

    const requestEmbed = new EmbedBuilder()
      .setColor("#FFAA00")
      .setTitle("🤝 Trade Request")
      .setDescription(
        `**${sender.username}** wants to trade with you, **${target}**!\n\nDo you accept?`
      )
      .setFooter({ text: "Expires in 1 minute" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_trade")
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("decline_trade")
        .setLabel("Decline")
        .setStyle(ButtonStyle.Danger)
    );

    const requestMsg = await message.channel.send({
      content: `${target}`,
      embeds: [requestEmbed],
      components: [row],
    });

    const filter = (i) => i.user.id === target.id;
    const collector = requestMsg.createMessageComponentCollector({
      filter,
      time: 60000,
      componentType: ComponentType.Button,
    });

    collector.on("collect", async (interaction) => {
      try {
        await interaction.deferUpdate();

        if (interaction.customId === "decline_trade") {
          await requestMsg.edit({
            content: null,
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription(
                  `❌ **${target.username}** declined the trade.`
                ),
            ],
            components: [],
          });
          collector.stop("declined");
        } else if (interaction.customId === "accept_trade") {
          const newTrade = await Trade.create({
            senderId: sender.id,
            receiverId: target.id,
            channelId: message.channel.id,
            offers: {
              sender: { confirmed: false, cards: [], items: [], gold: 0 },
              receiver: { confirmed: false, cards: [], items: [], gold: 0 },
            },
          });

          const dashboard = await generateTradeDashboard(
            message.client,
            newTrade
          );
          const dashboardMsg = await requestMsg.edit({
            content: null,
            embeds: [dashboard],
            components: [],
          });

          newTrade.messageId = dashboardMsg.id;
          await newTrade.save();

          collector.stop("accepted");

          setTimeout(async () => {
            try {
              const tradeExists = await Trade.findById(newTrade._id);
              if (tradeExists) {
                await Trade.deleteOne({ _id: newTrade._id });
                removeUserTrading(sender.id);
                removeUserTrading(target.id);
                const timeoutEmbed = new EmbedBuilder()
                  .setColor("#36393f")
                  .setTitle("⌛ Trade Timed Out")
                  .setDescription(
                    `The trade session between ${sender} and ${target} has expired due to inactivity.\n\n*Trade cancelled & session closed.*`
                  );
                await dashboardMsg.edit({
                  embeds: [timeoutEmbed],
                  components: [],
                });
              }
            } catch (err) {
              console.error(err);
            }
          }, 600000);
        }
      } catch (err) {
        console.error(err);
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time" || reason === "declined") {
        removeUserTrading(sender.id);
        removeUserTrading(target.id);
      }
      if (reason === "time") {
        requestMsg
          .edit({
            content: null,
            embeds: [
              new EmbedBuilder()
                .setColor("#808080")
                .setDescription(
                  `⚠️ Trade request to **${target.username}** timed out.`
                ),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  } catch (error) {
    console.error("Trade Error:", error);
    message.reply("An error occurred.");
    removeUserTrading(sender.id);
    if (target) removeUserTrading(target.id);
  }
}

// ==========================================
// 4. COMMANDS
// ==========================================

async function cancelTrade(message) {
  const userId = message.author.id;
  const trade = await getActiveTrade(userId);
  if (!trade) return message.reply("⚠️ You are not in an active trade.");
  message.reply(
    `<@${trade.senderId}> has cancelled their trade with <@${trade.receiverId}>`
  );
  await Trade.deleteOne({ _id: trade._id });
  removeUserTrading(trade.senderId);
  removeUserTrading(trade.receiverId);

  const embed = new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("❌ Trade Cancelled")
    .setDescription(`The trade was cancelled by <@${userId}>.`);
  try {
    const channel = await message.client.channels.fetch(trade.channelId);
    const msg = await channel.messages.fetch(trade.messageId);
    await msg.edit({ embeds: [embed] });
  } catch (e) {
    message.channel.send({ embeds: [embed] });
  }
}

// ✅ NEW: ADD GOLD COMMAND
async function addGoldToTrade(message) {
  const userId = message.author.id;
  const args = message.content.split(" ");
  const trade = await getActiveTrade(userId);
  if (!trade) return message.reply("⚠️ You are not in an active trade.");

  let amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0)
    return message.reply("Usage: `!addgold [Amount]` (e.g. `!addgold 500`)");

  const userProfile = await UserContainer.findOne({ userId });

  // Check total gold (Already Offered + New Amount) vs Wallet
  const side = trade.senderId === userId ? "sender" : "receiver";
  const currentOffered = trade.offers[side].gold || 0;

  if (userProfile.gold < currentOffered + amount) {
    return message.reply(
      `❌ Insufficient funds. Wallet: **${userProfile.gold}**, Current Offer: **${currentOffered}**, Attempting to add: **${amount}**.`
    );
  }

  // Add gold
  trade.offers[side].gold += amount;

  // Reset Confirm
  trade.offers.sender.confirmed = false;
  trade.offers.receiver.confirmed = false;

  await trade.save();
  message
    .reply(`✅ Added **${amount}** Gold to offer.`)
    .then((m) => setTimeout(() => m.delete(), 5000));
  await updateTradeDashboardMessage(message, trade);
}

// ✅ NEW: RESET COMMAND
async function resetTradeOffer(message) {
  const userId = message.author.id;
  const trade = await getActiveTrade(userId);
  if (!trade) return message.reply("⚠️ You are not in an active trade.");

  const side = trade.senderId === userId ? "sender" : "receiver";

  // Clear everything
  trade.offers[side].cards = [];
  trade.offers[side].items = [];
  trade.offers[side].gold = 0;

  // Reset Confirm
  trade.offers.sender.confirmed = false;
  trade.offers.receiver.confirmed = false;

  await trade.save();
  message
    .reply(`🔄 Reset your trade offer.`)
    .then((m) => setTimeout(() => m.delete(), 5000));
  await updateTradeDashboardMessage(message, trade);
}

async function addCardToTrade(message) {
  const userId = message.author.id;
  const trade = await getActiveTrade(userId);
  if (!trade) return message.reply("⚠️ You are not in an active trade.");

  const side = trade.senderId === userId ? "sender" : "receiver";
  const args = message.content.split(" ");
  let cardsToAdd = [];

  // ---------------------------------------------------------
  // 1. DIRECT INDEX SELECTION (e.g. !addcard 5)
  // ---------------------------------------------------------
  if (args[1] && !args[1].startsWith("-") && !isNaN(parseInt(args[1]))) {
    const indexInput = parseInt(args[1]);

    // Sort by _id to match your inventory display order
    const userCards = await Cards.find({ ownerId: userId }).sort({ _id: 1 });

    const targetCard = userCards.find((c, i) => {
      const displayId = c.uid ? c.uid : i + 1;
      return displayId === indexInput;
    });

    if (targetCard) cardsToAdd.push(targetCard);
    else return message.reply(`❌ Card **#${indexInput}** not found in your inventory.`);
  }
  // ---------------------------------------------------------
  // 2. FILTER SELECTION (e.g. !addcard -t water, fire)
  // ---------------------------------------------------------
  else {
    const getArgValue = (flag) => {
      const index = args.indexOf(flag);
      if (index !== -1 && args[index + 1]) {
        let value = [];
        for (let i = index + 1; i < args.length; i++) {
          if (args[i].startsWith("-")) break; // Stop at next flag
          value.push(args[i]);
        }
        return value.join(" ").toLowerCase(); // Returns "water, fire" string
      }
      return null;
    };

    const searchName = getArgValue("-n");
    const searchType = getArgValue("-t");
    const searchRarity = getArgValue("-r");
    const searchFranchise = getArgValue("-f");
    const searchAscension = getArgValue("-a");

    if (!searchName && !searchType && !searchRarity && !searchFranchise && !searchAscension) {
      return message.reply("⚠️ Usage: `!addcard [index]` OR `!addcard -t water, fire`.");
    }

    let userCards = await Cards.find({ ownerId: userId }).populate("masterData");

    const matchesList = (targetValue, searchValue) => {
      if (!searchValue) return true;
      if (!targetValue) return false;
      const searches = searchValue.split(",").map((s) => s.trim());
      return searches.some((s) => targetValue.toLowerCase().includes(s));
    };

    cardsToAdd = userCards.filter((card) => {
      const master = card.masterData;
      if (!master) return false;

      if (card.fav) return false;

      if (!matchesList(master.name, searchName)) return false;
      if (!matchesList(master.type, searchType)) return false;
      if (!matchesList(master.franchise, searchFranchise)) return false;

      if (searchRarity) {
        const rarities = searchRarity.split(",").map((n) => parseInt(n));
        if (!rarities.includes(card.rarity)) return false;
      }

      if (searchAscension) {
        const ascs = searchAscension.split(",").map((n) => parseInt(n));
        if (!ascs.includes(card.ascension)) return false;
      }

      return true;
    });
  }

  // ---------------------------------------------------------
  // 3. TEAM CHECK (NEW)
  // ---------------------------------------------------------
  if (cardsToAdd.length > 0) {
    const user = await UserContainer.findOne({ userId });

    // If user has a team, check against it
    if (user && user.team && user.team.length > 0) {
      // Find a card in 'cardsToAdd' that exists in 'user.team'
      // user.team contains UIDs (numbers), cardsToAdd are Objects with .uid
      const teamConflict = cardsToAdd.find((c) => user.team.includes(c.uid));

      if (teamConflict) {
        return message.reply(
          `🚫 Card **#${teamConflict.uid}** is currently on your team, remove it first.`
        );
      }
    }
  }

  // ---------------------------------------------------------
  // 4. ADD TO TRADE
  // ---------------------------------------------------------
  if (cardsToAdd.length === 0) return message.reply("🔍 No cards found to add.");

  const currentOfferIds = trade.offers[side].cards.map((id) => id.toString());

  // Filter out duplicates (already in offer)
  const newCards = cardsToAdd.filter((c) => !currentOfferIds.includes(c._id.toString()));

  if (newCards.length === 0)
    return message.reply("⚠️ All selected cards are already in the offer.");

  const newIds = newCards.map((c) => c._id);
  trade.offers[side].cards.push(...newIds);

  // Reset Confirmation
  trade.offers.sender.confirmed = false;
  trade.offers.receiver.confirmed = false;

  await trade.save();

  message
    .reply(`✅ Added **${newCards.length}** cards to offer.`)
    .then((m) => setTimeout(() => m.delete(), 5000));

  await updateTradeDashboardMessage(message, trade);
}

async function addItemToTrade(message) {
  const userId = message.author.id;
  const args = message.content.split(" ");
  const trade = await getActiveTrade(userId);
  if (!trade) return message.reply("⚠️ You are not in an active trade.");
  const itemId = args[1];
  const amount = parseInt(args[2]);
  if (!itemId || isNaN(amount) || amount <= 0)
    return message.reply("Usage: `!additem [ItemID] [Amount]`");

  const inv = await Inventory.findOne({ userId });
  const itemInInv = inv ? inv.items.find((i) => i.itemId === itemId) : null;
  if (!itemInInv || itemInInv.amount < amount)
    return message.reply(
      `❌ Not enough **${itemId}**. You have: ${
        itemInInv ? itemInInv.amount : 0
      }.`
    );

  const side = trade.senderId === userId ? "sender" : "receiver";
  const existingOffer = trade.offers[side].items.find(
    (i) => i.itemId === itemId
  );
  const currentOfferedAmount = existingOffer ? existingOffer.amount : 0;

  if (itemInInv.amount < currentOfferedAmount + amount)
    return message.reply(
      `❌ Insufficient items (Total needed: ${
        currentOfferedAmount + amount
      }, You have: ${itemInInv.amount}).`
    );

  if (existingOffer) existingOffer.amount += amount;
  else trade.offers[side].items.push({ itemId, amount });

  trade.offers.sender.confirmed = false;
  trade.offers.receiver.confirmed = false;

  await trade.save();
  message
    .reply(`✅ Added **${amount}x ${itemId}** to offer.`)
    .then((m) => setTimeout(() => m.delete(), 5000));
  await updateTradeDashboardMessage(message, trade);
}

async function confirmTrade(message) {
  const userId = message.author.id;
  const trade = await getActiveTrade(userId);
  if (!trade) return message.reply("⚠️ You are not in an active trade.");
  const side = trade.senderId === userId ? "sender" : "receiver";
  trade.offers[side].confirmed = true;
  await trade.save();
  if (trade.offers.sender.confirmed && trade.offers.receiver.confirmed) {
    try {
      await executeTradeSwap(trade);
      await Trade.deleteOne({ _id: trade._id });
      removeUserTrading(trade.senderId);
      removeUserTrading(trade.receiverId);
      message.reply(
        `<@${trade.senderId}> has successfully traded with <@${trade.receiverId}>`
      );
      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("✅ Trade Completed!")
        .setDescription(`<@${trade.senderId}> has successfully traded with <@${trade.receiverId}>`);
      try {
        const channel = await message.client.channels.fetch(trade.channelId);
        const msg = await channel.messages.fetch(trade.messageId);
        await msg.edit({ embeds: [embed] });
      } catch (e) {
        message.channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error(err);
      return message.channel.send("❌ Critical Error. Contact Admin.");
    }
  } else {
    await updateTradeDashboardMessage(message, trade);
    message.delete().catch(() => {});
  }
}

module.exports = {
  initiateTrade,
  addCardToTrade,
  addItemToTrade,
  confirmTrade,
  cancelTrade,
  addGoldToTrade,
  resetTradeOffer,
};
