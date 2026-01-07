const characters = require("../characters/characters");

// Convert the exported object into an array for easy searching
const characterList = Object.values(characters);

// ==========================================
// 📊 XP SCALING LOGIC
// ==========================================

const getCardLevelCap = (level) => {
  if (level <= 50) {
    return Math.floor(50 * Math.pow(level, 2));
  } else {
    return 125000 + ((level - 50) * 2000); 
  }
};

const getRunsPerLevel = (level) => {
  if (level < 20) return 5.0;      
  if (level < 40) return 10.0;     
  if (level < 60) return 15.0;     
  if (level < 80) return 20.0;     
  if (level <= 90) return 30.0;    
  return 30.0;
};

const getFixedCardXp = (difficultyLevel) => {
  const xpCap = getCardLevelCap(difficultyLevel);
  const ratio = getRunsPerLevel(difficultyLevel);
  return Math.floor(xpCap / ratio);
};

// ==========================================
// ⚙️ MOB GENERATION & SCALING
// ==========================================

const SCALING = {
  // 📈 PLAYER GROWTH RATES
  GROWTH_RATES: {
    HP: 1.02,     // +2.0% per level
    ATK: 1.015,   // +1.5% per level
    DEF: 1.013,   // +1.3% per level
    SPEED: 1.01   // +1.0% per level
  },

  // Rarity 1-6 Config
  RARITY: {
    1: { name: "Common", xpMult: 1.0, dropMult: 1.0 },
    2: { name: "Rare",   xpMult: 1.5, dropMult: 1.2 },
    3: { name: "Elite",  xpMult: 2.5, dropMult: 1.5 },
    4: { name: "Boss",   xpMult: 5.0, dropMult: 2.0 },
    5: { name: "Mythic", xpMult: 8.0, dropMult: 2.5 },
    6: { name: "God",    xpMult: 12.0, dropMult: 3.0 },
  },
};

function getThreatIcons(rarity) {
  const r = Math.max(1, Math.min(6, rarity));
  return "💀".repeat(r);
}

function calculateStats(baseStats, rarity) {
  if (!baseStats) baseStats = { hp: 75, atk: 60, def: 50, speed: 69 };
  return {
    hp: Math.floor(baseStats.hp * (3 + rarity) + rarity * 20 + Math.floor(Math.random() * 20)),
    atk: Math.floor(baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10)),
    def: Math.floor(baseStats.def + 20 * rarity + Math.floor(Math.random() * 10)),
    speed: Math.floor(baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5)),
  };
}

/**
 * Creates a modified instance of a mob (based on Character Data).
 */
