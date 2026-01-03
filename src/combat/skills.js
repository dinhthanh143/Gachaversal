const { getTypeMultiplier } = require("../utils/typeMultiplier");
const { addBuff } = require("./effects");

function calculateDamage(attacker, defender, rawDamage, isCrit = false) {
  const atkType = attacker.type || "Neutral";
  const defType = defender.type || "Neutral";

  // 1. Apply Crit Multiplier (if passed as true)
  // Default Crit Dmg is 140%, but we use the stat if available
  let critMult = 1.0;
  if (isCrit) {
    const critDmgStat = attacker.stats.critDmg || 140;
    critMult = critDmgStat / 100;
  }

  // 2. Check for Damage Boost Buffs
  let damageMultiplier = 1.0;
  if (attacker.effects) {
    const boostIndex = attacker.effects.findIndex((e) => e.stat === "dmgBoost");
    if (boostIndex !== -1) {
      const boostEffect = attacker.effects[boostIndex];
      damageMultiplier += boostEffect.amount / 100;
      attacker.effects.splice(boostIndex, 1);
    }
  }

  // 3. Type Multiplier
  const typeMult = getTypeMultiplier(atkType, defType);

  // 4. Calculate
  let effectiveDamage = Math.floor(rawDamage * critMult * damageMultiplier * typeMult);

  // 5. Defender Mitigation (Damage Reduction Buffs)
  if (defender.effects) {
    const redEffect = defender.effects.find(e => e.stat === "dmgRed");
    if (redEffect) {
      const mitigation = 1 - (redEffect.amount / 100);
      effectiveDamage = Math.floor(effectiveDamage * mitigation);
    }
  }

  // 6. Defense Calc
  const defStat = defender.stats ? defender.stats.def : 0;
  const defenseFactor = 100 / (100 + defStat);
  const finalDamage = Math.max(1, Math.floor(effectiveDamage * defenseFactor));

  let suffix = "";
  if (isCrit) suffix += " **(CRIT!)**"; // Internal flag
  if (typeMult > 1.0) suffix += "\n **It was SUPER EFFECTIVE!**";
  else if (typeMult < 1.0) suffix += "\n *It wasn't very effective...*";
  if (damageMultiplier > 1.0) suffix += " ( **Counter-Boosted!**)";

  return { damage: finalDamage, suffix };
}

