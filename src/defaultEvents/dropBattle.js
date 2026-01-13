const { UserContainer, Cards, Index } = require("../db");
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require("discord.js");
const { formatImage } = require('../commands/infoCard'); 
const createBattleEmbed = require("../ui/combatEmbed"); 
// ✅ Only import necessary logic, we define getSkillSafe locally as requested
const { checkPreAttackPassives } = require("../combat/combatHelpers");
const { Skills } = require("../combat/skills/index");
const { applyStartTurnEffects, applyEndTurnEffects } = require("../combat/effects");
const { generateProgressBar, EMOJIS } = require("../combat/battleManager");
const { getRarityStars, getNextUid } = require("../functions");
const { setUserBattling, removeUserBattling, isUserBattling } = require("../utils/activeStates");

const MAX_TURNS = 25;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 🛠️ HELPER FUNCTIONS
// ==========================================

function getSkillSafe(skillName) {
    if (Skills[skillName]) return Skills[skillName];
    if (Skills["Basic Attack"]) return Skills["Basic Attack"];
    return {
        name: "Unknown",
        execute: (att, def) => ({
            damage: 0,
            log: `${att.name} tried to attack but tripped!`,
        }),
    };
}

function getSkillValues(masterData, rarity) {
    if (!masterData.skill || !masterData.skill.values || masterData.skill.values.length === 0) return [1.0];
    const rarityIndex = Math.max(0, rarity - 1);
    return masterData.skill.values.map((valArray) => {
        if (Array.isArray(valArray)) return valArray[rarityIndex] !== undefined ? valArray[rarityIndex] : valArray[valArray.length - 1];
        return valArray;
    });
}

