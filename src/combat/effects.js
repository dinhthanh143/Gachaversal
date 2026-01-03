// src/combat/effects.js

module.exports = {
  addBuff(unit, name, stat, amount, turns, extraValue = null) {
    if (!unit.effects) unit.effects = [];
    
    // ✅ ADD "critRate" and "critDmg" to this list
    if (["atk", "def", "speed", "hp", "critRate", "critDmg"].includes(stat)) {
      if (unit.stats[stat] !== undefined) {
        unit.stats[stat] += amount;
      }
    }
    
    unit.effects.push({ name, stat, amount, turns, extra: extraValue });
  },

  applyStartTurnEffects(unit) {
    // ... [No changes needed here] ...
    const logs = [];
    if (!unit.effects) return logs;
    for (const effect of unit.effects) {
      if (effect.stat === "energyDrain") {
        const drain = Math.floor(effect.amount);
        const old = unit.energy;
        unit.energy = Math.max(0, unit.energy - drain);
        if (old > 0) logs.push(` **${unit.name}** lost **${old - unit.energy}** Energy due to **${effect.name}**!`);
      }
      if (effect.stat === "burn") {
        const dmg = Math.max(1, Math.floor(unit.maxHp * (effect.amount / 100)));
        unit.stats.hp -= dmg;
        logs.push(`🔥 **${unit.name}** took **${dmg}** Burn damage!`);
      }
    }
    return logs;
  },

  applyEndTurnEffects(unit) {
    const logs = [];
    if (!unit.effects) return logs;
    const activeEffects = [];

    for (const effect of unit.effects) {
      // 1. Handle Conditional Regen
      if (effect.stat === "condRegen") {
        if (unit.stats.hp < unit.maxHp * 0.5) {
            const healAmount = Math.floor(unit.maxHp * (effect.amount / 100));
            unit.stats.hp = Math.min(unit.maxHp, unit.stats.hp + healAmount);
            logs.push(`✨ **${unit.name}**'s **${effect.name}** triggers! Healed **${healAmount}** HP.`);
        }
      }

      // 2. Decrement Turns
      effect.turns -= 1;

      // 3. Handle Expiration
      if (effect.turns <= 0) {
        
        if (effect.stat === "delayedDmg") {
            const dmg = Math.floor(effect.amount);
            unit.stats.hp -= dmg;
            logs.push(`❄️ **${unit.name}**'s **${effect.name}** detonates! Took **${dmg}** True Damage!`);
        }
        
        // ✅ REVERT FLAT STATS (Include critRate/critDmg)
        else if (["atk", "def", "speed", "hp", "critRate", "critDmg"].includes(effect.stat)) {
          if (unit.stats[effect.stat] !== undefined) unit.stats[effect.stat] -= effect.amount;
          logs.push(`📉 **${unit.name}**'s **${effect.name}** wore off.`);
        } 
        else {
          logs.push(`📉 **${unit.name}**'s **${effect.name}** wore off.`);
        }

      } else {
        activeEffects.push(effect);
      }
    }
    unit.effects = activeEffects;
    return logs;
  }
};