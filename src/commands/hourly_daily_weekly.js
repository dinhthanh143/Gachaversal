const { UserContainer, Inventory } = require("../db");
const { updateQuestProgress } = require("../quest/questManager");

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

    let stamCheck = "";
    const reward = 1000;
    let stamReward = 500;
    
    // Check Stamina Cap
    if (user.stam >= user.stamCap) {
      stamReward = 0;
      stamCheck = "(Maxed)";
    }

    user.stam += stamReward;
    user.gold += reward;
    user.lastHourly = now;
    await user.save();

    // ✅ QUEST UPDATE: Hourly Claim
    await updateQuestProgress(user, "HOURLY_CLAIM", 1, message);

    message.reply(`You collected **${reward} 💰** and ${stamReward} Stamina${stamCheck}!`);
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

    // 2. Add Currency
    const goldReward = 15000;
    const diamondReward = 5;
    user.gold += goldReward;
    user.gem += diamondReward;
    user.stam += user.stamCap;

    let inv = await Inventory.findOne({ userId });
    if (!inv) {
      inv = await Inventory.create({ userId, items: [] });
    }

    // 3. Add Items (Tickets & Grand Blessings)
    const ticketReward = 2;
    const blessingReward = 2;
    const blessingId = "b3"; // Grand Blessing

    // -- Add Tickets --
    const ticketIndex = inv.items.findIndex((i) => i.itemId === "ticket");
    if (ticketIndex > -1) inv.items[ticketIndex].amount += ticketReward;
    else inv.items.push({ itemId: "ticket", amount: ticketReward });

    // -- Add Blessings (b3) --
    const blessIndex = inv.items.findIndex((i) => i.itemId === blessingId);
    if (blessIndex > -1) inv.items[blessIndex].amount += blessingReward;
    else inv.items.push({ itemId: blessingId, amount: blessingReward });

    // 5. Save Everything
    user.lastDaily = now;
    await user.save();
    await inv.save();

    message.reply(
      `🌞 **Daily Claimed!**\n` +
        `💰 +${goldReward.toLocaleString()} Gold\n` +
        `💎 +${diamondReward} Diamond\n` +
        `⚡ Stamina fully refilled\n` +
        `🎫 +${ticketReward} Summon Tickets\n` +
        `💫 +${blessingReward} Grand Blessings`
    );
  } catch (err) {
    console.error("Daily error:", err);
    message.reply("Something went wrong with claiming your daily.");
  }
}

// ==========================
// WEEKLY COMMAND
// ==========================
async function weekly(message) {
  try {
    const userId = message.author.id;
    let user = await UserContainer.findOne({ userId });

    if (!user) {
      return message.reply(
        "You don't have an account. Type `!create` to make one."
      );
    }

    const now = new Date();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;

    if (user.lastWeekly && now - user.lastWeekly < oneWeek) {
      const remaining = oneWeek - (now - user.lastWeekly);
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.ceil((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return message.reply(
        `Weekly is on cooldown! Come back in **${days}d ${hours}h**.`
      );
    }

    // 2. Rewards Calculation
    const goldReward = 50000;
    const diamondReward = 30;
    const ticketReward = 4;
    
    // ✅ CHANGED: Now gives 1 Divine Blessing (b4) instead of 3 Grand (b3)
    const blessingReward = 1;
    const blessingId = "b4"; 

    // Apply Currency
    user.gold += goldReward;
    user.gem += diamondReward;

    // Apply Inventory Items
    let inv = await Inventory.findOne({ userId });
    if (!inv) inv = await Inventory.create({ userId, items: [] });

    // Add Summon Tickets
    const ticketItem = inv.items.find((i) => i.itemId === "ticket");
    if (ticketItem) ticketItem.amount += ticketReward;
    else inv.items.push({ itemId: "ticket", amount: ticketReward });

    // Add Divine Blessing
    const blessingItem = inv.items.find((i) => i.itemId === blessingId);
    if (blessingItem) blessingItem.amount += blessingReward;
    else inv.items.push({ itemId: blessingId, amount: blessingReward });

    // 5. Save Everything
    user.lastWeekly = now;
    await user.save();
    await inv.save();

    message.reply(
      `📅 **Weekly Claimed!**\n` +
        `💰 +${goldReward.toLocaleString()} Gold\n` +
        `💎 +${diamondReward} Gems\n` +
        `🎫 +${ticketReward} Summon Tickets\n` +
        `💠 +${blessingReward} Divine Blessing`
    );
  } catch (err) {
    console.error("Weekly error:", err);
    message.reply("Something went wrong with claiming your weekly.");
  }
}

module.exports = { hourly, daily, weekly };