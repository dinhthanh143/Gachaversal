const { UserContainer, Inventory } = require("../db");
const { updateQuestProgress } = require("../quest/questManager");
const {itemIcons } = require('../items/items')
// ==========================
// HOURLY COMMAND
// ==========================
const goldIcon = "<:coin:1458833303070183435>"
const rtIcon = "<:raid_ticket:1458395626772627643>"
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
    let stamReward = 15;
    
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

    message.reply(`You collected **${reward} ${goldIcon}** and ${stamReward} Stamina${stamCheck}!`);
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
    const twoDays = oneDay * 2;

    // 1. Cooldown Check
    if (user.lastDaily && now - user.lastDaily < oneDay) {
      const remaining = oneDay - (now - user.lastDaily);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.ceil((remaining % (1000 * 60 * 60)) / (1000 * 60));
      return message.reply(
        `Daily is on cooldown! Come back in **${hours}h ${mins}m**.`
      );
    }

    // 2. Streak Logic
    // If it's been more than 48 hours (2 days), the streak breaks.
    // (Note: user.streak starts at 0 or undefined)
    if (user.lastDaily && (now - user.lastDaily) > twoDays) {
        user.streak = 0;
    }

    // Increment Streak (Cap at 30)
    if (!user.streak) user.streak = 0; // Safety check
    if (user.streak < 30) {
        user.streak += 1;
    }

    // 3. Calculate Rewards based on Streak
    // Gold: Base 10k + (500 * Streak) -> Max 25k at Streak 30
    const goldBase = 10000;
    const goldBonusAmount = user.streak * 500;
    const goldReward = goldBase + goldBonusAmount;

    // Gems: Base 5 + Threshold Bonuses
    let diamondReward = 5;
    if (user.streak >= 5) diamondReward += 2;
    if (user.streak >= 10) diamondReward += 2;
    if (user.streak >= 15) diamondReward += 2;
    if (user.streak >= 20) diamondReward += 2;
    if (user.streak >= 25) diamondReward += 2;

    // Apply Currency
    user.gold += goldReward;
    user.gem += diamondReward;
    user.stam += user.stamCap; // Full refill

    // 4. Inventory Items
    let inv = await Inventory.findOne({ userId });
    if (!inv) {
      inv = await Inventory.create({ userId, items: [] });
    }

    const ticketReward = 2;
    const blessingReward = 2;
    const blessingId = "b3"; // Grand Blessing
    const raidTicketReward = 4;

    // -- Add Tickets --
    const ticketIndex = inv.items.findIndex((i) => i.itemId === "ticket");
    if (ticketIndex > -1) inv.items[ticketIndex].amount += ticketReward;
    else inv.items.push({ itemId: "ticket", amount: ticketReward });

    // -- Add Raid Tickets --
    const raidTicketIndex = inv.items.findIndex((i) => i.itemId === "rt");
    if (raidTicketIndex > -1) inv.items[raidTicketIndex].amount += raidTicketReward;
    else inv.items.push({ itemId: "rt", amount: raidTicketReward });
    
    // -- Add Blessings (b3) --
    const blessIndex = inv.items.findIndex((i) => i.itemId === blessingId);
    if (blessIndex > -1) inv.items[blessIndex].amount += blessingReward;
    else inv.items.push({ itemId: blessingId, amount: blessingReward });

    // 5. Save Everything
    user.lastDaily = now;
    await user.save();
    await inv.save();

    // 6. Reply
    // (Assuming goldIcon, rtIcon, etc. are imported globally or at the top)
    const rtIcon = "<:raid_ticket:1458395626772627643>"; // Replace with your actual icon ID if not imported
    const streakMsg = user.streak === 30 ? "🔥 **MAX STREAK (30)**" : `🔥 Streak: **${user.streak}**/30`;

    message.reply(
      `🌞 **Daily Claimed!**\n${streakMsg}\n` +
        `${goldIcon} +${goldReward.toLocaleString()} Gold\n` +
        `💎 +${diamondReward} Diamond\n` +
        `⚡ Stamina fully refilled\n` +
        `🎫 +${ticketReward} Summon Tickets\n` +
        `💫 +${blessingReward} Grand Blessings\n` +
        `${rtIcon || "🎟️"} +${raidTicketReward} Raid Tickets\n`
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
        `${goldIcon} +${goldReward.toLocaleString()} Gold\n` +
        `💎 +${diamondReward} Gems\n` +
        `🎫 +${ticketReward} Summon Tickets\n` +
        `💠 +${blessingReward} Divine Blessing`
    );
  } catch (err) {
    console.error("Weekly error:", err);
    message.reply("Something went wrong with claiming your weekly.");
  }
}

module.exports = { hourly, daily, weekly,goldIcon };