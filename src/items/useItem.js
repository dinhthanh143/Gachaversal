const { UserContainer, Inventory, Cards, Index } = require("../db");
const items = require("./items"); // Adjust path if needed
const { getRarityStars, getNextUid } = require("../functions");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

// ==========================================
// 1. CONFIGURATION
// ==========================================

const RARITY_LEVEL_CAPS = {
  1: 40,
  2: 50,
  3: 60,
  4: 80,
  5: 90,
  6: 100,
};

const LOADING_GIF = "https://res.cloudinary.com/pachi/image/upload/v1766588382/loadingGif1-ezgif.com-crop_qniwcq.gif";

const getCardLevelCap = (level) => {
  if (level <= 50) {
    return Math.floor(50 * Math.pow(level, 2));
  } else {
    return 125000 + (level - 50) * 2000;
  }
};

function calculateStats(baseStats, rarity) {
  if (!baseStats) baseStats = { hp: 75, atk: 60, def: 50, speed: 69 };
  return {
    hp: Math.floor(baseStats.hp * (3 + rarity) + rarity * 20 + Math.floor(Math.random() * 20)),
    atk: Math.floor(baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10)),
    def: Math.floor(baseStats.def + 20 * rarity + Math.floor(Math.random() * 10)),
    speed: Math.floor(baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5)),
  };
}

