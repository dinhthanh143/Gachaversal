const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { Trade, UserContainer } = require("../db");
// ✅ Import the new state managers
const { 
  isUserTrading, setUserTrading, removeUserTrading,
  isUserBattling // Optional: Check if they are fighting
} = require("../utils/activeStates");

async function checkActiveTrade(userId) {
  // Since you removed 'participants', we must check both columns
  return await Trade.findOne({ 
    $or: [
        { senderId: userId }, 
        { receiverId: userId }
    ]
  });
}

// ==========================================
// 2. HELPER: Generate Trade Dashboard
// ==========================================
function generateTradeDashboard(tradeDoc, senderName, receiverName) {
  const embed = new EmbedBuilder()
    .setColor("#00AAFF")
    .setTitle(`🤝 Active Trade System`)
    .setDescription(`**${senderName}** ↔️ **${receiverName}**\n\nTrade is active!`)
    .addFields(
      {
        name: `👤 ${senderName} (User 1)`,
        // Accessing via your specific schema structure
        value: `**Cards:** ${tradeDoc.offers.sender.cards.length}\n**Items:** ${tradeDoc.offers.sender.items.length}\n\n${tradeDoc.offers.sender.confirmed ? "✅ **Confirmed**" : "⏳ *Waiting...*"}`,
        inline: true
      },
      {
        name: `👤 ${receiverName} (User 2)`,
        value: `**Cards:** ${tradeDoc.offers.receiver.cards.length}\n**Items:** ${tradeDoc.offers.receiver.items.length}\n\n${tradeDoc.offers.receiver.confirmed ? "✅ **Confirmed**" : "⏳ *Waiting...*"}`,
        inline: true
      }
    )
    .setFooter({ text: `Trade ID: ${tradeDoc._id} | Expires in 10 mins` })
    .setTimestamp();

  return embed;
}

// ==========================================
// 3. MAIN FUNCTION: Initiate Trade
// ==========================================
async function initiateTrade(message) {
  const sender = message.author;
  const target = message.mentions.users.first();

  try {
    // --- A. Validation Checks ---
    if (!target) return message.reply("⚠️ Incorrect trade syntax! (`!trade @User`)");
    if (target.id === sender.id) return message.reply("⚠️ You cannot trade with yourself.");
    if (target.bot) return message.reply("⚠️ You cannot trade with bots.");

    // 1. Check In-Memory Locks (Fast Fail)
    if (isUserTrading(sender.id)) return message.reply("⚠️ You are already busy with a trade request!");
    if (isUserTrading(target.id)) return message.reply(`⚠️ **${target.username}** is busy with another trade.`);
    if (isUserBattling && isUserBattling(sender.id)) return message.reply("⚠️ You cannot trade while battling!");

    // 2. Check Database Locks (Persistence Check)
    if (await checkActiveTrade(sender.id)) return message.reply("⚠️ You already have an active trade open in the database.");
    if (await checkActiveTrade(target.id)) return message.reply(`⚠️ **${target.username}** is already in another trade.`);

    // 3. Check Profiles
    const senderProfile = await UserContainer.findOne({ userId: sender.id });
    const targetProfile = await UserContainer.findOne({ userId: target.id });

    if (!senderProfile) return message.reply("❌ You need to start your adventure first (`!start`).");
    if (!targetProfile) return message.reply("❌ The target user doesn't have a profile.");

    // --- B. Lock Users ---
    setUserTrading(sender.id);
    setUserTrading(target.id);

    // --- C. Create Request Embed ---
    const requestEmbed = new EmbedBuilder()
      .setColor("#FFAA00")
      .setTitle("🤝 Trade Request")
      .setDescription(`**${sender.username}** wants to trade with you, **${target}**!\n\nDo you accept?`)
      .setFooter({ text: "Expires in 1 minute" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("accept_trade").setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("decline_trade").setLabel("Decline").setStyle(ButtonStyle.Danger)
    );

    const requestMsg = await message.reply({ 
      content: `${target}`, 
      embeds: [requestEmbed], 
      components: [row] 
    });

    // --- D. Collector (Target Only) ---
    const filter = (i) => i.user.id === target.id;
    const collector = requestMsg.createMessageComponentCollector({ 
      filter, 
      time: 60000, 
      componentType: ComponentType.Button 
    });

    collector.on("collect", async (interaction) => {
      try {
        await interaction.deferUpdate();

        if (interaction.customId === "decline_trade") {
          await requestMsg.edit({ 
            content: null, 
            embeds: [new EmbedBuilder().setColor("#FF0000").setDescription(`❌ **${target.username}** declined the trade.`)], 
            components: [] 
          });
          collector.stop("declined");
        } 
        
        else if (interaction.customId === "accept_trade") {
          // --- CREATE DB TRADE RECORD ---
          // Using your exact Schema structure
          const newTrade = await Trade.create({
            senderId: sender.id,
            receiverId: target.id,
            offers: {
                sender: { confirmed: false, cards: [], items: [] },
                receiver: { confirmed: false, cards: [], items: [] }
            }
          });

          // Show Dashboard
          const dashboard = generateTradeDashboard(newTrade, sender.username, target.username);
          
          await requestMsg.edit({ 
            content: null, 
            embeds: [dashboard], 
            components: [] 
          });

          collector.stop("accepted");
          // NOTE: We do NOT removeUserTrading here. 
          // They are locked until the trade finishes or expires in DB.
        }
      } catch (err) {
        console.error("Trade Interaction Error:", err);
      }
    });

    collector.on("end", (collected, reason) => {
      // If timed out or declined, unlock users immediately
      if (reason === "time" || reason === "declined") {
        removeUserTrading(sender.id);
        removeUserTrading(target.id);
      }

      if (reason === "time") {
        requestMsg.edit({ 
          content: null, 
          embeds: [new EmbedBuilder().setColor("#808080").setDescription(`⚠️ Trade request to **${target.username}** timed out.`)], 
          components: [] 
        }).catch(() => {});
      }
    });

  } catch (error) {
    console.error("Trade Error:", error);
    message.reply("An error occurred while starting the trade.");
    // Safety unlock
    removeUserTrading(sender.id);
    if (target) removeUserTrading(target.id);
  }
}

module.exports = { initiateTrade };