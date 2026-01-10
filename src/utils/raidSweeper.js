const { Raids, UserContainer } = require("../db");

const RAID_DURATIONS = {
    1: 45 * 60 * 1000, 
    2: 50 * 60 * 1000, 
    3: 60 * 60 * 1000, 
    4: 75 * 60 * 1000, 
    5: 90 * 60 * 1000, 
    6: 120 * 60 * 1000 
};

// ⚠️ FOR TESTING: Set this to 1 Minute instead of 40 Minutes
// const LOBBY_DURATION = 40 * 60 * 1000; 
const LOBBY_DURATION = 40 * 60 * 1000; // 1 Minute for testing

async function startRaidSweeper(client) {
    console.log("⏰ Raid Sweeper started (Debug Mode)...");

    setInterval(async () => {
        try {
            const allRaids = await Raids.find({});
            const now = Date.now();
            
            // Debug Log: Uncomment if you want to see this every minute
            // console.log(`[Sweeper] Checking ${allRaids.length} active raids...`);

            for (const raid of allRaids) {
                let timeLimit = LOBBY_DURATION;
                if (raid.started) {
                    timeLimit = RAID_DURATIONS[raid.rarity] || LOBBY_DURATION;
                }

                const startTime = new Date(raid.createdAt).getTime();
                const expiryTime = startTime + timeLimit;
                const timeLeft = (expiryTime - now) / 1000;

                // Log the status of each raid
                // console.log(`[Raid #${raid.raidId}] Time Left: ${timeLeft.toFixed(1)}s`);

                if (now >= expiryTime) {
                    console.log(`🗑️ EXPIRED: Raid #${raid.raidId}. Cleaning up...`);

                    for (const p of raid.participants) {
                        // 1. Free User
                        const user = await UserContainer.findOne({ userId: p.userId });
                        if (user) {
                            user.inRaid = null;
                            await user.save();
                            console.log(`   -> Freed user ${p.username}`);
                        }

                        // 2. Send DM
                        try {
                            const discordUser = await client.users.fetch(p.userId);
                            if (discordUser) {
                                const reason = raid.started 
                                    ? "⏳ Time Limit Reached (Defeat)" 
                                    : "⏳ Lobby Expired (No Start)";
                                
                                await discordUser.send(
                                    `🛑 **Raid #${raid.raidId} has ended!**\nReason: ${reason}\nYou are now free to join other raids.`
                                );
                                console.log(`   -> DM sent to ${p.username}`);
                            }
                        } catch (err) {
                            console.log(`   -> ❌ Could not DM ${p.username} (Closed DMs?)`);
                        }
                    }

                    // 3. Delete Raid
                    await Raids.deleteOne({ _id: raid._id });
                    console.log(`   -> Raid deleted from DB.`);
                }
            }
        } catch (err) {
            console.error("Raid Sweeper Error:", err);
        }
    }, 60000); // Checks every 60 seconds
}

module.exports = { startRaidSweeper };