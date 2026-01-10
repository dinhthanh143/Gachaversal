const { UserContainer, Raids, Index } = require("../db");
const { EmbedBuilder } = require("discord.js");
const { formatImage } = require("../commands/infoCard");
const { isUserBattling, isUserTrading } = require("../utils/activeStates");
const { getRarityStars } = require("../functions");
const { generateProgressBar } = require("../combat/battleManager");
// ✅ Import helpers for Power Level calculation
const { calculateTeamPower, getUserTotalPower } = require('./raidManager');

const DIFF_NAMES = {
  1: "Easy",
  2: "Normal",
  3: "Hard",
  4: "Expert",
  5: "Insane",
  6: "Nightmare"
};

const RAID_DURATIONS = {
    1: 45 * 60 * 1000, 
    2: 50 * 60 * 1000, 
    3: 60 * 60 * 1000, 
    4: 75 * 60 * 1000, 
    5: 90 * 60 * 1000, 
    6: 120 * 60 * 1000 
};
function getTimeAgo(date) {
    if (!date) return "Never";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}
// =========================================
// 📥 JOIN RAID
// =========================================
async function joinRaid(message) {
  try {
    const userId = message.author.id;
    const args = message.content.trim().split(/ +/); 
    const raidIdInput = parseInt(args[2]); 

    // 1. Validation Checks
    if (isUserBattling(userId)) return message.reply("⚠️ You are currently in a battle!");
    if (isUserTrading(userId)) return message.reply("⚠️ You are currently trading!");
    
    if (isNaN(raidIdInput)) return message.reply("⚠️ Usage: `!raid join [Raid ID]`");

    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("❌ User profile not found.");

    // Check if user is already in a raid
    if (user.inRaid) {
       const check = await Raids.findOne({ raidId: user.inRaid });
       if (!check) {
          // Raid expired/deleted, clear user status
          user.inRaid = null;
          await user.save();
       } else {
          return message.reply(`⚠️ You are already in a Raid (ID: ${user.inRaid}). Type \`!raid leave\` to exit.`);
       }
    }

    // 2. Find Raid
    const raid = await Raids.findOne({ raidId: raidIdInput });
    
    if (!raid) return message.reply("❌ Raid not found or expired.");
    if (raid.started) return message.reply("🔒 Raid has already started.");

    // ✅ 3. Calculate User CP
    const powerLevel = await getUserTotalPower(userId);

    // 4. Join Schema Method
    try {
      // Pass the calculated CP to the database method
      await raid.joinLobby(
          { id: userId, username: message.author.username }, 
          powerLevel 
      );
    } catch (err) {
      return message.reply(`❌ ${err.message}`); 
    }

    // 5. Save State
    user.inRaid = raid.raidId; 
    await user.save();

    return message.reply(`✅ **Joined!**\nYou are now in the lobby for Raid **#${raidIdInput}**.`);
  } catch (err) {
    console.error(err);
    message.reply("❌ Error joining raid.");
  }
}

// =========================================
// 🚀 START RAID
// =========================================
async function raidStart(message) {
    try {
        const userId = message.author.id;
        const user = await UserContainer.findOne({ userId });
        
        if (!user || !user.inRaid) return message.reply("⚠️ You are not in a raid.");

        const raid = await Raids.findOne({ raidId: user.inRaid });
        if (!raid) return message.reply("❌ Raid not found.");

        const participant = raid.participants.find(p => p.userId === userId);
        if (!participant || !participant.isLeader) {
            return message.reply("⚠️ Only the **Raid Leader** can start the battle!");
        }

        if (raid.started) return message.reply("⚠️ Raid has already started!");

        raid.started = true;
        raid.createdAt = new Date(); // Refresh timer for battle duration
        await raid.save();

        // DM Participants
        raid.participants.forEach(async (p) => {
            try {
                const discordUser = await message.client.users.fetch(p.userId);
                if (discordUser) {
                    await discordUser.send(
                        `⚔️ **RAID STARTED!**\nRaid **#${raid.raidId}** has begun! Go to the channel and start fighting!`
                    );
                }
            } catch (err) { }
        });

        return message.reply(`🔥 **RAID STARTED!**\nThe timer has been refreshed. Good luck!`);
    } catch (err) {
        console.error(err);
        message.reply("❌ Error starting raid.");
    }
}