// ==========================================
// 2. MAIN COMMAND
// ==========================================
async function useitem(message) {
  try {
    const args = message.content.split(" ");
    // Format: !useitem [itemId] [quantity] [cardUID]
    const itemIdInput = args[1];
    const qtyInput = parseInt(args[2]);
    const cardUidInput = args[3] ? parseInt(args[3]) : null;

    // --- A. BASIC VALIDATION ---
    if (!itemIdInput || isNaN(qtyInput)) {
      return message.reply(
        "**Usage:** `!useitem [item_id] [quantity] [card_uid (if needed)]`"
      );
    }

    if (qtyInput < 1) return message.reply("Quantity must be at least 1.");

    const userId = message.author.id;
    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("No account found.");

    const userInv = await Inventory.findOne({ userId });
    if (!userInv) return message.reply("Inventory empty.");
    
    const itemInInv = userInv.items.find((i) => i.itemId === itemIdInput);
    if (!itemInInv || itemInInv.amount < qtyInput) {
      return message.reply(`❌ You don't have **x${qtyInput}** of item \`${itemIdInput}\`.`);
    }

    const itemData = items[itemIdInput];
    if (!itemData) return message.reply("❌ Invalid item ID.");

    // ====================================================
    // 🎁 SPECIAL LOGIC: 5-STAR CHARACTER CHEST (c5)
    // ====================================================
    if (itemIdInput === "c5") {
        
        if (qtyInput > 1) {
            return message.reply("❌ You can only open **1** Character Chest at a time!");
        }

        const loaderEmbed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("Opening chest...")
            .setImage(LOADING_GIF);
        
        const replyMsg = await message.reply({ embeds: [loaderEmbed] });

        // Consume
        itemInInv.amount -= 1;
        await userInv.save();

        // Generate Reward
        const randomAgg = await Index.aggregate([{ $sample: { size: 1 } }]);
        const baseData = randomAgg[0];
        const fixedRarity = 5; 

        const uniqueStats = calculateStats(baseData.stats, fixedRarity);
        const nextUid = await getNextUid(userId)
        await Cards.create({
            ownerId: userId,
            uid: nextUid,
            cardId: baseData.pokeId,
            stats: uniqueStats,
            rarity: fixedRarity,
            level: 1,
            xp: 0
        });

        // Result Embed
        const resultEmbed = new EmbedBuilder()
            .setColor("#FFD700")
            .setAuthor({ 
                name: `${message.author.username}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle(`🎉 Congrats ${message.author.username}!`)
            .setDescription(`You opened **${itemData.name}** and received:\n\n${getRarityStars(fixedRarity)} **${baseData.name}**`)
            .setImage(baseData.image);

        await replyMsg.edit({ embeds: [resultEmbed] });
        return; 
    }

    // ====================================================
    // 🧪 STANDARD LOGIC: XP ITEMS (BLESSINGS)
    // ====================================================
    
    if (cardUidInput === null || isNaN(cardUidInput)) {
        return message.reply(`❌ **${itemData.name}** requires a target card UID.\nUsage: \`!useitem ${itemIdInput} ${qtyInput} [Card UID]\``);
    }

    if (!itemData.xpAmount) {
      return message.reply("❌ That item cannot be used.");
    }

    // ✅ FIND CARD BY UID (with fallback for index if using old system)
    const userCards = await Cards.find({ ownerId: userId }).populate("masterData").sort({ _id: 1 });
    
    // Attempt to find by UID first
    let targetCard = userCards.find(c => c.uid === cardUidInput);
    
    // Fallback: If no UID match, check index (1-based)
    if (!targetCard && cardUidInput <= userCards.length) {
       targetCard = userCards[cardUidInput - 1];
    }

    if (!targetCard) {
      return message.reply(`❌ Card with UID **#${cardUidInput}** not found.`);
    }

    const master = targetCard.masterData;
    const currentRarityCap = RARITY_LEVEL_CAPS[targetCard.rarity] || 60;

    if (targetCard.level >= currentRarityCap) {
        return message.reply(`⚠️ **${master.name}** is already at the max level (**${currentRarityCap}**) for their rarity!`);
    }

    // --- PRE-CALCULATE LEVEL UP (SIMULATION) ---
    const totalXpToAdd = qtyInput * itemData.xpAmount;
    let simLevel = targetCard.level;
    let simXp = targetCard.xp + totalXpToAdd;
    let simXpCap = getCardLevelCap(simLevel);

    while (simXp >= simXpCap && simLevel < currentRarityCap) {
        simXp -= simXpCap;
        simLevel++;
        simXpCap = getCardLevelCap(simLevel);
    }
    // Cap logic if max reached
    if (simLevel >= currentRarityCap) {
        simLevel = currentRarityCap;
        simXp = 0; // or max
    }

    // --- CONFIRMATION ---
    const confirmEmbed = new EmbedBuilder()
      .setColor("#FFFF00")
      .setTitle("Confirm Item Usage")
      .setDescription(`Are you sure you want to use resources on this card?`)
      .addFields(
        { 
            name: "🎒 Item", 
            value: `**x${qtyInput} ${itemData.name}**\nXP: +**${totalXpToAdd.toLocaleString()}**`, 
            inline: true 
        },
        { 
            name: "🎴 Target Card", 
            value: `**#${targetCard.uid} ${master.name}**\n` + 
                   `${getRarityStars(targetCard.rarity)}\n` +
                   `Lv. **${targetCard.level}** ➔ Lv. **${simLevel}** / ${currentRarityCap}`, 
            inline: true 
        }
      );

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("confirm_use").setLabel("Confirm").setStyle(ButtonStyle.Success).setEmoji("✅"),
      new ButtonBuilder().setCustomId("cancel_use").setLabel("Cancel").setStyle(ButtonStyle.Danger).setEmoji("✖️")
    );

    const replyMsg = await message.reply({ embeds: [confirmEmbed], components: [confirmRow] });

    const filter = (i) => i.user.id === userId;
    const collector = replyMsg.createMessageComponentCollector({ filter, time: 30000, max: 1, componentType: ComponentType.Button });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "cancel_use") {
        await interaction.update({ content: "❌ Action cancelled.", embeds: [], components: [] });
        return;
      }

      if (interaction.customId === "confirm_use") {
        // Re-check inventory
        const freshInv = await Inventory.findOne({ userId });
        const freshItem = freshInv.items.find(i => i.itemId === itemIdInput);
        if (!freshItem || freshItem.amount < qtyInput) {
            return interaction.update({ content: "❌ Item quantity changed. Transaction failed.", embeds: [], components: [] });
        }

        // Consume
        freshItem.amount -= qtyInput;
        await freshInv.save();

        // Apply Real Changes
        targetCard.xp += totalXpToAdd;
        const oldLevel = targetCard.level;
        let xpCap = getCardLevelCap(targetCard.level);
        let levelsGained = 0;

        while (targetCard.xp >= xpCap && targetCard.level < currentRarityCap) {
            targetCard.xp -= xpCap;
            targetCard.level++;
            levelsGained++;

            // Update Stats per level
            targetCard.stats.hp = Math.floor(targetCard.stats.hp * 1.015);
            targetCard.stats.atk = Math.floor(targetCard.stats.atk * 1.015);
            targetCard.stats.def = Math.floor(targetCard.stats.def * 1.013);
            targetCard.stats.speed = Math.floor(targetCard.stats.speed * 1.01);

            xpCap = getCardLevelCap(targetCard.level);
        }

        if (targetCard.level >= currentRarityCap) {
            targetCard.xp = 0;
            targetCard.xpCap = 0; 
        } else {
            targetCard.xpCap = xpCap;
        }

        await targetCard.save();

        const successEmbed = new EmbedBuilder()
            .setColor("#00FF00")
            .setAuthor({ name: "Level Up Success!", iconURL: message.author.displayAvatarURL() })
            .setThumbnail(master.image);

        if (levelsGained > 0) {
            successEmbed.setDescription(`✅ Successfully used **x${qtyInput} ${itemData.name}**!\n\n` + 
                `📈 **${master.name}** leveled up!\n` + 
                `**Lv. ${oldLevel}** ➔ **Lv. ${targetCard.level}**\n` + 
                `*(Gained ${totalXpToAdd.toLocaleString()} XP)*`
            );
        } else {
            successEmbed.setDescription(`✅ Successfully used **x${qtyInput} ${itemData.name}**!\n\n` +
                `✨ **${master.name}** gained **${totalXpToAdd.toLocaleString()} XP**.\n` + 
                `Progress: **${targetCard.xp} / ${targetCard.xpCap}**`
            );
        }

        await interaction.update({ embeds: [successEmbed], components: [] });
      }
    });

    collector.on("end", (collected, reason) => {
        if (reason === 'time') {
            replyMsg.edit({ content: "⌛ Time expired.", components: [] }).catch(() => {});
        }
    });

  } catch (e) {
    console.error(e);
    message.reply("Error using item.");
  }
}

module.exports = { useitem };