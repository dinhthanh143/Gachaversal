const { getTypeMultiplier } = require("../utils/typeMultiplier");
const { addBuff } = require("./effects");

// =========================================
// 1. HELPER: Calculate Damage
// =========================================
function calculateDamage(attacker, defender, rawDamage, isCrit = false) {
  const atkType = attacker.type || "Neutral";
  const defType = defender.type || "Neutral";
  let critMult = 1.0;
  if (isCrit) {
    const critDmgStat = attacker.stats.critDmg || 140;
    critMult = critDmgStat / 100;
  }
  let damageMultiplier = 1.0;
  if (attacker.effects) {
    const boostIndex = attacker.effects.findIndex((e) => e.stat === "dmgBoost");
    if (boostIndex !== -1) {
      const boostEffect = attacker.effects[boostIndex];
      damageMultiplier += boostEffect.amount / 100;
      attacker.effects.splice(boostIndex, 1);
    }
  }
  const typeMult = getTypeMultiplier(atkType, defType);
  let effectiveDamage = Math.floor(
    rawDamage * critMult * damageMultiplier * typeMult
  );
  if (defender.effects) {
    const redEffect = defender.effects.find((e) => e.stat === "dmgRed");
    if (redEffect) {
      const mitigation = 1 - redEffect.amount / 100;
      effectiveDamage = Math.floor(effectiveDamage * mitigation);
    }
  }
  const defStat = defender.stats ? defender.stats.def : 0;
  const defenseFactor = 100 / (100 + defStat);
  const finalDamage = Math.max(1, Math.floor(effectiveDamage * defenseFactor));
  
  let suffix = "";
  if (isCrit) suffix += " (CRIT!)";
  if (typeMult > 1.0) suffix += "\nIt was SUPER EFFECTIVE!";
  else if (typeMult < 1.0) suffix += "\nIt wasn't very effective...";
  if (damageMultiplier > 1.0) suffix += " (Counter-Boosted!)";
  
  return { damage: finalDamage, suffix };
}

// =========================================
// 2. HELPER: Phainon Damage Storage
// =========================================
function handleDamageStorage(defender, damage) {
  if (defender.effects) {
    const echoBuff = defender.effects.find((e) => e.stat === "storeDmg");
    if (echoBuff) {
      const storedAmount = Math.floor(damage * (echoBuff.amount / 100));
      echoBuff.extra = (echoBuff.extra || 0) + storedAmount;
      return `\n**Echo of Calamity**: stored **${storedAmount}** DMG! (Total: **${echoBuff.extra}**)`;
    }
  }
  return "";
}

// =========================================
// 3. HELPER: Castorice Death Prevention
// =========================================
function handleDeathPrevention(unit) {
  // Only trigger if unit is dead (hp <= 0) and has effects
  if (unit.stats.hp > 0 || !unit.effects) return "";

  let log = "";
  // 1. Check for Active Zombie Mode (Already triggered)
  const activeDeathState = unit.effects.find(e => e.stat === "zombieState");
  
  if (activeDeathState) {
     unit.stats.hp = 1; // Refuse to die
     log = `\n**${unit.name}** is anchored to the Death Kingdom and refuses to die!`;
  } 
  // 2. Check for Ward (First time trigger)
  else {
     const wardIndex = unit.effects.findIndex(e => e.stat === "cheatDeath");
     if (wardIndex !== -1) {
       const ward = unit.effects[wardIndex];
       
       // Consume Ward
       unit.effects.splice(wardIndex, 1);
       
       // Calculate ATK Boost (MaxHP * Value%)
       const atkBoostPercent = ward.extra || 1;
       const atkGain = Math.floor(unit.maxHp * (atkBoostPercent / 100));
       
       // Apply Zombie State (3 Turns)
       addBuff(unit, "Death Kingdom", "zombieState", 1, 3);
       
       // Apply ATK Buff
       addBuff(unit, "Queen's Wrath", "atk", atkGain, 3);
       if (unit.stats.atk !== undefined) unit.stats.atk += atkGain;

       // Save Life
       unit.stats.hp = 1;
       log = `\n**${unit.name}** enters the **Death Kingdom**! (Invulnerable for 3 turns)\nGained **+${atkGain} ATK**!`;
     }
  }
  return log;
}

