const { Raids, UserContainer } = require("../db");

const RAID_DURATIONS = {
    1: 45 * 60 * 1000, 
    2: 50 * 60 * 1000, 
    3: 60 * 60 * 1000, 
    4: 75 * 60 * 1000, 
    5: 90 * 60 * 1000, 
    6: 120 * 60 * 1000 
};

const LOBBY_DURATION = 40 * 60 * 1000; 

// Helper function to add a delay (prevents Discord Rate Limits)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startRaidSweeper(client) {
    console.log("⏰ Raid Sweeper started (RAM Optimized)...");

    setInterval(async () => {
        try {
            // .lean() makes this MUCH lighter on Discloud's RAM
            const allRaids = await Raids.find({}).lean(); 
            const now = Date.now();

            for (const raid of allRaids) {
                let timeLimit = raid.started 
                    ? (RAID_DURATIONS[raid.rarity] || LOBBY_DURATION) 
                    : LOBBY_DURATION;

                const startTime = new Date(raid.createdAt).getTime();
                const expiryTime = startTime + timeLimit;

                if (now >= expiryTime) {
                    console.log(`🗑️ EXPIRED: Raid #${raid.raidId}. Cleaning up...`);

                    for (const p of raid.participants) {
                        // 1. Free User (Optimized update)
                        await UserContainer.updateOne(
                            { userId: p.userId },
                            { $set: { inRaid: null } }
                        );

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
                                // Wait 500ms between DMs to avoid being flagged as spam
                                await wait(500); 
                            }
                        } catch (err) {
                            console.log(`   -> ❌ Could not DM ${p.userId}`);
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
    }, 60000); 
}

module.exports = { startRaidSweeper };