// =========================================
// 🏠 RAID LOBBY UI
// =========================================
async function raidLobby(message) {
  try {
    const userId = message.author.id;
    const user = await UserContainer.findOne({ userId });

    if (!user || !user.inRaid) {
      return message.reply("⚠️ You are not currently in a Raid.");
    }

    // 1. Find Raid
    const raid = await Raids.findOne({ raidId: user.inRaid });

    if (!raid) {
      user.inRaid = null;
      await user.save();
      return message.reply("❌ The raid has expired or ended.");
    }

    // ✅ Force Update Entries (Refill logic)
    await raid.updateAllEntries();

    // 2. Fetch Boss Info
    const bossData = await Index.findOne({ pokeId: raid.enemyId });
    const img = await formatImage(bossData?.image, 200, 200);
    const diffName = DIFF_NAMES[raid.rarity] || "Unknown";
    const stars = getRarityStars(raid.rarity);

    // 3. Time Calculation
    // If started: Use Rarity Duration. If Lobby: Use default 40 mins (2400s)
    const durationMs = raid.started ? RAID_DURATIONS[raid.rarity] : 2400 * 1000;
    const expireUnix = Math.floor((new Date(raid.createdAt).getTime() + durationMs) / 1000);

    // 4. Build Player List
    const maxSlots = 5;
    let playerDisplay = "";

    for (let i = 0; i < maxSlots; i++) {
      const p = raid.participants[i];
      const slotNum = i + 1;
      
      if (p) {
        let statusIcon = "✅"; 
        let roleText = "";

        const member = message.guild?.members.cache.get(p.userId);
        const displayName = member ? member.displayName : p.username;
        const realName = member ? member.user.username : ""; 
        const nameStr = realName ? `**${displayName}** (@${realName})` : `**${p.username}**`;
        
        if (p.isLeader) {
            statusIcon = "👑";
            roleText = " **[LEADER]**";
        }
        
        // Line 1: Name
        playerDisplay += `\`${slotNum}.\` ${statusIcon} ${nameStr}${roleText}\n`;
        
        // Line 2: Power Level
        // Fallback to 0 if powerLevel undefined (old raids)
        const cp = p.powerLevel ? p.powerLevel.toLocaleString() : "0";
        playerDisplay += `      └ 💥 **Power Level: ${cp}**`;

        // Line 3: Battle Stats (Only if started)
       if (raid.started) {
             // ✅ Calculate Time String
             const timeAgo = getTimeAgo(p.lastAttack);

             playerDisplay += ` | ⚔️ **${p.damageDealt.toLocaleString()}** Dmg\n`;
             // ✅ Added Time Display at the end
             playerDisplay += `      └ ⚡ **${p.entriesLeft}/5** | 🎯 **${p.attempts}** Attempts | 🕒 **${timeAgo}**\n`;
        } else {
             playerDisplay += `\n`; 
        }

      } else {
        playerDisplay += `\`${slotNum}.\` 🔳 *Empty*\n`;
      }
      playerDisplay += `\u200b\n`; 
    }

    // 5. Boss Status & HP Bar
    let bossStatusDisplay = `**Status:** ${raid.started ? "🔥 **BATTLE STARTED**" : "⏳ **WAITING FOR PLAYERS**"}`;
    
    if (raid.started) {
        const hpBar = generateProgressBar(raid.currentHp, raid.stats.hp, "hp");
        const hpPercent = Math.floor((raid.currentHp / raid.stats.hp) * 100);
        bossStatusDisplay += `\n**HP:** ${hpBar} **${hpPercent}%**\n(${raid.currentHp.toLocaleString()} / ${raid.stats.hp.toLocaleString()})`;
    }

    // ✅ Calculate Correct Boss CP using Raid Stats
    const statsForPower = {
        hp: raid.stats.realHp, 
        atk: raid.stats.atk,
        def: raid.stats.def,
        speed: raid.stats.speed
    };
    const bossPowerLevel = calculateTeamPower(statsForPower).toLocaleString();

    // 6. Embed Construction
    const embed = new EmbedBuilder()
      .setColor(bossData?.cardColor || "#FF0000")
      .setTitle(`☠️ RAID BOSS: ${bossData?.name}`)
      .setAuthor({
        name : message.author.username,
        iconURL : message.author.displayAvatarURL()
      })
      .setDescription(
        `**Difficulty:** ${diffName} ${stars}\n` +
        `**Level:** ${raid.level}\n` +
        `**ID:** \`${raid.raidId}\`\n` +
        `**Power Level:** ${bossPowerLevel}\n` +
        bossStatusDisplay 
      )
      .setThumbnail(img)
      .addFields(
        { name: "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬", value: `**👥 PARTICIPANTS (${raid.participants.length}/${maxSlots})**`, inline: false },
        { name: "\u200b", value: playerDisplay.trim(), inline: false },
        { name: "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬", value: `⏰ **Time Remaining:** <t:${expireUnix}:R>`, inline: false }
      )
      .setFooter({ text: raid.started ? "Battle in progress! Good luck!" : "Type '!rd start' to begin (Leader only) | '!rd leave' to exit" });

    return message.reply({ embeds: [embed] });

  } catch (err) {
    console.error(err);
    message.reply("❌ Error loading lobby.");
  }
}

