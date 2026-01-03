const { mobs } = require("../characters/mob");

// ==========================================
// 📊 XP SCALING LOGIC (Player Grind)
// ==========================================

// 1. THE CURVE (XP Needed to Level Up)
const getCardLevelCap = (level) => {
  if (level <= 50) {
    return Math.floor(50 * Math.pow(level, 2));
  } else {
    return 125000 + ((level - 50) * 2000); 
  }
};

// 2. THE PACING (Runs to Level Up)
const getRunsPerLevel = (level) => {
  if (level < 20) return 5.0;      
  if (level < 40) return 10.0;     
  if (level < 60) return 15.0;     
  if (level < 80) return 20.0;     
  if (level <= 90) return 30.0;    
  return 30.0;
};

// 3. DROP CALCULATION
const getFixedCardXp = (difficultyLevel) => {
  const xpCap = getCardLevelCap(difficultyLevel);
  const ratio = getRunsPerLevel(difficultyLevel);
  return Math.floor(xpCap / ratio);
};

// ==========================================
// ⚙️ MOB GENERATION & SCALING
// ==========================================
const SCALING = {
  // 📈 GROWTH RATE (Compound Interest)
  // 0.03 = 3% increase per level.
  // Lv 1 = 1x stats
  // Lv 50 = ~4.3x stats
  // Lv 200 = ~360x stats (This fixes the weak high-level mobs)
  GROWTH_RATE: 0.03,

  FACTORS: {
    HP: 4.0,      // Mobs get 8x Base HP (Makes them tanky)
    ATK: 1.0,     // Mobs get 1x Base ATK
    DEF: 0.8,     // Mobs get 0.8x Base DEF (So players can actually hurt them)
    SPEED: 0.06,  // Linear Speed Scaling per level (2% per level, NOT exponential)
  },

  // ✨ RARITY MULTIPLIERS
  RARITY: {
    1: { name: "Common", statMult: 1.0, xpMult: 1.0, dropMult: 1.0 },
    2: { name: "Rare",   statMult: 1.3, xpMult: 1.5, dropMult: 1.2 },
    3: { name: "Elite",  statMult: 1.8, xpMult: 2.5, dropMult: 1.5 },
    4: { name: "Boss",   statMult: 3.5, xpMult: 5.0, dropMult: 2.0 }, // Buffed Boss statMult
  },
};

/**
 * Creates a modified instance of a mob.
 */
function moddedMob(mobId, targetLevel, rarity = 1) {
  const template = mobs.find((m) => m.enemyId === mobId);
  if (!template) return { name: "MissingNo", level: 1, stats: { hp: 10, atk: 1 }, rewards: { gold: 0 } };

  const mob = JSON.parse(JSON.stringify(template));
  const rConfig = SCALING.RARITY[rarity] || SCALING.RARITY[1];
  
  const growthFactor = Math.pow(1 + SCALING.GROWTH_RATE, targetLevel - 1);
  
  // 1. Stats Scaling
  mob.stats.hp = Math.floor(template.stats.hp * growthFactor * rConfig.statMult * SCALING.FACTORS.HP);
  mob.stats.atk = Math.floor(template.stats.atk * growthFactor * rConfig.statMult * SCALING.FACTORS.ATK);
  mob.stats.def = Math.floor(template.stats.def * growthFactor * rConfig.statMult * SCALING.FACTORS.DEF);

  const speedMult = 1 + ((targetLevel - 1) * SCALING.FACTORS.SPEED);
  mob.stats.speed = Math.floor(template.stats.speed * speedMult * rConfig.statMult);

  mob.level = targetLevel;
  mob.rarity = rarity;
  if (rarity > 1) mob.name = `${rConfig.name} ${mob.name}`;
  
  // 2. Skill Scaling (+0.2 per Threat Rarity)
  if (template.skill && template.skill.values) {
    // Base Value * Growth * (1 + (Rarity * 0.2))
    // e.g. Rarity 1 = 1.2x, Rarity 4 (Boss) = 1.8x
    const rarityBonus = 0 + (rarity * 0.2);
    
    mob.skill.values = parseFloat((template.skill.values * growthFactor * rarityBonus).toFixed(2));
  }

  // 3. Rewards Scaling
  mob.rewards.gold = Math.floor(template.rewards.gold * growthFactor * rConfig.xpMult);
  mob.rewards.xp = Math.floor(template.rewards.xp * growthFactor * rConfig.xpMult);

  // 4. Drops
  if (mob.rewards.drops) {
    mob.rewards.drops.forEach((drop) => {
      drop.chance = parseFloat((drop.chance * rConfig.dropMult).toFixed(2));
      if (drop.chance > 1.0) drop.chance = 1.0;
    });
  }

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
      1: createStage(2, moddedMob("1", 70, 1)), 
      2: createStage(3, moddedMob("1", 3, 1)), 
      3: createStage(4, moddedMob("2", 4, 1)), 
      4: createStage(4, moddedMob("1", 4, 2)), 
      5: createStage(5, moddedMob("3", 5, 2)), 
    }
  },
  
  // --- AREA 2: The Dark Hall ---
  2: {
    name: "The Dark Hall ☠️",
    stages: {
       1: createStage(2, moddedMob("1", 2, 1)),
      2: createStage(3, moddedMob("1", 3, 1)), 
      3: createStage(4, moddedMob("2", 4, 1)), 
      4: createStage(4, moddedMob("1", 4, 2)), 
      5: createStage(5, moddedMob("3", 5, 2)), 
    }
  }
};

module.exports = { 
  moddedMob, 
  DUNGEON_AREAS, 
  getFixedCardXp, 
  getCardLevelCap 
};