// =========================================
// 4. SKILL DEFINITIONS
// =========================================
const Skills = {
  "Queen of the Death Kingdom [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Queen of the Death Kingdom [PASSIVE]",
    icon: "<:castorice_skill:1457011310767243405>",
    description: "Upon receiving fatal damage, prevents death and enters 'Death Kingdom' state for 3 turns.",
    execute: (attacker, defender, skillValues = [[1]]) => {
      const atkPercent = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 1;
      addBuff(attacker, "Death Kingdom Ward", "cheatDeath", 1, 999, atkPercent);
      return { damage: 0, log: `**${attacker.name}** is protected by the **Death Kingdom**.` };
    },
  },

  "Havoc of the Abyss": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Havoc of the Abyss",
    icon: "<:skirk_skill:1456936895115427860>",
    description: "Deals Ice DMG and reduces Speed. If already slowed, deals extra HP% damage.",
    execute: (attacker, defender, skillValues = [[90], [6]]) => {
      const dmgPercent = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 90;
      const extraHpPercent = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 6;
      
      const rawDamage = attacker.stats.atk * (dmgPercent / 100);
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;
      
      let log = `**${attacker.name}** uses **Havoc of the Abyss**! Dealt **${damage}** Ice DMG!${suffix}`;
      log += handleDamageStorage(defender, damage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      let alreadySlowed = false;
      if (defender.effects) {
        const speedDebuff = defender.effects.find((e) => e.stat === "speed" && e.amount < 0);
        if (speedDebuff) alreadySlowed = true;
      }

      if (alreadySlowed) {
        const extraDmg = Math.floor(defender.stats.hp * (extraHpPercent / 100));
        defender.stats.hp -= extraDmg;
        log += `\n**Abyssal Execution**: Target was slowed! Dealt **${extraDmg}** extra damage!`;
        log += handleDamageStorage(defender, extraDmg);
        log += handleDeathPrevention(defender); // ✅ Death Check
      }
      
      const speedReduction = Math.floor(defender.stats.speed * 0.25);
      addBuff(defender, "Abyssal Chill", "speed", -speedReduction, 5);
      log += `\n**${defender.name}**'s Speed reduced by **${speedReduction}** for 4 turns!`;

      return { damage, log };
    },
  },

  "Medic Protocol": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Medic Protocol",
    icon: "<:doctor_skill:1457010478885634062>",
    description: "Heals {0}% Max HP at the start of every turn for 3 turns.",
    execute: (attacker, defender, skillValues = [5]) => {
      const healPercent = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 5;
      addBuff(attacker, "Medic Protocol", "medicRegen", healPercent, 3);
      return { damage: 0, log: `**${attacker.name}** activates **Medic Protocol**!\nHealing systems initialized for 3 turns.` };
    },
  },

  "Eternal Execution": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Eternal Execution",
    icon: "<:raiden_skill:1456922691411120170>",
    description: "Consumes 25-100% Energy to deal Electro DMG based on consumption.",
    execute: (attacker, defender, skillValues = [1]) => {
      const dmgPerPoint = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 1;
      const consumed = Math.floor(Math.random() * (100 - 25 + 1)) + 25;
      const refund = 100 - consumed;
      attacker.energy += refund;

      const totalMultiplier = (dmgPerPoint * consumed) / 100;
      const rawDamage = attacker.stats.atk * totalMultiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** uses **Eternal Execution**!`;
      log += `\nConsumed **${consumed}** Energy (Refunded **${refund}**)!`;
      log += `\nDealt **${damage}** Electro DMG!${suffix}`;

      log += handleDamageStorage(defender, damage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      return { damage, log };
    },
  },

  "Heavenfall Accord": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Heavenfall Accord",
    icon: "<:zhongli_skill:1456927829550829612>",
    description: "Raises Defense by {0}% for 2 turns. On expiry, Stuns target for 1 turn.",
    execute: (attacker, defender, skillValues = [20]) => {
      const percent = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 20;
      const boostAmount = Math.floor(attacker.stats.def * (percent / 100));
      addBuff(attacker, "Heavenfall Accord", "heavenfallDef", boostAmount, 3);
      return { damage: 0, log: `**${attacker.name}** uses **Heavenfall Accord**!\nDefense increased by **${boostAmount}**! Meteor incoming...` };
    },
  },

  "Echo of Calamity": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Echo of Calamity",
    icon: "<:phainon_skill:1456918929531474001>",
    description: "Stores {0}% of damage received for 3 turns.",
    execute: (attacker, defender, skillValues = [[45]]) => {
      const storePercent = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 45;
      addBuff(attacker, "Echo of Calamity", "storeDmg", storePercent, 3, 0);
      return { damage: 0, log: `**${attacker.name}** activates **Echo of Calamity**!\nAny damage taken will be stored and returned!` };
    },
  },

  "Crimson Verdict [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Crimson Verdict [PASSIVE]",
    icon: "<:acheron_skill:1456918056013135990>",
    description: "Attacks build Slashed Dream stacks. At 4 stacks, unleashes a guaranteed Crit slash.",
    execute: (attacker, defender, skillValues = [[20]]) => {
      const dmgPerStack = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 20;
      addBuff(attacker, "Slashed Dream", "stack", 0, 999, dmgPerStack);
      return { damage: 0, log: `**${attacker.name}** enters the battle with **Crimson Verdict** active!` };
    },
  },

  "Sword Of The Divine [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Sword Of The Divine [PASSIVE]",
    icon: "<:ye_skill:1446822377101983787>",
    description: "If Speed < Target: Gain Lifesteal. Else: Gain ATK & Crit Rate.",
    execute: (attacker, defender, skillValues = [[17], [10], [8]]) => {
      const lsVal = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 17;
      const atkVal = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 10;
      const critVal = (Array.isArray(skillValues[2]) ? skillValues[2][0] : skillValues[2]) || 8;
      
      let log = "";
      if (attacker.stats.speed < defender.stats.speed) {
        addBuff(attacker, "Sword Of The Divine", "lifesteal", lsVal, 999);
        log = `**${attacker.name}** is slower! Gained **${lsVal}% Lifesteal**!`;
      } else {
        addBuff(attacker, "Sword Of The Divine", "atk", atkVal, 999);
        addBuff(attacker, "Sword Of The Divine", "critRate", critVal, 999);
        
        if (attacker.stats.atk !== undefined) attacker.stats.atk += atkVal;
        if (attacker.stats.critRate !== undefined) attacker.stats.critRate += critVal;
        
        log = `**${attacker.name}** is faster! Gained **+${atkVal} ATK** & **+${critVal}% Crit Rate**!`;
      }
      return { damage: 0, log };
    },
  },

  "Power Strike": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Power Strike",
    icon: "👊",
    description: "Deals a powerful strike equals to {0}% of ATK damage.",
    execute: (attacker, defender, skillValues = [100]) => {
      const percentage = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 100;
      const multiplier = percentage / 100;
      const rawDamage = attacker.stats.atk * multiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** uses **Power Strike**! Dealt **${damage}** DMG!${suffix}`;
      log += handleDamageStorage(defender, damage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      return { damage, log };
    },
  },

  "Key of Interpretation": {
    initialEnergy: 25,
    requiredEnergy: 75,
    name: "Key of Interpretation",
    icon: "<:herta_skill:1456549247611699200>",
    description: "Randomly sets enemy Energy.",
    execute: (attacker, defender, skillValues = [[0.6], [0.5]]) => {
      const selfMult = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 0.6;
      const enemyMult = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 0.5;
      const cap = defender.skill && defender.skill.requiredEnergy ? defender.skill.requiredEnergy : 100;
      
      const oldEnergy = defender.energy || 0;
      const newEnergy = Math.floor(Math.random() * (cap + 1));
      defender.energy = newEnergy;
      
      const gap = Math.abs(oldEnergy - newEnergy);
      const gapRatio = gap / cap;
      const gapPercent = Math.floor(gapRatio * 100);
      let log = `**${attacker.name}** uses **Key of Interpretation**!\nEnemy Energy: **${oldEnergy}** ➔ **${newEnergy}**\n`;

      if (oldEnergy > newEnergy) {
        const damage = Math.floor(attacker.maxHp * gapRatio * selfMult);
        attacker.stats.hp -= damage;
        log += `Gap: **${gapPercent}%** (Lost) ➔ **${attacker.name}** took **${damage}** self-damage!`;
        log += handleDeathPrevention(attacker); // ✅ Death Check (Self)
      
      } else if (oldEnergy < newEnergy) {
        const rawIceDmg = Math.floor(attacker.maxHp * gapRatio * enemyMult);
        const { damage, suffix } = calculateDamage(attacker, defender, rawIceDmg, false);
        defender.stats.hp -= damage;
        
        log += `Gap: **${gapPercent}%** (Gained) ➔ **${defender.name}** received **${damage}** Ice DMG!${suffix}`;
        log += handleDamageStorage(defender, damage);
        log += handleDeathPrevention(defender); // ✅ Death Check (Enemy)
      } else {
        log += `Gap: **0%** ➔ Nothing happened.`;
      }
      return { damage: 0, log };
    },
  },

  "Tactical Overclock": {
    initialEnergy: 25,
    requiredEnergy: 75,
    name: "Tactical Overclock",
    icon: "<:chisa_skill:1446787026392190997>",
    description: "Gains {0}% Crit Rate and +{1}% Speed per stack (max 3 stacks).",
    execute: (attacker, defender, skillValues = [[10], [1]]) => {
      const critBase = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 10;
      const spdBase = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 1;
      
      if (!attacker.effects) attacker.effects = [];
      const critEff = attacker.effects.find((e) => e.name === "Tactical Overclock" && e.stat === "critRate");
      const spdEff = attacker.effects.find((e) => e.name === "Tactical Overclock" && e.stat === "speed");

      if (!critEff) {
        addBuff(attacker, "Tactical Overclock", "critRate", critBase, 4, 1);
        addBuff(attacker, "Tactical Overclock", "speed", spdBase, 4, 1);
        return { damage: 0, log: `**${attacker.name}** enters Overclock! (Stack 1)\nCurrently: **+${critBase}% Crit**, **+${spdBase} SPD**` };
      }
      
      let stacks = critEff.extra || 1;
      critEff.turns = 4;
      if (spdEff) spdEff.turns = 4;
      
      if (stacks < 3) {
        stacks++;
        critEff.amount += critBase;
        if (spdEff) spdEff.amount += spdBase;
        
        if (attacker.stats.critRate !== undefined) attacker.stats.critRate += critBase;
        if (attacker.stats.speed !== undefined) attacker.stats.speed += spdBase;
        
        critEff.extra = stacks;
        if (spdEff) spdEff.extra = stacks;
        
        return { damage: 0, log: `**${attacker.name}** Overclock Rising! (Stack ${stacks})\nTotal: **+${critEff.amount}% Crit**, **+${spdEff ? spdEff.amount : 0} SPD**` };
      }
      return { damage: 0, log: `**${attacker.name}** Overclock Refreshed! (Max Stacks)` };
    },
  },

  "Piercing Shards": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Piercing Shards",
    icon: "<:carlotta_skill:1446787543092822027>",
    description: "Fires three searing shots.",
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

      let log = `**${attacker.name}** fires **Piercing Shards** (3 hits)!`;
      if (critCount > 0) log += `\n**${critCount}** of them **Critted**!`;
      log += `\nDealt a total of **${totalDamage}** DMG!${typeSuffix}`;

      log += handleDamageStorage(defender, totalDamage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      return { damage: totalDamage, log };
    },
  },

  "Flamming bullets": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Flamming bullets",
    icon: "<:galbrena_skill:1446787462742409298>",
    description: "Fires incendiary rounds.",
    execute: (attacker, defender, skillValues = [[0.1], [25]]) => {
      const damageMult = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 0.1;
      const burnChance = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 25;
      const rawDamage = attacker.maxHp * damageMult;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** fires **Flamming bullets**! Dealt **${damage}** DMG!${suffix}`;
      log += handleDamageStorage(defender, damage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      if (Math.random() * 100 < burnChance) {
        addBuff(defender, "Ignite", "burn", 5, 2);
        log += `\n**${defender.name}** was ignited!`;
      } else {
        log += `\n(Ignite failed)`;
      }
      return { damage, log };
    },
  },

  "Judgement Cut": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Judgement Cut",
    icon: "<:miyabi_skill:1447562052771123323>",
    description: "Marks target for delayed damage.",
    execute: (attacker, defender, skillValues = [1.1]) => {
      const multiplier = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const trueDamage = Math.floor(attacker.stats.speed * multiplier);
      addBuff(defender, "Judgement Mark", "delayedDmg", trueDamage, 2);
      return { damage: 0, log: `**${attacker.name}** uses **Judgement Cut**!\n**${defender.name}** is marked for 2 turns...` };
    },
  },

  "Divine Foresight": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Divine Foresight",
    icon: "<:yixuan_skill:1453672321306067110>",
    description: "Reduces incoming damage and prepares healing.",
    execute: (attacker, defender, skillValues = [[10], [4]]) => {
      const reduction = (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) || 10;
      const healPercent = (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) || 4;
      addBuff(attacker, "Divine Shield", "dmgRed", reduction, 3);
      addBuff(attacker, "Divine Regen", "condRegen", healPercent, 3);
      return { damage: 0, log: `**${attacker.name}** uses **Divine Foresight**!\nDecreases incoming DMG and prepares healing!` };
    },
  },

  "Gale Disruption": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Gale Disruption",
    icon: "<:rover_skill_gale:1446799294492311603>",
    description: "Reduces enemy's accuracy.",
    execute: (attacker, defender, skillValues = [15]) => {
      const chance = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 15;
      addBuff(defender, "Gale Disruption", "missChance", chance, 2);
      return { damage: 0, log: `**${attacker.name}** uses **Gale Disruption**!\n**${defender.name}**'s accuracy reduced!` };
    },
  },

  "Nocturnal Silence": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Nocturnal Silence",
    icon: "<:lappland_skill:1454368319686840341>",
    description: "Silences the target.",
    execute: (attacker, defender, skillValues = [5]) => {
      const drainAmount = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 5;
      addBuff(defender, "Nocturnal Silence", "energyDrain", drainAmount, 2);
      addBuff(defender, "Silenced", "silence", 1, 2);
      return { damage: 0, log: `**${attacker.name}** uses **Nocturnal Silence**!\n**${defender.name}** is **Silenced**!` };
    },
  },

  "Proxy's Rizz": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Proxy's Rizz",
    icon: "<:wise_skill:1454330440096944201>",
    description: "Reduces Defense.",
    execute: (attacker, defender, skillValues = [10]) => {
      const percent = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 10;
      const reduceAmount = -Math.floor(defender.stats.def * (percent / 100));
      addBuff(defender, "Proxy's Rizz", "def", reduceAmount, 2);
      return { damage: 0, log: `**${attacker.name}** uses **Proxy's Rizz**!\n**${defender.name}**'s Defense reduced!` };
    },
  },

  "Bulwark Protocol": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Bulwark Protocol",
    icon: "<:tb_skill:1454873572211425301>",
    description: "Increases Defense.",
    execute: (attacker, defender, skillValues = [15]) => {
      const percent = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 15;
      const boostAmount = Math.floor(attacker.stats.def * (percent / 100));
      addBuff(attacker, "Bulwark Protocol", "def", boostAmount, 2);
      return { damage: 0, log: `**${attacker.name}** used **Bulwark Protocol**!\nDefense increased!` };
    },
  },

  "Femboy Slash": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Femboy Slash",
    icon: "⚔️",
    description: "Slashes the target.",
    execute: (attacker, defender, skillValues = [1.1]) => {
      const multiplier = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const rawDamage = attacker.stats.atk * multiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** uses **Femboy Slash**! Dealt **${damage}** DMG!${suffix}`;
      log += handleDamageStorage(defender, damage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      return { damage, log };
    },
  },

  "Tackle": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Tackle",
    icon: "💥",
    description: "Tackles the target.",
    execute: (attacker, defender, skillValues = 1.1) => {
      const multiplier = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const rawDamage = attacker.stats.atk * multiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** used **Tackle**! Hit for **${damage}** DMG!${suffix}`;
      log += handleDamageStorage(defender, damage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      return { damage, log };
    },
  },

  "Wind's Edge [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Wind's Edge [PASSIVE]",
    icon: "<:qiuyuan_skill:1447262771245748255>",
    description: "Enters a defensive stance.",
    execute: (attacker, defender, skillValues = [10, 10]) => {
      const dodgeChance = (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 10;
      const counterDmg = Array.isArray(skillValues) && skillValues[1] ? skillValues[1] : 10;
      addBuff(attacker, "Wind's Edge", "dodge", dodgeChance, 3, counterDmg);
      return { damage: 0, log: `**${attacker.name}** activates **Wind's Edge**!\nGain **${dodgeChance}% Dodge Chance** against Basic Attacks!` };
    },
  },

  "Basic Attack": {
    name: "Basic Attack",
    icon: "🗡️",
    execute: (attacker, defender) => {
      // 1. Check Miss
      if (attacker.effects) {
        const blindEffect = attacker.effects.find((e) => e.stat === "missChance");
        if (blindEffect && Math.random() * 100 < blindEffect.amount) {
          return { damage: 0, log: `**${attacker.name}** misses the attack!` };
        }
      }
      // 2. Check Dodge
      if (defender.effects) {
        const dodgeEffect = defender.effects.find((e) => e.stat === "dodge");
        if (dodgeEffect && Math.random() * 100 < dodgeEffect.amount) {
          const counterDmg = dodgeEffect.extra || 10;
          addBuff(defender, "Counter Stance", "dmgBoost", counterDmg, 1);
          return { damage: 0, log: `**${defender.name}** dodged **${attacker.name}**'s attack!` };
        }
      }
      
      const critChance = attacker.stats.critRate || 5;
      const isCrit = Math.random() * 100 < critChance;
      const rawDamage = attacker.stats.atk;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage, isCrit);
      defender.stats.hp -= damage;

      let logPrefix = `**${attacker.name}** attacks!`;
      if (isCrit) logPrefix = `**CRITICAL HIT!** **${attacker.name}** attacks!`;
      let log = `${logPrefix} Dealt **${damage}** DMG.${suffix}`;

      // ✅ TRIGGERS
      log += handleDamageStorage(defender, damage);
      log += handleDeathPrevention(defender); // ✅ Death Check

      // ✅ PASSIVES (Lifesteal & Acheron)
      if (attacker.effects) {
        const lifestealBuff = attacker.effects.find((e) => e.stat === "lifesteal");
        if (lifestealBuff) {
          const healAmount = Math.floor(damage * (lifestealBuff.amount / 100));
          if (healAmount > 0) {
            attacker.stats.hp = Math.min(attacker.maxHp, attacker.stats.hp + healAmount);
            log += `\nHealed **${healAmount}** HP via Lifesteal!`;
          }
        }
        const acheronBuff = attacker.effects.find((e) => e.name === "Slashed Dream");
        if (acheronBuff) {
          acheronBuff.amount += 1;
          log += `\n**Crimson Verdict** is at **${acheronBuff.amount}** stacks.`;
          if (acheronBuff.amount >= 4) {
            const perStackDmg = acheronBuff.extra || 20;
            const nukeMult = (perStackDmg * 4) / 100;
            const nukeRaw = attacker.stats.atk * nukeMult;
            const nukeCalc = calculateDamage(attacker, defender, nukeRaw, true);
            defender.stats.hp -= nukeCalc.damage;
            acheronBuff.amount = 0;
            log += `\n**Slashed Dream Consumed!**\n**${attacker.name}** unleashed **Crimson Slash**! Dealt **${nukeCalc.damage}** DMG!${nukeCalc.suffix}`;
            
            log += handleDamageStorage(defender, nukeCalc.damage);
            log += handleDeathPrevention(defender); // ✅ Death Check (On Nuke)
          }
        }
      }
      return { damage: damage, log: log };
    },
  },
};

module.exports = Skills;