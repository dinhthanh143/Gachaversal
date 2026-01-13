const { getTypeMultiplier } = require("../utils/typeMultiplier");
const { addBuff } = require("./effects");

// =========================================
// 1. DAMAGE CALCULATION
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
  let effectiveDamage = Math.floor(rawDamage * critMult * damageMultiplier * typeMult);

  if (defender.effects) {
    const redEffect = defender.effects.find((e) => e.stat === "dmgRed");
    if (redEffect) {
      const mitigation = 1 - redEffect.amount / 100;
      effectiveDamage = Math.floor(effectiveDamage * mitigation);
    }
  }

  const defStat = defender.stats ? defender.stats.def : 0;
  const DEF_SCALING = 0.5;
  const defenseFactor = 100 / (100 + defStat * DEF_SCALING);
  const finalDamage = Math.max(1, Math.floor(effectiveDamage * defenseFactor));

  let suffix = "";
  if (typeMult > 1.0) suffix += "\nIt was SUPER EFFECTIVE!";
  else if (typeMult < 1.0) suffix += "\nIt wasn't very effective...";
  if (damageMultiplier > 1.0) suffix += " (Counter-Boosted!)";

  return { damage: finalDamage, suffix };
}

// =========================================
// 2. EFFECT HANDLERS
// =========================================

function handleDamageConversion(unit, damageAmount, sourceType) {
  if (!unit.effects || damageAmount <= 0) return "";
  const buff = unit.effects.find((e) => e.stat === "dmgConversion");
  
  if (buff) {
    let effectiveRate = buff.amount; 
    // Check for "Skill" reduction logic (Lingsha)
    if (sourceType === "SKILL" && Array.isArray(buff.extra) && buff.extra.length >= 2) {
        const [baseRate, reductionRate] = buff.extra;
        effectiveRate = Math.max(0, baseRate - reductionRate);
    }

    const baseConvert = Math.floor(damageAmount * (effectiveRate / 100));
    const totalRestore = baseConvert * 2; // Refund + Heal

    unit.stats.hp = Math.min(unit.maxHp, unit.stats.hp + totalRestore);
    
    if (baseConvert > 0) {
        const typeText = sourceType === "BASIC" ? "Basic ATK" : "Skill";
        return `\n🔥 **Cinderbloom Ritual** (${typeText})! Converted damage into **${baseConvert}** Healing!`;
    }
  }
  return "";
}

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

function handleDeathPrevention(unit) {
  if (unit.stats.hp > 0 || !unit.effects) return "";

  let log = "";
  const activeDeathState = unit.effects.find((e) => e.stat === "zombieState");

  if (activeDeathState) {
    unit.stats.hp = 1;
    log = `\n**${unit.name}** is anchored to the Death Kingdom and refuses to die!`;
  } else {
    const wardIndex = unit.effects.findIndex((e) => e.stat === "cheatDeath");
    if (wardIndex !== -1) {
      const ward = unit.effects[wardIndex];
      unit.effects.splice(wardIndex, 1);

      const atkBoostPercent = ward.extra || 1;
      const atkGain = Math.floor(unit.maxHp * (atkBoostPercent / 100));

      addBuff(unit, "Death Kingdom", "zombieState", 1, 3);
      addBuff(unit, "Queen's Wrath", "atk", atkGain, 3);
      if (unit.stats.atk !== undefined) unit.stats.atk += atkGain;

      unit.stats.hp = 1;
      log = `\n**${unit.name}** enters the **Death Kingdom**! (Invulnerable for 3 turns)\nGained **+${atkGain} ATK**!`;
    }
  }
  return log;
}

// ✅ MASTER HANDLER
function applyPostDamageEffects(unit, damageAmount, sourceType = "SKILL") {
    let log = "";
    log += handleDamageConversion(unit, damageAmount, sourceType);
    log += handleDamageStorage(unit, damageAmount);
    log += handleDeathPrevention(unit);
    return log;
}

// =========================================
// 3. PRE-ATTACK LOGIC (Wisadel)
// =========================================
function checkPreAttackPassives(attacker) {
  let log = "";
  const ammoBuff = attacker.effects ? attacker.effects.find((e) => e.name === "Explosive Ammo") : null;

  if (ammoBuff && ammoBuff.amount > 0) {
    ammoBuff.amount -= 1; 
    let atkInc = 4;
    let critInc = 4;

    if (Array.isArray(ammoBuff.extra) && ammoBuff.extra.length >= 2) {
      atkInc = ammoBuff.extra[0];
      critInc = ammoBuff.extra[1];
    } else {
      const vals = attacker.skill.values || [[4], [4]];
      atkInc = (Array.isArray(vals[0]) ? vals[0][0] : vals[0]) || 4;
      critInc = (Array.isArray(vals[1]) ? vals[1][0] : vals[1]) || 4;
    }

    const atkBoost = Math.floor(attacker.stats.atk * (atkInc / 100));
    let statBuff = attacker.effects.find((e) => e.name === "Wisadel Buff");
    let currentStack = 1;

    if (!statBuff) {
      addBuff(attacker, "Wisadel Buff", "atk", atkBoost, 999, 1);
      addBuff(attacker, "Wisadel Buff", "critRate", critInc, 999, 1);
    } else {
      const buffs = attacker.effects.filter((e) => e.name === "Wisadel Buff");
      currentStack = (statBuff.extra || 1) + 1;
      buffs.forEach((b) => {
        b.extra = currentStack;
        if (b.stat === "atk") { b.amount += atkBoost; attacker.stats.atk += atkBoost; }
        if (b.stat === "critRate") { b.amount += critInc; attacker.stats.critRate += critInc; }
      });
    }

    const totalAtk = attacker.effects.find((e) => e.name === "Wisadel Buff" && e.stat === "atk").amount;
    const totalCrit = attacker.effects.find((e) => e.name === "Wisadel Buff" && e.stat === "critRate").amount;

    log = `🧨 **Wisadel's Ammo** used! (Left: **${ammoBuff.amount}**)\n` +
          `Raises ATK by **${totalAtk}** (Total) and Crit Rate by **${totalCrit}%** (Total)!`;
  }
  return log;
}

module.exports = { 
    calculateDamage, 
    applyPostDamageEffects, 
    checkPreAttackPassives 
};