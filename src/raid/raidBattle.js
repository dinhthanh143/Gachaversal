const { UserContainer, Raids, Cards, Index, Inventory } = require("../db");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { Skills, checkPreAttackPassives } = require("../combat/skills"); 
const { generateProgressBar, EMOJIS } = require("../combat/battleManager");
const { applyStartTurnEffects, applyEndTurnEffects } = require("../combat/effects");
// ✅ FIX: Import getBgPoolSize
const { drawRaidCanvas, getBgPoolSize } = require("./raidCanva");
const { getRarityStars, getNextUid } = require("../functions");

const LOADING_GIF = "https://res.cloudinary.com/pachi/image/upload/v1767026500/Screenshot_2025-12-29_234113_t9vs0s.png";
const MAX_TURNS = 20; 

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 🛠️ HELPER FUNCTIONS
// ==========================================

function calculateStats(baseStats, rarity) {
  if (!baseStats) baseStats = { hp: 75, atk: 60, def: 50, speed: 69 };
  return {
    hp: Math.floor(baseStats.hp * (3 + rarity) + rarity * 20 + Math.floor(Math.random() * 20)),
    atk: baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10),
    def: baseStats.def + 20 * rarity + Math.floor(Math.random() * 10),
    speed: baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5),
  };
}

const SOFT_CAP_PCT = { 1: 0.05, 2: 0.045, 3: 0.04, 4: 0.035, 5: 0.033, 6: 0.03 };

function applySoftCap(rawDamage, bossMaxHp, rarity) {
    const pct = SOFT_CAP_PCT[rarity] || 0.03;
    const threshold = bossMaxHp * pct;
    if (rawDamage <= threshold) return Math.floor(rawDamage);
    const excess = rawDamage - threshold;
    return Math.floor(threshold + (excess * 0.3));
}

function getSkillValues(masterData, rarity) {
    if (!masterData.skill || !masterData.skill.values || masterData.skill.values.length === 0) return [1.0];
    const rarityIndex = Math.max(0, rarity - 1);
    return masterData.skill.values.map((valArray) => {
        if (Array.isArray(valArray)) return valArray[rarityIndex] !== undefined ? valArray[rarityIndex] : valArray[valArray.length - 1];
        return valArray;
    });
}

function getSkillSafe(skillName) {
    if (Skills[skillName]) return Skills[skillName];
    if (Skills["Basic Attack"]) return Skills["Basic Attack"];
    return {
        name: "Unknown",
        initialEnergy: 0,
        requiredEnergy: 100,
        execute: (att, def) => ({ damage: 0, log: `${att.name} tried to use ${skillName} but failed!` }),
    };
}

// ✅ UPDATED: Accepts bgIndex
async function createRaidEmbed(author, player, enemy, teamImages, bossImage, currentLog, turn, battleTitle, bgIndex) {
    // ✅ Pass the persistent bgIndex to drawRaidCanvas
    const buffer = await drawRaidCanvas(teamImages, bossImage, bgIndex);
    const attachment = new AttachmentBuilder(buffer, { name: "raid-battle.png" });

    const pBars = `${generateProgressBar(player.stats.hp, player.maxHp, "hp")}\n${generateProgressBar(player.energy, player.skill.requiredEnergy, "energy")}`;
    const eBars = `${generateProgressBar(enemy.stats.hp, enemy.maxHp, "hp")}\n${generateProgressBar(enemy.energy, enemy.skill.requiredEnergy, "energy")}`;

    const bossHeader = `${enemy.name} ${getRarityStars(enemy.rarity)} ${enemy.type}`;

    const embed = new EmbedBuilder()
        .setColor("#FF4500")
        .setAuthor({ name: author.username, iconURL: author.displayAvatarURL() }) 
        .setTitle(battleTitle)
        .setImage("attachment://raid-battle.png")
        .addFields(
            { name: `${player.name}`, value: pBars, inline: false },
            { name: bossHeader, value: eBars, inline: false },
            { name: `📝 Round ${turn}`, value: currentLog || "...", inline: false }
        )
        .setFooter({ text: `Turn ${turn}/${MAX_TURNS}` });

    return { embed, files: [attachment] };
}