// ==========================================
// ⚔️ MAIN BATTLE FUNCTION
// ==========================================
async function startDropBattle(interaction, wildCardData, rarity, uniqueStats, originalMessage) {
    const userId = interaction.user.id;

    if (isUserBattling(userId)) {
        return interaction.reply({ 
            content: "⚠️ You are already in a battle!", 
            ephemeral: true 
        });
    }
    setUserBattling(userId);

    // 1. Initial Reply (Public)
    const battleResponse = await interaction.reply({ 
        content: "⚔️ **Encounter Started!** Preparing battle...", 
        fetchReply: true 
    });

    try {
        // 2. Load User Data
        const user = await UserContainer.findOne({ userId }).populate({
            path: "selectedCard",
            populate: { path: "masterData" },
        });

        if (!user || !user.selectedCard) {
            removeUserBattling(userId);
            return interaction.editReply("❌ You need to select a card first! Use `!select`.");
        }

        // 3. Setup PLAYER
        const pCard = user.selectedCard;
        let pMaster = pCard.masterData;
        if (!pMaster) pMaster = await Index.findOne({ pokeId: pCard.cardId });

        const playerSkillValues = getSkillValues(pMaster, pCard.rarity);
        const playerSkillRef = getSkillSafe(pMaster.skill.name);
        
        const player = {
            name: `${interaction.user.username}`,
            level: pCard.level,
            image: pMaster.image,
            type: pMaster.type,
            stats: { ...pCard.stats, critRate: 5, critDmg: 140 },
            maxHp: pCard.stats.hp,
            energy: playerSkillRef.initialEnergy || 50,
            skill: {
                name: pMaster.skill.name,
                values: playerSkillValues,
                requiredEnergy: playerSkillRef.requiredEnergy || 100
            },
            effects: [],
            displayBars: "" // ✅ Added for UI
        };

        // 4. Setup ENEMY (The Wild Card)
        const wildSkillValues = getSkillValues(wildCardData, rarity);
        const wildSkillRef = getSkillSafe(wildCardData.skill.name);

        const enemy = {
            name: `Wild ${wildCardData.name}`,
            level: 1, 
            image: wildCardData.image,
            type: wildCardData.type,
            stats: { ...uniqueStats, critRate: 5, critDmg: 140 },
            maxHp: uniqueStats.hp,
            energy: wildSkillRef.initialEnergy || 50,
            skill: {
                name: wildCardData.skill.name,
                values: wildSkillValues,
                requiredEnergy: wildSkillRef.requiredEnergy || 100
            },
            effects: [],
            displayBars: "" // ✅ Added for UI
        };

        // 5. Battle Loop Setup
        let turn = 1;
        let logs = [];
        let battleOver = false;
        let playerWon = false;
        const battleTitle = `⚔️ Wild Encounter: ${enemy.name}`;

        logs.push(`⚔️ Battle Started!`);

        // ✅ Helper to update visuals (Matches battleManager)
        const updateBars = () => {
            const pMaxEnergy = player.skill.requiredEnergy || 100;
            const eMaxEnergy = enemy.skill.requiredEnergy || 100;
            
            player.displayBars = `${generateProgressBar(player.stats.hp, player.maxHp, "hp")}\n${generateProgressBar(player.energy, pMaxEnergy, "energy")}`;
            enemy.displayBars = `${generateProgressBar(enemy.stats.hp, enemy.maxHp, "hp")}\n${generateProgressBar(enemy.energy, eMaxEnergy, "energy")}`;
        };

        const activatePassive = (unit, target) => {
            if (unit.skill && unit.skill.name.includes("[PASSIVE]")) {
                const skillLogic = getSkillSafe(unit.skill.name);
                const result = skillLogic.execute(unit, target, unit.skill.values);
                logs.push(result.log);
                if (unit.effects.length > 0) {
                    unit.effects.forEach((e) => {
                        if (e.name === unit.skill.name) e.turns = 999;
                    });
                }
            }
        };

        // Start Battle Logic
        activatePassive(player, enemy);
        activatePassive(enemy, player);

        await wait(2000);
        updateBars();

        // Initial Render
        let embedData = await createBattleEmbed(player, player.type, enemy.type, pCard.rarity, rarity, enemy, logs, turn, null, battleTitle, "dropBattle");
        // Save the buffer to reuse background if needed
        const battleBuffer = embedData.buffer; 

        await interaction.editReply({ content: null, embeds: [embedData.embed], files: embedData.files });

        while (!battleOver && turn <= MAX_TURNS) {
            const first = player.stats.speed >= enemy.stats.speed ? player : enemy;
            const second = first === player ? enemy : player;

            logs.push(`⚡ **${first.name}** has faster speed, it goes first!`);
            
            // ✅ Re-render for turn start
            embedData = await createBattleEmbed(player, player.type, enemy.type, pCard.rarity, rarity, enemy, logs, turn, battleBuffer, battleTitle, "dropBattle");
            await interaction.editReply({ embeds: [embedData.embed], files: embedData.files });
            await wait(1500);

            const runTurnLifecycle = async (actor, target) => {
                if (target.stats.hp <= 0) return true;

                // 1. Start Turn Effects
                const startLogs = applyStartTurnEffects(actor);
                if(startLogs.length > 0) {
                    logs.push(...startLogs);
                    updateBars();
                    embedData = await createBattleEmbed(player, player.type, enemy.type, pCard.rarity, rarity, enemy, logs, turn, battleBuffer, battleTitle, "dropBattle");
                    await interaction.editReply({ embeds: [embedData.embed], files: embedData.files });
                    await wait(1000);
                }

                // 2. Pre-Attack Checks
                const preLog = checkPreAttackPassives(actor);
                if (preLog) {
                    logs.push(preLog);
                    updateBars();
                    embedData = await createBattleEmbed(player, player.type, enemy.type, pCard.rarity, rarity, enemy, logs, turn, battleBuffer, battleTitle, "dropBattle");
                    await interaction.editReply({ embeds: [embedData.embed], files: embedData.files });
                    await wait(2000);
                }

                const isStunned = actor.effects && actor.effects.some(e => e.stat === "stun");
                
                if (isStunned) {
                    logs.push(`🚫 **${actor.name}** is **Stunned** and couldn't act!`);
                    updateBars();
                    embedData = await createBattleEmbed(player, player.type, enemy.type, pCard.rarity, rarity, enemy, logs, turn, battleBuffer, battleTitle, "dropBattle");
                    await interaction.editReply({ embeds: [embedData.embed], files: embedData.files });
                    await wait(1500);
                } else {
                    const skillCost = actor.skill.requiredEnergy || 100;
                    const isSilenced = actor.effects && actor.effects.some(e => e.stat === "silence");
                    const isPassiveSkill = actor.skill && actor.skill.name.includes("[PASSIVE]");
                    const canUseSkill = !isSilenced || isPassiveSkill;
                    
                    // --- ACTION ---
                    if (actor.energy >= skillCost && canUseSkill) {
                        const res = getSkillSafe(actor.skill.name).execute(actor, target, actor.skill.values);
                        actor.energy -= skillCost;
                        logs.push(res.log);
                    } else {
                        const res = getSkillSafe("Basic Attack").execute(actor, target);
                        let gain = 25;
                        const regen = actor.effects && actor.effects.find(e => e.stat === "energyRegen");
                        if(regen) gain = Math.floor(gain * (1 + regen.amount/100));
                        
                        if (!isSilenced && !isPassiveSkill) {
                            actor.energy = Math.min(skillCost, actor.energy + gain);
                        }
                        logs.push(res.log);
                    }

                    // Update UI after action
                    updateBars();
                    embedData = await createBattleEmbed(player, player.type, enemy.type, pCard.rarity, rarity, enemy, logs, turn, battleBuffer, battleTitle, "dropBattle");
                    await interaction.editReply({ embeds: [embedData.embed], files: embedData.files });
                    await wait(2000);
                }

                // 3. End Turn Effects
                const endLogs = applyEndTurnEffects(actor, target);
                if(endLogs.length > 0) {
                    logs.push(...endLogs);
                    updateBars();
                    embedData = await createBattleEmbed(player, player.type, enemy.type, pCard.rarity, rarity, enemy, logs, turn, battleBuffer, battleTitle, "dropBattle");
                    await interaction.editReply({ embeds: [embedData.embed], files: embedData.files });
                    await wait(1000);
                }

                return target.stats.hp <= 0;
            };

            let isDead = await runTurnLifecycle(first, second);
            if (isDead) { battleOver = true; playerWon = (first === player); break; }
            
            isDead = await runTurnLifecycle(second, first);
            if (isDead) { battleOver = true; playerWon = (second === player); break; }

            turn++;
        }

        if (!battleOver && turn > MAX_TURNS) {
            battleOver = true;
            playerWon = false;
            logs.push("⌛ **Time Limit Exceeded!** The card fled.");
        }

        // 6. Conclusion
        if (playerWon) {
            // --- VICTORY ---
            const nextUid = await getNextUid(userId);
            await Cards.create({
                ownerId: userId,
                uid: nextUid,
                cardId: wildCardData.pokeId,
                stats: uniqueStats,
                rarity: rarity,
                level: 1,
                xp: 0
            });

            // Update Spawn Message
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("claimed")
                    .setLabel(`Captured by ${interaction.user.username}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );
            await originalMessage.edit({ components: [disabledRow] });

            // Final Win Embed
            const winEmbed = new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle(`🎉 VICTORY!`)
                .setDescription(`**${interaction.user.username}** defeated **Wild ${wildCardData.name}**!`)
                .addFields(
                    { name: "Rewards", value: `You captured **${wildCardData.name}** ${getRarityStars(rarity)}!` }
                )
                .setImage(formatImage(wildCardData.image,330,550));

            await interaction.editReply({ content: null, embeds: [winEmbed], files: [] });
            // Public announce
            await interaction.channel.send(`🎉 **${interaction.user.username}** successfully captured **${wildCardData.name}**!`);

        } else {
            // --- DEFEAT ---
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("ran_away")
                    .setLabel("Ran Away")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            await originalMessage.edit({ content: "💨 The card ran away after a fierce battle...", components: [disabledRow] });

            const lossEmbed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle(`💀 DEFEAT`)
                .setDescription(`**${player.name}** was defeated by **${enemy.name}**... The card fled.`);
            
            await interaction.editReply({ content: null, embeds: [lossEmbed], files: [] });
        }

    } catch (err) {
        console.error("Drop Battle Error:", err);
        interaction.editReply({ content: "❌ An error occurred during the battle." });
    } finally {
        removeUserBattling(userId);
    }
}

module.exports = { startDropBattle };