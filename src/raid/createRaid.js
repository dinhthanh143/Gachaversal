// src/commands/createRaid.js
const { Index } = require("../db");
const { EmbedBuilder } = require("discord.js");
const { getRarityStars } = require("../functions");

// ==========================================
// ⚙️ SCALING CONSTANTS (Matches Dungeon Data)
// ==========================================
const SCALING = {
  GROWTH_RATES: {
    HP: 1.02, // +2.0% per level
    ATK: 1.015, // +1.5% per level
    DEF: 1.013, // +1.3% per level
    SPEED: 1.008, // +1.0% per level
  },
  FACTORS: {
    HP: 7.0, // Boss HP Multiplier
    ATK: 1.0, // Boss ATK Multiplier
    DEF: 0.8, // Boss DEF Multiplier
  },
  RARITY: {
    1: { name: "Common", statMult: 1.0 },
    2: { name: "Rare", statMult: 1.3 },
    3: { name: "Elite", statMult: 1.8 },
    4: { name: "Boss", statMult: 3.5 }, // Huge Boss Boost
    5: { name: "Boss+", statMult: 5.0 }, // coordination required
    6: { name: "Mythic", statMult: 7.0 }, // raid wall
  },
};

async function createRaid(message) {
  try {
    const args = message.content.split(" ");
    const rarityInput = parseInt(args[1]);
    const levelInput = parseInt(args[2]);

    if (
      isNaN(rarityInput) ||
      isNaN(levelInput) ||
      rarityInput < 1 ||
      levelInput < 1
    ) {
      return message.reply(
        "⚠️ Usage: `!createraid [rarity 1-4] [level]`\nExample: `!createraid 4 50`"
      );
    }

    // 1. Pick a Random Character from Index
    const randomAgg = await Index.aggregate([{ $sample: { size: 1 } }]);
    if (!randomAgg || randomAgg.length === 0) {
      return message.reply("❌ Error: No cards found in Index.");
    }
    const baseData = randomAgg[0];

    // 2. Apply Scaling Logic (Simulating moddedMob)
    const levelsToGrow = Math.max(0, levelInput - 1);
    const rConfig = SCALING.RARITY[rarityInput] || SCALING.RARITY[4];

    // --- Stats Math ---
    // Formula: Base * (Growth ^ Levels) * RarityMult * MobFactor
    const stats = {
      hp: Math.floor(
        baseData.stats.hp *
          Math.pow(SCALING.GROWTH_RATES.HP, levelsToGrow) *
          rConfig.statMult *
          SCALING.FACTORS.HP
      ),
      atk: Math.floor(
        baseData.stats.atk *
          Math.pow(SCALING.GROWTH_RATES.ATK, levelsToGrow) *
          rConfig.statMult *
          SCALING.FACTORS.ATK
      ),
      def: Math.floor(
        baseData.stats.def *
          Math.pow(SCALING.GROWTH_RATES.DEF, levelsToGrow) *
          rConfig.statMult *
          SCALING.FACTORS.DEF
      ),
      speed: Math.floor(
        baseData.stats.speed *
          Math.pow(SCALING.GROWTH_RATES.SPEED, levelsToGrow) *
          rConfig.statMult
      ),
    };

    // --- Skill Parsing & Scaling ---
    let finalSkillDesc = baseData.skill.description;

    // Calculate Skill Growth (Avg of HP/ATK growth)
    const avgGrowth = (SCALING.GROWTH_RATES.ATK + SCALING.GROWTH_RATES.HP) / 2;
    const skillGrowth = Math.pow(avgGrowth, levelsToGrow);
    const rarityBonus = 1 + rarityInput * 0.2; // +20% per rarity level

    if (baseData.skill.values && baseData.skill.values.length > 0) {
      // Map based on Rarity Index (User Input Rarity)
      const rarityIndex = Math.max(0, rarityInput - 1);

      baseData.skill.values.forEach((valArray, i) => {
        if (Array.isArray(valArray) && valArray.length > 0) {
          // Get Base Value
          let baseVal =
            valArray[rarityIndex] !== undefined
              ? valArray[rarityIndex]
              : valArray[valArray.length - 1];

          // Apply Scaling
          const scaledVal = Math.floor(baseVal * skillGrowth * rarityBonus);

          // Replace placeholder {0}, {1}
          const regex = new RegExp(`\\{${i}\\}`, "g");
          finalSkillDesc = finalSkillDesc.replace(regex, `**${scaledVal}**`);
        }
      });
    }

    // 3. Build Embed
    const rarityStars = getRarityStars(rarityInput);
    const title = `[RAID TEST] ${rConfig.name} ${baseData.name} - Lv. ${levelInput}`;

    const embed = new EmbedBuilder()
      .setColor(baseData.cardColor || "#FF0000") // Default Red for Raid
      .setTitle(title)
      .setImage(baseData.image) // Use base image as thumbnail
      .setDescription(`*Simulated Raid Boss Stats*`)
      .addFields(
        {
          name: "📊 Info",
          value: `**Rarity:** ${rarityStars}\n**Type:** ${
            baseData.type
          }\n**Franchise:** ${baseData.franchise || "Unknown"}`,
          inline: false,
        },
        {
          name: "⚔️ Scaled Stats",
          value: `⚔️ **ATK:** ${stats.atk.toLocaleString()}\n🩸 **HP:** ${stats.hp.toLocaleString()}\n💨 **SPD:** ${stats.speed.toLocaleString()}\n🛡️ **DEF:** ${stats.def.toLocaleString()}`,
          inline: false,
        },
        {
          name: ` Skill: ${baseData.skill.name} ${baseData.skill.icon || ""}`,
          value: finalSkillDesc,
          inline: false,
        }
      )
      .setFooter({
        text: `Base ID: ${baseData.pokeId} | This is a simulation, not saved.`,
      });

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    message.reply("❌ Error creating raid test.");
  }
}

module.exports = { createRaid };