// =========================================
// 🚪 LEAVE RAID
// =========================================
async function leaveRaid(message) {
    try {
        const userId = message.author.id;
        const user = await UserContainer.findOne({ userId });

        if (!user || !user.inRaid) return message.reply("⚠️ You are not in a raid.");

        const raid = await Raids.findOne({ raidId: user.inRaid });
        
        if (raid) {
            await raid.leaveLobby(userId);
        }

        user.inRaid = null;
        await user.save();

        message.reply("✅ You have left the raid.");
    } catch (err) {
        console.error(err);
        message.reply("Error leaving raid.");
    }
}

// =========================================
// ⚡ RAID ENTRIES CHECK
// =========================================
async function raidEntries(message) {
    try {
        const userId = message.author.id;
        const user = await UserContainer.findOne({ userId });

        if (!user || !user.inRaid) return message.reply("⚠️ You are not currently in a Raid.");

        const raid = await Raids.findOne({ raidId: user.inRaid });
        if (!raid) return message.reply("❌ Raid data not found.");

        await raid.updateAllEntries();

        const participant = raid.participants.find(p => p.userId === userId);
        if (!participant) return message.reply("❌ You are not in this raid participant list.");

        if (participant.entriesLeft >= 5) {
            return message.reply(`⚡ **Raid Entries:** ${participant.entriesLeft}/5\nYou are fully rested!`);
        }

        const nextRefill = new Date(new Date(participant.lastRegen).getTime() + 5 * 60 * 1000);
        const refillUnix = Math.floor(nextRefill.getTime() / 1000);

        return message.reply(
            `⚡ **Raid Entries:** ${participant.entriesLeft}/5\n⏳ Next refill: <t:${refillUnix}:R>`
        );

    } catch (err) {
        console.error(err);
        message.reply("❌ Error checking entries.");
    }
}

// =========================================
// 🦶 KICK PLAYER
// =========================================
async function kickPlayer(message) {
  try {
    const userId = message.author.id;
    const args = message.content.trim().split(/ +/);
    const targetSlot = parseInt(args[2]); 

    if (isNaN(targetSlot)) return message.reply("⚠️ Usage: `!raid kick [slot number]`");

    const leaderUser = await UserContainer.findOne({ userId });
    if (!leaderUser || !leaderUser.inRaid) return message.reply("⚠️ You are not in a raid.");

    const raid = await Raids.findOne({ raidId: leaderUser.inRaid });
    if (!raid) return message.reply("❌ Raid not found.");

    // Force update first to ensure Idle Timers are accurate
    await raid.updateAllEntries();

    let result;
    try {
      result = await raid.kickMember(userId, targetSlot);
    } catch (err) {
      return message.reply(`🚫 **Action Failed:** ${err.message}`);
    }

    const kickedUserProfile = await UserContainer.findOne({ userId: result.userId });
    if (kickedUserProfile) {
      kickedUserProfile.inRaid = null;
      await kickedUserProfile.save();
    }

    try {
      const kickedDiscordUser = await message.client.users.fetch(result.userId);
      await kickedDiscordUser.send(
        `⚠️ **You have been kicked from Raid #${result.raidId}.**\nReason: Idle for too long or removed by Leader.\nYou cannot rejoin this specific raid instance.`
      );
    } catch (dmErr) { }

    return message.reply(`✅ **${result.username}** has been kicked and banned from this lobby.`);

  } catch (err) {
    console.error(err);
    message.reply("❌ Error executing kick command.");
  }
}

module.exports = { joinRaid, raidLobby, leaveRaid, kickPlayer, raidStart, raidEntries };