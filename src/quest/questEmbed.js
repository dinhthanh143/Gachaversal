const { EmbedBuilder } = require("discord.js");
const { UserContainer } = require("../db");
const { QUESTS } = require("../quest/questList");
const { checkAndResetQuests } = require("../quest/questManager");

// ==========================================
// 🛠️ HELPER FUNCTIONS
// ==========================================

function getTimeRemaining() {
  const now = new Date();
  const vnOffset = 7 * 60 * 60 * 1000;
  const vnNow = new Date(now.getTime() + vnOffset);
  
  const vnNextMidnight = new Date(vnNow);
  vnNextMidnight.setUTCHours(24, 0, 0, 0);

  const diffMs = vnNextMidnight - vnNow;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${mins}m`;
}

// Format individual quest rewards
function formatRewards(rewards) {
  let str = [];
  if (rewards.gold > 0) str.push(`🪙 ${rewards.gold.toLocaleString()}`);
  if (rewards.gem > 0) str.push(`💎 ${rewards.gem}`);
  if (rewards.items && rewards.items.length > 0) {
    rewards.items.forEach(i => str.push(`📦 ${i.amount}x ${i.itemId}`));
  }
  return str.join(" | "); // Changed to pipe for better row look
}

// ==========================================
// 📜 QUEST DASHBOARD COMMAND
// ==========================================
async function questEmbed(message) {
  try {
    const userId = message.author.id;
    let user = await UserContainer.findOne({ userId });

    if (!user) return message.reply("You need to `!create` an account first.");

    // 1. Force a check (generates new quests if needed)
    await checkAndResetQuests(user);

    // 2. Prepare Embed
    const timeRemaining = getTimeRemaining();
    
    const embed = new EmbedBuilder()
      // ✅ COLOR: Bright Greenish
      .setColor("#57F287") 
      .setAuthor({ 
        name: `${message.author.username}'s Daily Quests`, 
        iconURL: message.author.displayAvatarURL({ dynamic: true }) 
      })
      .setTitle(`⏳ Time Remaining: **${timeRemaining}**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      .setDescription("Complete quests to earn rewards!");

    // 3. Render Quests (Rows)
    if (!user.quests || user.quests.length === 0) {
      embed.setDescription("⚠️ No active quests found. Try again tomorrow!");
    } else {
      let completedCount = 0;

      for (const userQuest of user.quests) {
        const def = QUESTS[userQuest.questId];
        if (!def) continue; 

        const progress = userQuest.progress || 0;
        const target = def.target;
        const isFinished = progress >= target;

        if (isFinished) completedCount++;

        // Status Logic
        let statusIcon = "🔴"; 
        let statusText = `${progress}/${target}`;

        if (isFinished) {
          statusIcon = "✅";
          statusText = "COMPLETED";
        }

        const rewardStr = formatRewards(def.rewards);
        
        embed.addFields({
          name: `${statusIcon} ${def.name} (${statusText})`,
          value: `*${def.description}*\n🎁 **Rewards:** ${rewardStr}`,
          // ✅ LAYOUT: Rows (False)
          inline: false 
        });
      }

      // 4. Fixed "All Clear" Bonus Section
      const allClearStatus = completedCount === 3 ? " **Completed** ✅" : " **Incomplete** 🔒";
      
      embed.addFields({
        name: "\u200B", // Spacer
        value: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 
        inline: false 
      });

      embed.addFields({
        name: `🌟 Completion Bonus`,
        value: `Complete all daily quests to obtain:\n💎 **10** Gems | 🪙 **15,000** Gold | 🎫 **2** Ticket\n\nStatus: ${allClearStatus}`,
        inline: false
      });
    }

    // 5. Send
    await message.reply({ embeds: [embed] });

  } catch (error) {
    console.error("Quest Embed Error:", error);
    message.reply("❌ Failed to load quests.");
  }
}

module.exports = { questEmbed };