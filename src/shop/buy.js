const { goldIcon } = require("../commands/hourly_daily_weekly");
const { UserContainer, Inventory } = require("../db");
const items = require("../items/items");
const { updateQuestProgress } = require("../quest/questManager"); 
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require("discord.js");

async function buy(message) {
  try {
    const userId = message.author.id;
    const args = message.content.split(" ");
    
    // 1. Validation
    if (args.length < 2) {
      return message.reply("Usage: `!buy [item_id] [amount]` (e.g., `!buy b1 5`)");
    }

    const itemId = args[1].toLowerCase();
    const amount = parseInt(args[2]) || 1; 

    if (isNaN(amount) || amount <= 0) {
      return message.reply("❌ Please enter a valid positive amount.");
    }

    let user = await UserContainer.findOne({ userId });
    if (!user) {
      return message.reply("You don't have an account. Start with `!start`.");
    }

    const itemToBuy = items[itemId];
    if (!itemToBuy || !itemToBuy.price) {
      return message.reply(
        "❌ **Item not found** or not for sale.\nCheck the `!shop` for a list of valid item IDs."
      );
    }

    const totalPrice = itemToBuy.price * amount;
    const currency = itemToBuy.currency; 
    const userBalance = user[currency]; 
    const currencyIcon = currency === "gem" ? "💎" : goldIcon;

    // 2. Pre-check Balance
    if (userBalance < totalPrice) {
      return message.reply(
        `❌ **Insufficient Funds!**\nYou need **${totalPrice.toLocaleString()} ${currencyIcon}**, but you only have **${userBalance.toLocaleString()}**.`
      );
    }

    // ===============================================
    // 📝 CONFIRMATION EMBED
    // ===============================================
    const confirmEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🛒 Confirm Purchase")
      .setDescription(`Are you sure you want to buy this?`)
      .addFields(
        { name: "Item", value: `${itemToBuy.emoji} **${itemToBuy.name}**`, inline: true },
        { name: "Quantity", value: `x${amount}`, inline: true },
        { name: "Total Cost", value: `**${totalPrice.toLocaleString()}** ${currencyIcon}`, inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_buy")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cancel_buy")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );

    const replyMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });

    // ===============================================
    // 🖱️ BUTTON COLLECTOR
    // ===============================================
    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000, // 15 seconds to decide
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        return i.reply({ content: "This button is not for you!", ephemeral: true });
      }

      if (i.customId === "cancel_buy") {
        await i.update({ content: "❌ Purchase Cancelled.", embeds: [], components: [] });
        return collector.stop();
      }

      if (i.customId === "confirm_buy") {
        // --- 🔄 Re-fetch User & Inventory (Safety Check) ---
        // (In case they spent money elsewhere while this menu was open)
        user = await UserContainer.findOne({ userId });
        if (user[currency] < totalPrice) {
          return i.update({ content: "❌ **Insufficient Funds!** Transaction failed.", embeds: [], components: [] });
        }

        // 1. Deduct Money
        user[currency] -= totalPrice;
        await user.save();

        // 2. Add Item
        let inv = await Inventory.findOne({ userId });
        if (!inv) inv = await Inventory.create({ userId, items: [] });

        const itemIndex = inv.items.findIndex((x) => x.itemId === itemId);
        if (itemIndex > -1) {
          inv.items[itemIndex].amount += amount;
        } else {
          inv.items.push({ itemId: itemId, amount: amount });
        }
        await inv.save();

        // 3. Update Quests
        await updateQuestProgress(user, "SHOP_BUY", amount, message);
        if (currency === "gold") {
          await updateQuestProgress(user, "SPEND_GOLD", totalPrice, message);
        }

        await i.update({
          content: `✅ **Purchase Successful!**\nBought **${amount}x ${itemToBuy.emoji} ${itemToBuy.name}** for **${totalPrice.toLocaleString()} ${currencyIcon}**.`,
          embeds: [],
          components: []
        });
        
        collector.stop();
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        replyMsg.edit({ content: "⏳ Purchase timed out.", components: [] }).catch(() => {});
      }
    });

  } catch (error) {
    console.error("Buy Command Error:", error);
    message.reply("Transaction failed due to a system error.");
  }
}

module.exports = { buy };