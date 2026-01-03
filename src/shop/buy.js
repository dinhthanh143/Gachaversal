const { UserContainer, Inventory } = require("../db");
const items = require("../items/items");

async function buy(message) {
  try {
    const userId = message.author.id;
    const args = message.content.split(" ");
    
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
    const currencyIcon = currency === "gem" ? "💎" : "🪙";

    if (userBalance < totalPrice) {
      return message.reply(
        `❌ **Insufficient Funds!**\nYou need **${totalPrice} ${currencyIcon}**, but you only have **${userBalance}**.`
      );
    }

    
    user[currency] -= totalPrice;
    await user.save();

    let inv = await Inventory.findOne({ userId });
    if (!inv) {
        inv = await Inventory.create({ userId, items: [] });
    }

    const itemIndex = inv.items.findIndex((i) => i.itemId === itemId);
    if (itemIndex > -1) {
      inv.items[itemIndex].amount += amount;
    } else {
      inv.items.push({ itemId: itemId, amount: amount });
    }
    
    await inv.save();

    return message.reply(
      `✅ Successfully bought **${amount}x ${itemToBuy.emoji} ${itemToBuy.name}** for **${totalPrice} ${currencyIcon}**!`
    );

  } catch (error) {
    console.error("Buy Command Error:", error);
    message.reply("Transaction failed due to a system error.");
  }
}

module.exports = { buy };