// ==========================================
// 🎁 RAID CLEAR HANDLER
// ==========================================
async function handleRaidClear(client, raid, bossName, bossLevel, bossRarity) {
    console.log(`🎉 Raid ${raid.raidId} Defeated! Processing rewards...`);

    const bossData = await Index.findOne({ pokeId: raid.enemyId });
    if (!bossData) console.error(`❌ Boss ID ${raid.enemyId} not found!`);

    for (const p of raid.participants) {
        try {
            const user = await UserContainer.findOne({ userId: p.userId });
            if (!user) continue;

            let inventory = await Inventory.findOne({ userId: p.userId });
            if (!inventory) inventory = new Inventory({ userId: p.userId, items: [] });

            // Currency
            user.gold += raid.rewards.gold || 0;
            const gemReward = raid.rewards.gem || 0;
            if (user.gems !== undefined) user.gems += gemReward; 

            // Tickets
            const ticketReward = raid.rewards.ticket || 0;
            if (ticketReward > 0) {
                const ticketItem = inventory.items.find(i => i.itemId === "ticket");
                if (ticketItem) ticketItem.amount += ticketReward;
                else inventory.items.push({ itemId: "ticket", amount: ticketReward });
            }

            // Items
            let itemsText = "";
            if (raid.rewards.items && raid.rewards.items.length > 0) {
                for (const rItem of raid.rewards.items) {
                    const chance = rItem.chance !== undefined ? rItem.chance : 1.0;
                    const amountToGive = Math.floor(rItem.qty * chance); 
                    if (amountToGive > 0) {
                        const invItem = inventory.items.find(i => i.itemId === rItem.itemId);
                        if (invItem) invItem.amount += amountToGive;
                        else inventory.items.push({ itemId: rItem.itemId, amount: amountToGive });
                        itemsText += `\n+${amountToGive} **${rItem.name}**`;
                    }
                }
            }

            // Cards
            const droppedCards = []; 
            const displayCounts = {}; 

            if (bossData && raid.rewards.cards && raid.rewards.cards.length > 0) {
                for (const drop of raid.rewards.cards) {
                    for (let i = 0; i < drop.qty; i++) {
                        if (Math.random() < drop.chance) {
                            droppedCards.push(drop.rarity);
                            const key = drop.rarity;
                            displayCounts[key] = (displayCounts[key] || 0) + 1;
                        }
                    }
                }
            }

            for (const r of droppedCards) {
                const uniqueStats = calculateStats(bossData.stats, r);
                const nextUid = await getNextUid(p.userId);
                await Cards.create({
                    ownerId: p.userId,
                    uid: nextUid,
                    cardId: bossData.pokeId,
                    stats: uniqueStats,
                    rarity: r,
                    level: 1,
                    xp: 0
                });
            }

            let cardsText = "";
            if (Object.keys(displayCounts).length > 0) {
                for (const [rarity, count] of Object.entries(displayCounts)) {
                    cardsText += `\nx${count} **${bossData.name}** ${getRarityStars(parseInt(rarity))}`;
                }
            } else {
                cardsText = "No cards dropped.";
            }

            user.inRaid = null;
            await user.save();
            await inventory.save();

            const discordUser = await client.users.fetch(p.userId).catch(() => null);
            if (discordUser) {
                const dmEmbed = new EmbedBuilder()
                    .setColor("#FFD700")
                    .setAuthor({ name: `Congrats ${p.username}!`, iconURL: discordUser.displayAvatarURL() })
                    .setTitle(`🏆 Raid Completed: ${bossName}`)
                    .setDescription(`You helped defeat the **Lv.${bossLevel} ${bossName}**!\nYour rewards:`)
                    .addFields(
                        { name: "📊 Raid Info", value: `**Level:** ${bossLevel}\n**Stars:** ${getRarityStars(bossRarity)}`, inline: false },
                        { name: "💰 Currency", value: `+${raid.rewards.gold.toLocaleString()} Gold\n+${gemReward} Gems\n+${ticketReward} Tickets`, inline: true },
                        { name: "🎒 Items", value: itemsText || "None", inline: true },
                        { name: "🎴 Card Drops", value: cardsText, inline: false }
                    )
                    .setFooter({ text: "Thank you for playing!" });

                await discordUser.send({ embeds: [dmEmbed] }).catch(() => {});
            }

        } catch (e) {
            console.error(`Reward error for ${p.userId}:`, e);
        }
    }

    await Raids.deleteOne({ _id: raid._id });
    console.log(`🗑️ Raid ${raid.raidId} deleted.`);
}

