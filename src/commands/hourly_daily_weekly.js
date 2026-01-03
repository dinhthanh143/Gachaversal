const { UserContainer, Inventory } = require("../db"); 

// ==========================
// HOURLY COMMAND
// ==========================
async function hourly(message) {
  try {
    const userId = message.author.id;
    let user = await UserContainer.findOne({ userId });

    if (!user) {
      return message.reply(
        "You don't have an account. Type `!create` to make one."
      );
    }

    const now = new Date();
    const oneHour = 1000 * 60 * 60;

    if (user.lastHourly && now - user.lastHourly < oneHour) {
      const remaining = oneHour - (now - user.lastHourly);
      const mins = Math.ceil(remaining / (1000 * 60));
      return message.reply(`Come back in **${mins} minutes** to claim again.`);
    }

    const reward = 1500;
    const stamReward = 500
    user.stam += stamReward
    user.gold += reward;
    user.lastHourly = now;
    await user.save();

    message.reply(
      `You collected **${reward} 💰**! New balance: **${user.gold}**.`
    );
  } catch (err) {
    console.error("Hourly error:", err);
    message.reply("My wallet just caught on fire. Try again later.");
  }
}

// ==========================
// DAILY COMMAND
// ==========================
async function daily(message) {
  try {
    const userId = message.author.id;
    let user = await UserContainer.findOne({ userId });

    if (!user) {
      return message.reply(
        "You don't have an account. Type `!create` to make one."
      );
    }

    const now = new Date();
    const oneDay = 1000 * 60 * 60 * 24; 

    if (user.lastDaily && now - user.lastDaily < oneDay) {
      const remaining = oneDay - (now - user.lastDaily);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.ceil((remaining % (1000 * 60 * 60)) / (1000 * 60));
      return message.reply(
        `Daily is on cooldown! Come back in **${hours}h ${mins}m**.`
      );
    }

    // 2. Add Gold
    const goldReward = 15000;
    const diamondReward = 5
    user.gold += goldReward;
    user.gem += diamondReward;
    user.stam += user.stamCap;

    let inv = await Inventory.findOne({ userId });
    if (!inv) {
      inv = await Inventory.create({ userId, items: [] });
    }

    // Find gacha_ticket and add 2
    const ticketIndex = inv.items.findIndex((i) => i.itemId === "ticket");
    if (ticketIndex > -1) {
      inv.items[ticketIndex].amount += 2;
    } else {
      inv.items.push({ itemId: "ticket", amount: 2 });
    }

    // 5. Save Everything
    user.lastDaily = now;
    await user.save();
    await inv.save();

    message.reply(
      `🌞 **Daily Claimed!**\n` +
        `💰 +${goldReward} Gold\n` +
        `💎 +${diamondReward} Diamond\n` +
        `⚡ Stamina fully refilled\n` +
        `🎫 +2 Summon Tickets`
    );
  } catch (err) {
    console.error("Daily error:", err);
    message.reply("Something went wrong with claiming your daily.");
  }
}

module.exports = { hourly, daily };