const Skills = {
  // ✅ THE HERTA (Energy Gamble)
  "Key of Interpretation": {
    initialEnergy: 25,
    requiredEnergy: 75,
    name: "Key of Interpretation",
    icon: "<:herta_skill:1456549247611699200>",
    description: "Randomly sets enemy Energy. If lower, Herta takes DMG. If higher, Enemy takes Ice DMG based on gap.",
    execute: (attacker, defender, skillValues = [[0.6], [0.5]]) => {
      // 1. Parse Multipliers
      const selfMult = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 0.6;
      const enemyMult = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 0.5;

      // 2. Determine Cap (Enemy's Required Energy)
      const cap = (defender.skill && defender.skill.requiredEnergy) ? defender.skill.requiredEnergy : 100;

      // 3. Get Energies & Randomize
      const oldEnergy = defender.energy || 0;
      const newEnergy = Math.floor(Math.random() * (cap + 1)); 
      defender.energy = newEnergy; 

      // 4. Calculate Gap
      const gap = Math.abs(oldEnergy - newEnergy);
      const gapRatio = gap / cap; 
      const gapPercent = Math.floor(gapRatio * 100);

      let log = ` **${attacker.name}** uses **Key of Interpretation**!\n`;
      log += `Enemy Energy: **${oldEnergy}** ➔ **${newEnergy}**\n`;

      // 5. Resolution Logic
      if (oldEnergy > newEnergy) {
        // CASE A: Energy Lowered (Bad for Herta) -> Herta takes TRUE Self Damage
        const damage = Math.floor(attacker.maxHp * gapRatio * selfMult);
        attacker.stats.hp -= damage;
        log += `Gap: **${gapPercent}%** (Lost) ➔ **${attacker.name}** took **${damage}** self-damage!`;
      
      } else if (oldEnergy < newEnergy) {
        // CASE B: Energy Increased (Good for Herta) -> Enemy takes ICE Damage
        // We assume the HP% calculation is the "Raw Damage" before Def/Type
        const rawIceDmg = Math.floor(attacker.maxHp * gapRatio * enemyMult);
        
        // Use calculateDamage to apply Type Multiplier (Ice vs Fire) and Defense
        const { damage, suffix } = calculateDamage(attacker, defender, rawIceDmg, false);
        
        defender.stats.hp -= damage;
        log += `Gap: **${gapPercent}%** (Gained) ➔ **${defender.name}** received **${damage}** Ice DMG!${suffix}`;
      
      } else {
        // CASE C: Exact same energy
        log += `Gap: **0%** ➔ Nothing happened.`;
      }

      return { damage: 0, log };
    },
  },

  // ✅ CHISA (Logic Update: Cleaner Stacking)
  "Tactical Overclock": {
    initialEnergy: 25,
    requiredEnergy: 75,
    name: "Tactical Overclock",
    icon: "<:chisa_skill:1446787026392190997>",
    description: "Gains {0}% Crit Rate and +{1}% Speed per stack (max 3 stacks).",
    execute: (attacker, defender, skillValues = [[10], [1]]) => {
      // 1. Parse Base Values (Per Stack)
      const critBase = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 10;
      const spdBase = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 1;

      if (!attacker.effects) attacker.effects = [];

      // 2. Find Existing Buffs
      const critEff = attacker.effects.find(e => e.name === "Tactical Overclock" && e.stat === "critRate");
      const spdEff = attacker.effects.find(e => e.name === "Tactical Overclock" && e.stat === "speed");

      // 3. CASE A: Start New Stack (If not found)
      if (!critEff) {
         addBuff(attacker, "Tactical Overclock", "critRate", critBase, 4, 1);
         addBuff(attacker, "Tactical Overclock", "speed", spdBase, 4, 1);
         return { damage: 0, log: `✨ **${attacker.name}** enters Overclock! (Stack 1)\nCurrently: **+${critBase}% Crit**, **+${spdBase} SPD**` };
      }

      // 4. CASE B: Stack Exists - Refresh & Accumulate
      let stacks = critEff.extra || 1;
      
      // Always Reset Duration (Refresh)
      critEff.turns = 4;
      if (spdEff) spdEff.turns = 4;

      if (stacks < 3) {
         stacks++;
         
         // Accumulate Values in the Buff Object
         critEff.amount += critBase;
         if (spdEff) spdEff.amount += spdBase;
         
         // Apply ONLY the Delta to Real Stats
         if (attacker.stats.critRate !== undefined) attacker.stats.critRate += critBase;
         if (attacker.stats.speed !== undefined) attacker.stats.speed += spdBase;

         // Update Stack Counter
         critEff.extra = stacks;
         if (spdEff) spdEff.extra = stacks;

         return { damage: 0, log: `✨ **${attacker.name}** Overclock Rising! (Stack ${stacks})\nTotal: **+${critEff.amount}% Crit**, **+${spdEff ? spdEff.amount : 0} SPD**` };
      }

      // 5. CASE C: Max Stacks (Just Refresh)
      return { damage: 0, log: `✨ **${attacker.name}** Overclock Refreshed! (Max Stacks)` };
    },
  },

  // ✅ CARLOTTA (Standard Energy)
  "Piercing Shards": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Piercing Shards",
    icon: "<:carlotta_skill:1446787543092822027>",
    description: "Fires three searing shots, each dealing {0}× ATK. {1}% Crit Chance.",
    execute: (attacker, defender, skillValues = [[0.3], [10]]) => {
      const dmgMult = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 0.3;
      const critChance = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 10;
      let totalDamage = 0;
      let critCount = 0;
      let typeSuffix = "";
      
      for (let i = 0; i < 3; i++) {
        let rawHit = attacker.stats.atk * dmgMult;
        if (Math.random() * 100 < critChance) {
           rawHit = Math.floor(rawHit * 1.4); 
           critCount++;
        }
        const result = calculateDamage(attacker, defender, rawHit);
        totalDamage += result.damage;
        if (!typeSuffix) typeSuffix = result.suffix;
      }
      
      defender.stats.hp -= totalDamage;
      
      let log = `❄️ **${attacker.name}** fires **Piercing Shards** (3 hits)!`;
      if (critCount > 0) log += `\n💥 **${critCount}** of them **Critted**!`;
      log += `\nDealt a total of **${totalDamage}** DMG!${typeSuffix}`;

      return { damage: totalDamage, log };
    },
  },

  // ✅ GALBRENA (Standard Energy)
  "Flamming bullets": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Flamming bullets",
    icon: "<:galbrena_skill:1446787462742409298>",
    description: "Fires incendiary rounds dealing {0}× Max HP damage with a {1}% chance to ignite.",
    execute: (attacker, defender, skillValues = [[0.1], [25]]) => {
      const damageMult = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 0.1;
      const burnChance = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 25;

      const rawDamage = attacker.maxHp * damageMult;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `🔥 **${attacker.name}** fires **Flamming bullets**! Dealt **${damage}** DMG!${suffix}`;

      if (Math.random() * 100 < burnChance) {
         addBuff(defender, "Ignite", "burn", 5, 2);
         log += `\n🔥 **${defender.name}** was ignited!`;
      } else {
         log += `\n(Ignite failed)`;
      }
      return { damage, log };
    },
  },

  // ✅ MIYABI (Standard Energy)
  "Judgement Cut": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Judgement Cut",
    icon: "<:miyabi_skill:1447562052771123323>",
    description: "Marks target. After 2 turns, deals {0} × SPD as True Damage.",
    execute: (attacker, defender, skillValues = [1.1]) => {
      const multiplier = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const trueDamage = Math.floor(attacker.stats.speed * multiplier);
      addBuff(defender, "Judgement Mark", "delayedDmg", trueDamage, 2);
      return {
        damage: 0,
        log: `❄️ **${attacker.name}** uses **Judgement Cut**!\n**${defender.name}** is marked for 2 turns...`,
      };
    },
  },

  // ✅ YIXUAN (Standard Energy)
  "Divine Foresight": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Divine Foresight",
    icon: "<:yixuan_skill:1453672321306067110>",
    description: "For 3 turns, reduces incoming damage by {0}%. Heal {1}% if HP < 50%.",
    execute: (attacker, defender, skillValues = [[10], [4]]) => {
      const reduction = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 10;
      const healPercent = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 4;
      addBuff(attacker, "Divine Shield", "dmgRed", reduction, 3);
      addBuff(attacker, "Divine Regen", "condRegen", healPercent, 3);
      return { damage: 0, log: `🔮 **${attacker.name}** uses **Divine Foresight**!\nDecreases incoming DMG and prepares healing!` };
    },
  },

  // ✅ ROVER (Standard Energy)
  "Gale Disruption": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Gale Disruption",
    icon: "<:rover_skill_gale:1446799294492311603>",
    description: "Reduces enemy's accuracy by {0}% for 2 turns.",
    execute: (attacker, defender, skillValues = [15]) => {
      const chance = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 15;
      addBuff(defender, "Gale Disruption", "missChance", chance, 2);
      return { damage: 0, log: `🌪️ **${attacker.name}** uses **Gale Disruption**!\n**${defender.name}**'s accuracy reduced!` };
    },
  },

  // ✅ LAPPLAND (Standard Energy)
  "Nocturnal Silence": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Nocturnal Silence",
    icon: "<:lappland_skill:1454368319686840341>",
    description: "Silences the target for 2 turns...",
    execute: (attacker, defender, skillValues = [5]) => {
      const drainAmount = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 5;
      addBuff(defender, "Nocturnal Silence", "energyDrain", drainAmount, 2);
      addBuff(defender, "Silenced", "silence", 1, 2);
      return { damage: 0, log: ` **${attacker.name}** uses **Nocturnal Silence**!\n**${defender.name}** is **Silenced**!` };
    },
  },

  // ✅ WISE (Standard Energy)
  "Proxy's Rizz": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Proxy's Rizz",
    icon: "<:wise_skill:1454330440096944201>",
    description: "Reduces Defense by {0}% for 2 turns.",
    execute: (attacker, defender, skillValues = [10]) => {
      const percent = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 10;
      const reduceAmount = -Math.floor(defender.stats.def * (percent / 100));
      addBuff(defender, "Proxy's Rizz", "def", reduceAmount, 2);
      return { damage: 0, log: ` **${attacker.name}** uses **Proxy's Rizz**!\n**${defender.name}**'s Defense reduced!` };
    },
  },

  // ✅ TRAILBLAZER (Standard Energy)
  "Bulwark Protocol": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Bulwark Protocol",
    icon: "<:tb_skill:1454873572211425301>",
    description: "Increases Defense by {0}% for 2 turns.",
    execute: (attacker, defender, skillValues = [15]) => {
      const percent = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 15;
      const boostAmount = Math.floor(attacker.stats.def * (percent / 100));
      addBuff(attacker, "Bulwark Protocol", "def", boostAmount, 2);
      return { damage: 0, log: ` **${attacker.name}** used **Bulwark Protocol**!\nDefense increased!` };
    },
  },

  // ✅ AETHER (Standard Energy)
  "Femboy Slash": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Femboy Slash",
    icon: "⚔️",
    description: "Slashes the target, dealing {0}x ATK damage.",
    execute: (attacker, defender, skillValues = [1.1]) => {
      const multiplier = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const rawDamage = attacker.stats.atk * multiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;
      return { damage, log: `**${attacker.name}** uses **Femboy Slash**! Dealt **${damage}** DMG!${suffix}` };
    },
  },

  // ✅ SLIME (Standard Energy)
  "Tackle": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Tackle",
    icon: "💥",
    description: "Tackles the target, dealing {0}x ATK damage.",
    execute: (attacker, defender, skillValues = 1.1) => {
      const multiplier = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const rawDamage = attacker.stats.atk * multiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;
      return { damage, log: `**${attacker.name}** used **Tackle**! Hit for **${damage}** DMG!${suffix}` };
    },
  },

  // ✅ PASSIVE (Instant/Auto)
  "Wind's Edge [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Wind's Edge [PASSIVE]",
    icon: "<:qiuyuan_skill:1447262771245748255>",
    description: "Enters a defensive stance...",
    execute: (attacker, defender, skillValues = [10, 10]) => {
      const dodgeChance = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 10;
      const counterDmg = Array.isArray(skillValues) && skillValues[1] ? skillValues[1] : 10;
      addBuff(attacker, "Wind's Edge", "dodge", dodgeChance, 3, counterDmg);
      return { damage: 0, log: `🌪️ **${attacker.name}** activates **Wind's Edge**!\nGain **${dodgeChance}% Dodge Chance** against Basic Attacks!` };
    },
  },

  // ✅ BASIC ATTACK
  "Basic Attack": {
    name: "Basic Attack",
    icon: "🗡️",
    execute: (attacker, defender) => {
      if (attacker.effects) {
        const blindEffect = attacker.effects.find((e) => e.stat === "missChance");
        if (blindEffect && Math.random() * 100 < blindEffect.amount) {
            return { damage: 0, log: `🚫 **${attacker.name}** misses the attack!` };
        }
      }
      if (defender.effects) {
        const dodgeEffect = defender.effects.find((e) => e.stat === "dodge");
        if (dodgeEffect && Math.random() * 100 < dodgeEffect.amount) {
            const counterDmg = dodgeEffect.extra || 10;
            addBuff(defender, "Counter Stance", "dmgBoost", counterDmg, 1);
            return { damage: 0, log: `💨 **${defender.name}** dodged **${attacker.name}**'s attack!` };
        }
      }
      const critChance = attacker.stats.critRate || 5; 
      const isCrit = Math.random() * 100 < critChance;
      const rawDamage = attacker.stats.atk;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage, isCrit);
      defender.stats.hp -= damage;
      let logPrefix = `**${attacker.name}** attacks!`;
      if (isCrit) logPrefix = `💥 **CRITICAL HIT!** **${attacker.name}** attacks!`;
      return { damage: damage, log: `${logPrefix} Dealt **${damage}** DMG.${suffix}` };
    },
  },
};

module.exports = Skills;