// ==========================================
// ⚔️ RAID BATTLE MAIN FUNCTION
// ==========================================
async function startRaidBattle(message) {
    const userId = message.author.id;
    
    // Validation
    const user = await UserContainer.findOne({ userId });
    if (!user || !user.inRaid) return message.reply("⚠️ You are not in a Raid Lobby!");

    const raid = await Raids.findOne({ raidId: user.inRaid });
    if (!raid) return message.reply("❌ Raid not found.");
    if (!raid.started) return message.reply("⏳ The Raid has not started yet!");

    const participant = raid.participants.find(p => p.userId === userId);
    if (!participant) return message.reply("❌ You are not a participant.");
    if (participant.entriesLeft <= 0) return message.reply("⚠️ You have **0 Entries** left! Wait for refill.");

    // Input Parsing
    const args = message.content.toLowerCase().split(" ");
    const inputArg = args[2]; 
    let entriesToUse = 1;

    if (inputArg === "all") {
        entriesToUse = participant.entriesLeft;
    } else if (!isNaN(parseInt(inputArg))) {
        const num = parseInt(inputArg);
        if (num > 0) entriesToUse = num;
    }

    if (entriesToUse > participant.entriesLeft) {
        return message.reply(`⚠️ You only have **${participant.entriesLeft}** entries left!`);
    }
    entriesToUse = Math.min(entriesToUse, 5); 

    // ✅ SELECT PERSISTENT BACKGROUND
    const poolSize = getBgPoolSize();
    const persistentBgIndex = Math.floor(Math.random() * poolSize);

    const loadingEmbed = new EmbedBuilder()
        .setColor("#FF4500")
        .setTitle(`⚔️ Assembling Raid Party (x${entriesToUse})...`)
        .setImage(LOADING_GIF);
    const battleMsg = await message.reply({ embeds: [loadingEmbed] });

    try {
        const teamUids = user.team.filter(u => u !== null);
        if (teamUids.length === 0) return battleMsg.edit({ content: "⚠️ Your team is empty!", embeds: [] });

        const cards = await Cards.find({ uid: { $in: teamUids }, ownerId: userId }).populate("masterData");
        
        const megaStats = { hp: 0, atk: 0, def: 0, speed: 0, critRate: 5, critDmg: 150 };
        const activeCycle = [];
        const passiveList = [];
        const teamImages = []; 

        for (const uid of user.team) {
            if (!uid) continue;
            const card = cards.find(c => c.uid === uid);
            if (!card) continue;
            if (card.masterData.image) teamImages.push(card.masterData.image);

            megaStats.hp += card.stats.hp;
            megaStats.atk += card.stats.atk;
            megaStats.def += card.stats.def;
            megaStats.speed += card.stats.speed;
            
            let master = card.masterData;
            if (master && master.skill) {
                const realValues = getSkillValues(master, card.rarity);
                const skillRef = getSkillSafe(master.skill.name);
                
                const skillObj = {
                    name: master.skill.name,
                    values: realValues,
                    initialEnergy: skillRef.initialEnergy || 0,
                    requiredEnergy: skillRef.requiredEnergy || 100
                };

                if (master.skill.name.includes("[PASSIVE]")) passiveList.push(skillObj);
                else activeCycle.push(skillObj);
            }
        }

        if (activeCycle.length === 0) {
            activeCycle.push({ name: "Basic Attack", values: [1.0], requiredEnergy: 100, initialEnergy: 0 });
        }

        const player = {
            name: `${message.author.username}'s Team`, 
            type: "Neutral",
            stats: megaStats,
            maxHp: megaStats.hp,
            energy: activeCycle[0].initialEnergy, 
            skillCycle: activeCycle,
            cycleIndex: 0,
            skill: activeCycle[0], 
            effects: [],
        };

        const bossIndex = await Index.findOne({ pokeId: raid.enemyId });
        const bossValues = getSkillValues(bossIndex, raid.rarity);
        const bossSkillRef = getSkillSafe(bossIndex.skill.name);
        
        const enemy = {
            name: bossIndex.name,
            rarity: raid.rarity,
            type: bossIndex.type,
            image: bossIndex.image,
            stats: { 
                hp: raid.currentHp, 
                atk: raid.stats.atk,
                def: raid.stats.def,
                speed: raid.stats.speed,
                critRate: 5, critDmg: 150
            },
            maxHp: raid.stats.hp, 
            energy: bossSkillRef.initialEnergy || 0,
            skill: {
                name: bossIndex.skill.name,
                values: bossValues,
                requiredEnergy: bossSkillRef.requiredEnergy || 100
            },
            effects: [],
        };

        const battleTitle = `⚔️ RAID: ${message.author.username} vs ${enemy.name}`;
        let turn = 1;
        let battleOver = false;

        // ✅ Updated Display Helper with persistentBgIndex
        const updateDisplay = async (text, delay = 1500) => {
             const embedData = await createRaidEmbed(message.author, player, enemy, teamImages, enemy.image, text, turn, battleTitle, persistentBgIndex);
             await battleMsg.edit({ content: null, embeds: [embedData.embed], files: embedData.files });
             await wait(delay);
        };

        await updateDisplay("⚔️ **Raid Battle Started!**", 1500);

        for (const passive of passiveList) {
            const res = getSkillSafe(passive.name).execute(player, enemy, passive.values);
            if (player.effects.length > 0) {
                 const newEffect = player.effects[player.effects.length - 1];
                 if (newEffect.name === passive.name) newEffect.turns = 999;
            }
            await updateDisplay(`🔹 ${res.log}`, 1500);
        }
        if (enemy.skill.name.includes("[PASSIVE]")) {
             const res = getSkillSafe(enemy.skill.name).execute(enemy, player, enemy.skill.values);
             await updateDisplay(`☠️ ${res.log}`, 1500);
        }

        while (!battleOver && turn <= MAX_TURNS) {
            const first = player.stats.speed >= enemy.stats.speed ? player : enemy;
            const second = first === player ? enemy : player;

            await updateDisplay(`⚡ **${first.name}** is faster!`, 1500);

            const processAction = async (actor, target) => {
                if (target.stats.hp <= 0) return true; 

                const startLogs = applyStartTurnEffects(actor);
                for(const log of startLogs) await updateDisplay(log, 1500);

                const preLog = checkPreAttackPassives(actor);
                if (preLog) await updateDisplay(preLog, 1500);

                const isStunned = actor.effects.some(e => e.stat === "stun");
                if (isStunned) {
                    await updateDisplay(`🚫 **${actor.name}** is Stunned!`, 1500);
                } else {
                    const cost = actor.skill.requiredEnergy;
                    
                    if (actor.energy >= cost) {
                        const hpBefore = target.stats.hp;
                        const res = getSkillSafe(actor.skill.name).execute(actor, target, actor.skill.values);
                        actor.energy -= cost;
                        await updateDisplay(res.log, 2000); 

                        let dmg = hpBefore - target.stats.hp;
                        if (dmg > 0 && target.effects) {
                            const b = target.effects.find(e => e.stat === "storeDmg");
                            if (b) b.extra = (b.extra || 0) + Math.floor(dmg * (b.amount / 100));
                        }

                        if (actor === player) {
                            player.cycleIndex = (player.cycleIndex + 1) % player.skillCycle.length;
                            player.skill = player.skillCycle[player.cycleIndex];
                        }
                    }

                    if (target.stats.hp > 0) {
                        const hpBefore = target.stats.hp;
                        const res = getSkillSafe("Basic Attack").execute(actor, target);
                        
                        actor.energy = Math.min(cost, actor.energy + 25);
                        await updateDisplay(res.log, 1500); 

                        let dmg = hpBefore - target.stats.hp;
                        if (dmg > 0 && target.effects) {
                            const b = target.effects.find(e => e.stat === "storeDmg");
                            if (b) b.extra = (b.extra || 0) + Math.floor(dmg * (b.amount / 100));
                        }
                    }
                }

                const endLogs = applyEndTurnEffects(actor, target);
                for(const log of endLogs) await updateDisplay(log, 1500);

                return target.stats.hp <= 0;
            };

            let isDead = await processAction(first, second);
            if (!isDead) isDead = await processAction(second, first);

            if (isDead) battleOver = true;
            turn++;
        }

        if (!battleOver && turn > MAX_TURNS) {
            battleOver = true;
            await updateDisplay("⌛ **Time Limit Exceeded!**", 1500);
        }

        let rawDamage = Math.max(0, raid.currentHp - enemy.stats.hp);
        const cappedDamage = applySoftCap(rawDamage, raid.stats.hp, raid.rarity);
        const totalDamage = cappedDamage * entriesToUse;

        const freshRaid = await Raids.findOne({ raidId: raid.raidId });
        if (!freshRaid) return message.reply("❌ Error: Raid data not found during save.");

        freshRaid.currentHp = Math.max(0, freshRaid.currentHp - totalDamage);
        
        const freshParticipant = freshRaid.participants.find(p => p.userId === userId);
        if (freshParticipant) {
            freshParticipant.damageDealt += totalDamage;
            freshParticipant.attempts += entriesToUse;
            freshParticipant.entriesLeft -= entriesToUse;
            freshParticipant.lastAttack = new Date(); 
        }

        let killMsg = "";
        let isKill = false;

        if (freshRaid.currentHp <= 0 && !freshRaid.isDefeated) {
            freshRaid.isDefeated = true;
            isKill = true;
            killMsg = "\n🏆 **YOU LANDED THE KILLING BLOW!** Raid Boss Defeated!";
        }

        await freshRaid.save();

        const runMsg = entriesToUse > 1 ? `\n🔥 **x${entriesToUse} Entries Used**` : "";

        const resultEmbed = new EmbedBuilder()
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setTitle(battleOver && player.stats.hp > 0 ? "🎉 BATTLE VICTORY!" : "💀 BATTLE ENDED")
            .setColor(totalDamage > 0 ? "#00FF00" : "#FF0000")
            .setDescription(`**Congrats ${message.author.username}!**\nYou dealt **${totalDamage.toLocaleString()}** damage to the boss!${runMsg}${killMsg}`)
            .addFields(
                { name: "💀 Boss HP Remaining", value: `${generateProgressBar(freshRaid.currentHp, freshRaid.stats.hp, "hp")} (${freshRaid.currentHp.toLocaleString()})`, inline: false },
                { name: "⚡ Entries Left", value: `${freshParticipant ? freshParticipant.entriesLeft : 0}/5`, inline: true }
            );

        await message.reply({ embeds: [resultEmbed] });

        if (isKill) {
            await handleRaidClear(message.client, freshRaid, enemy.name, raid.level, raid.rarity);
        }

    } catch (err) {
        console.error(err);
        message.reply("❌ Error during Raid Battle.");
    }
}

module.exports = { startRaidBattle };