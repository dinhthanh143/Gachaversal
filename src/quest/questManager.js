const { EmbedBuilder } = require("discord.js"); // ✅ Fixed Import
const { QUESTS } = require("./questList");
const { Inventory } = require("../db");

// ==========================================
// 1. TIMEZONE HELPER (Vietnam UTC+7)
// ==========================================
function isNewDayVietnam(lastDate) {
  const now = new Date();
  const vnTimeNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const vnTimeLast = new Date(lastDate.getTime() + (7 * 60 * 60 * 1000));

  const todayStr = vnTimeNow.toISOString().split("T")[0];
  const lastStr = vnTimeLast.toISOString().split("T")[0];

  return todayStr !== lastStr;
}

// ==========================================
// 2. GENERATE QUESTS (Daily Reset)
// ==========================================
async function checkAndResetQuests(user) {
  if (!user.lastQuestReset || isNewDayVietnam(user.lastQuestReset)) {
    
    // 1. Get all keys and shuffle
    const allQuestKeys = Object.keys(QUESTS);
    for (let i = allQuestKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestKeys[i], allQuestKeys[j]] = [allQuestKeys[j], allQuestKeys[i]];
    }

    // 2. Pick 3 unique quests
    const selectedKeys = allQuestKeys.slice(0, 3);

    // 3. Reset User Quest Array
    user.quests = selectedKeys.map(key => ({
      questId: key,
      progress: 0,
      claimed: false
    }));

    user.lastQuestReset = new Date();
    await user.save();
    return true; 
  }
  return false;
}

// ==========================================
// 3. UPDATE PROGRESS & AUTO-CLAIM
// ==========================================
async function updateQuestProgress(user, type, amount = 1, message = null) {
  if (!user || !user.quests || user.quests.length === 0) return;

  // 1. Ensure we aren't updating expired quests
  await checkAndResetQuests(user);

  let saveNeeded = false;
  let inv = null; 
  let justFinishedAll = false; 

  for (const q of user.quests) {
    const questDef = QUESTS[q.questId];

    // Check if Quest matches TYPE and is NOT finished
    if (questDef && questDef.type === type && !q.claimed) {
      
      // Update Progress
      if (q.progress < questDef.target) {
        q.progress += amount;
        
        // Check Completion
        if (q.progress >= questDef.target) {
          q.progress = questDef.target; 
          q.claimed = true; // ✅ Mark as Claimed
          
          // --- 🎁 GRANT QUEST REWARDS ---
          const rw = questDef.rewards;
          let rewardMsgParts = [];

          if (rw.gold) {
            user.gold += rw.gold;
            rewardMsgParts.push(`🪙 ${rw.gold.toLocaleString()}`);
          }
          if (rw.gem) {
            user.gem += rw.gem;
            rewardMsgParts.push(`💎 ${rw.gem}`);
          }

          if (rw.items && rw.items.length > 0) {
            if (!inv) inv = await Inventory.findOne({ userId: user.userId });
            if (!inv) inv = await Inventory.create({ userId: user.userId, items: [] });

            for (const rewardItem of rw.items) {
              const existingItem = inv.items.find(i => i.itemId === rewardItem.itemId);
              if (existingItem) existingItem.amount += rewardItem.amount;
              else inv.items.push({ itemId: rewardItem.itemId, amount: rewardItem.amount });
              
              rewardMsgParts.push(`📦 ${rewardItem.amount}x ${rewardItem.itemId}`);
            }
          }

          // ✅ NOTIFY USER (Single Quest)
          if (message && message.channel) {
            // Handle both Message (author) and Interaction (user)
            const targetUser = message.author || message.user;
            
            message.channel.send(
              `🎉 Congrats ${targetUser}! You completed **${questDef.name}**!\nReceived: ${rewardMsgParts.join(" | ")}`
            );
          }

          // ✅ CHECK FOR ALL CLEAR (Bonus)
          const allComplete = user.quests.every(quest => quest.claimed === true);
          
          if (allComplete) {
            justFinishedAll = true; 
            
            // --- 🎁 GRANT BONUS REWARDS ---
            user.gold += 15000;
            user.gem += 10;
            
            if (!inv) inv = await Inventory.findOne({ userId: user.userId });
            if (!inv) inv = await Inventory.create({ userId: user.userId, items: [] });
            
            const ticket = inv.items.find(i => i.itemId === "ticket");
            if (ticket) ticket.amount += 2;
            else inv.items.push({ itemId: "ticket", amount: 2 });

            // ✅ NOTIFY USER (Bonus Embed)
            if (message && message.channel) {
              const targetUser = message.author || message.user;
              
              const bonusEmbed = new EmbedBuilder()
                .setColor("#FFD700") 
                .setTitle("🌟 Daily Quests Completed!")
                .setAuthor({
                    name: `${targetUser.username}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }) // ✅ Fixed Typo
                })
                .setDescription(`Congratulations ${targetUser}, you've finished all your tasks for today!`)
                .addFields({
                  name: `🌟 Completion Bonus`,
                  value: `💎 **10** Gems | 🪙 **15,000** Gold | 🎫 **2** Ticket\n\nStatus: ✅ **Completed**`,
                  inline: false
                });
              
              message.reply({ embeds: [bonusEmbed] });
            }
          }
        }
        saveNeeded = true;
      }
    }
  }

  if (saveNeeded) {
    await user.save();
    if (inv) await inv.save();
  }
}

module.exports = { checkAndResetQuests, updateQuestProgress };