function moddedMob(charId, targetLevel, rarity = 1) {
  // 1. Find the Character Template
  const template = characterList.find((c) => c.pokeId == charId);
  
  if (!template) {
    return { 
      name: "MissingNo", 
      level: targetLevel, 
      rarity: rarity,
      stats: { hp: 100, atk: 10, def: 10, speed: 10 }, 
      rewards: { gold: 0, xp: 0, drops: [] },
      skill: { name: "Bug", description: "Does nothing", values: [] },
    };
  }

  const mob = JSON.parse(JSON.stringify(template));
  
  // 2. Set Basic Info
  mob.level = targetLevel;
  mob.rarity = rarity;
  mob.enemyId = template.pokeId.toString();
  
  const skulls = getThreatIcons(rarity);
  mob.name = `${skulls} ${mob.name}`;

  // 3. Calculate Stats
  const baseRarityStats = calculateStats(template.stats, rarity);
  const levelsToGrow = Math.max(0, targetLevel - 1);

  mob.stats = {
    hp: Math.floor(baseRarityStats.hp * Math.pow(SCALING.GROWTH_RATES.HP, levelsToGrow)),
    atk: Math.floor(baseRarityStats.atk * Math.pow(SCALING.GROWTH_RATES.ATK, levelsToGrow)),
    def: Math.floor(baseRarityStats.def * Math.pow(SCALING.GROWTH_RATES.DEF, levelsToGrow)),
    speed: Math.floor(baseRarityStats.speed * Math.pow(SCALING.GROWTH_RATES.SPEED, levelsToGrow))
  };

  // 4. Resolve Skill Values & Description
  if (mob.skill && mob.skill.values) {
    const rarityIndex = Math.max(0, rarity - 1);
    const avgGrowth = (SCALING.GROWTH_RATES.ATK + SCALING.GROWTH_RATES.HP) / 2;
    const skillLevelMult = Math.pow(avgGrowth, levelsToGrow);
    const resolvedValues = [];

    if (Array.isArray(mob.skill.values) && Array.isArray(mob.skill.values[0])) {
      mob.skill.values.forEach((valArray, i) => {
        let baseVal = valArray[rarityIndex] !== undefined ? valArray[rarityIndex] : valArray[valArray.length - 1];
        let finalVal = baseVal;
        if (baseVal > 1) finalVal = parseFloat((baseVal * skillLevelMult).toFixed(2));
        resolvedValues.push(finalVal);
        const regex = new RegExp(`\\{${i}\\}`, "g");
        mob.skill.description = mob.skill.description.replace(regex, finalVal);
      });
      mob.skill.values = resolvedValues;
    } else {
      const baseVal = Array.isArray(mob.skill.values) ? mob.skill.values[0] : mob.skill.values;
      const finalVal = parseFloat((baseVal * skillLevelMult).toFixed(2));
      mob.skill.values = [finalVal];
      mob.skill.description = mob.skill.description.replace(/\{0\}/g, finalVal);
    }
  }

  // 5. Rewards Scaling (ADDED BACK ✅)
  const rConfig = SCALING.RARITY[rarity] || SCALING.RARITY[1];
  const econGrowth = Math.pow(1.03, levelsToGrow); // 3% compound growth per level
  const baseGold = 25; 
  const baseXp = 15; 

  mob.rewards = {
    gold: Math.floor(baseGold * econGrowth * rConfig.xpMult),
    xp: Math.floor(baseXp * econGrowth * rConfig.xpMult), // Visual/Account XP
    drops: [] 
  };

  return mob;
}

// ==========================================
// 🗺️ DUNGEON AREAS CONFIG
// ==========================================

const createStage = (difficultyLevel, mobData) => {
  return {
    difficultyLevel: difficultyLevel,
    mobs: [mobData], 
    cardXp: getFixedCardXp(difficultyLevel) 
  };
};

const DUNGEON_AREAS = {
  // --- AREA 1: The Beginning ---
  1: {
    name: "Shallow Floors ⚔️",
    stages: {
      1: createStage(2, moddedMob(1, 10, 1)),   // Galbrena Lv.2 Common
      2: createStage(3, moddedMob(2, 3, 1)),   // Carlotta Lv.3 Common
      3: createStage(4, moddedMob(3, 4, 1)),   // Chisa Lv.4 Common
      4: createStage(4, moddedMob(1, 5, 2)),   // Galbrena Lv.5 Rare
      5: createStage(5, moddedMob(4, 5, 2)),   // Rover Lv.5 Rare (Boss)
    }
  },
  
  // --- AREA 2: The Dark Hall ---
  2: {
    name: "The Dark Hall ☠️",
    stages: {
      1: createStage(2, moddedMob(5, 6, 1)),   // Ye Lv.6 Common
      2: createStage(3, moddedMob(6, 7, 1)),   // QiuYuan Lv.7 Common
      3: createStage(4, moddedMob(5, 8, 2)),   // Ye Lv.8 Rare
      4: createStage(4, moddedMob(7, 9, 2)),   // Miyabi Lv.9 Rare
      5: createStage(5, moddedMob(8, 10, 3)),  // Yixuan Lv.10 Elite
    }
  }
};

module.exports = { 
  moddedMob, 
  DUNGEON_AREAS, 
  getFixedCardXp, 
  getCardLevelCap,
  SCALING 
};