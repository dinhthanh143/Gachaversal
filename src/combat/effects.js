// src/combat/effects.js

// =========================================
// 1. Define Functions Locally
// =========================================

function addBuff(unit, name, stat, amount, turns, extraValue = null) {
  if (!unit.effects) unit.effects = [];

  // ✅ Handle Stats 
  // We include "heavenfallDef" here so it specifically modifies the Defense stat
  if (
    [
      "atk",
      "def",
      "speed",
      "hp",
      "critRate",
      "critDmg",
      "heavenfallDef",
    ].includes(stat)
  ) {
    if (stat === "heavenfallDef") {
      unit.stats.def += amount; // Apply to Defense
    } else if (unit.stats[stat] !== undefined) {
      unit.stats[stat] += amount;
    }
  }

  unit.effects.push({ name, stat, amount, turns, extra: extraValue });
}

function applyStartTurnEffects(unit) {
  const logs = [];
  if (!unit.effects) return logs;
  for (const effect of unit.effects) {
    if (effect.stat === "medicRegen") {
      const healAmount = Math.floor(unit.maxHp * (effect.amount / 100));
      // Ensure we don't heal past Max HP
      unit.stats.hp = Math.min(unit.maxHp, unit.stats.hp + healAmount);
      logs.push(
        `🏥 **Medic Protocol** heals **${unit.name}** for **${healAmount}** HP!`
      );
    }
    if (effect.stat === "energyDrain") {
      const drain = Math.floor(effect.amount);
      const old = unit.energy;
      unit.energy = Math.max(0, unit.energy - drain);
      if (old > 0)
        logs.push(
          `⚡ **${unit.name}** lost **${old - unit.energy}** Energy due to **${
            effect.name
          }**!`
        );
    }
    if (effect.stat === "burn") {
      const dmg = Math.max(1, Math.floor(unit.maxHp * (effect.amount / 100)));
      unit.stats.hp -= dmg;
      logs.push(`🔥 **${unit.name}** took **${dmg}** Burn damage!`);
    }
  }
  return logs;
}

function applyEndTurnEffects(unit, opponent = null) {
  const logs = [];
  if (!unit.effects) return logs;
  const activeEffects = [];

  for (const effect of unit.effects) {
    if (effect.name.includes("Immortal's Will")) {
        // Safety: Ensure extra data exists
        if (!Array.isArray(effect.extra)) {
            activeEffects.push(effect); // Keep it to prevent crashing
            continue;
        }

        const [flatDecay, wrathAtkPct] = effect.extra;

        // 1. Apply Decay
        effect.amount -= flatDecay;
        unit.stats.def -= flatDecay;

        // 2. Check Transformation
        if (effect.amount <= 0) {
            // Clean up negative remainder
            if (effect.amount < 0) unit.stats.def += Math.abs(effect.amount);

            // Apply Wrath ATK Buff
            const wrathBoost = Math.floor(unit.stats.atk * (wrathAtkPct / 100));
            unit.stats.atk += wrathBoost;
            
            // ✅ PUSH NEW BUFF (Mortal Wrath)
            activeEffects.push({
                name: "Mortal Wrath",
                stat: "atk",
                amount: wrathBoost,
                turns: 999,
                extra: null
            });

            // ✅ PUSH LOG (This must be here!)
            logs.push(`🛡️ **Immortal's Will** shatters! **${unit.name}** enters **Mortal Wrath**!\nDEF Bonus lost. Gained **+${wrathBoost} ATK**!`);
            
            // Skip the rest of the loop for this specific effect 
            // (prevents it from hitting the 'wore off' logic below)
            continue; 
        } else {
            // Log Decay (Optional: Comment out if too spammy)
            logs.push(`📉 **Immortal's Will** decays... DEF reduced by **${flatDecay}**.`);
        }
    }
    // --- Active Round-Based Effects ---
    if (effect.stat === "condRegen") {
      if (unit.stats.hp < unit.maxHp * 0.5) {
        const healAmount = Math.floor(unit.maxHp * (effect.amount / 100));
        unit.stats.hp = Math.min(unit.maxHp, unit.stats.hp + healAmount);
        logs.push(
          `✨ **${unit.name}**'s **${effect.name}** triggers! Healed **${healAmount}** HP.`
        );
      }
    } 
   

    // Decrement Turn
    effect.turns -= 1;

    // --- Expiration Logic ---
    if (effect.turns <= 0) {
      // Castorice Death Logic
      if (effect.stat === "zombieState") {
        unit.stats.hp = 0;
        logs.push(
          `💀 **${unit.name}**'s time in the Death Kingdom has ended. She fades away...`
        );
      }

      // ✅ ZHONGLI METEOR
      if (effect.stat === "heavenfallDef") {
        // 1. Revert Defense
        unit.stats.def -= effect.amount;

        // 2. Stun Opponent
        if (opponent) {
          addBuff(opponent, "Petrification", "stun", 1, 1);
          logs.push(
            `☄️ **Heavenfall Accord** expires! A Meteor falls and **Stuns ${opponent.name}**!`
          );
        } else {
          logs.push(`☄️ **Heavenfall Accord** expires (No target found).`);
        }
      }

      // ✅ MIYABI DELAYED DMG
      else if (effect.stat === "delayedDmg") {
        const dmg = Math.floor(effect.amount);
        unit.stats.hp -= dmg;
        logs.push(
          `❄️ **${unit.name}**'s **${effect.name}** detonates! Took **${dmg}** True Damage!`
        );
      }

      // ✅ PHAINON STORED DAMAGE
      else if (effect.stat === "storeDmg") {
        let storedTotal = effect.extra || 0;
        
        // Only trigger if we have damage stored and an opponent exists
        if (storedTotal > 0 && opponent) {
            
            // 🔹 NEW: Check for HP < 50% Bonus
            const hpPercent = unit.stats.hp / unit.maxHp;
            let bonusMsg = "";
            
            if (hpPercent < 0.5) {
                storedTotal = Math.floor(storedTotal * 1.3); // +30% Damage
                bonusMsg = " (Critical HP Bonus +30%!)";
            }

            opponent.stats.hp -= storedTotal;
            logs.push(
              `☀️ **Echo of Calamity** expires! Unleashed **${storedTotal}** Light Damage${bonusMsg} against **${opponent.name}**!`
            );
        } else {
          logs.push(`☀️ **Echo of Calamity** faded (No damage stored).`);
        }
      }

      // ✅ GENERIC STAT REVERT
      // (Reverts basic stats when buff ends)
      else if (
        [
          "atk",
          "def",
          "speed",
          "hp",
          "critRate",
          "critDmg",
          "lifesteal",
        ].includes(effect.stat)
      ) {
        if (unit.stats[effect.stat] !== undefined)
          unit.stats[effect.stat] -= effect.amount;
        logs.push(`📉 **${unit.name}**'s **${effect.name}** wore off.`);
      }

      // ✅ FALLBACK (For non-stat effects like 'energyRegen' or 'ammoCount')
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

// =========================================
// 2. Export
// =========================================
module.exports = { addBuff, applyStartTurnEffects, applyEndTurnEffects };