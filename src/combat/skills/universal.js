// src/combat/skills/universal.js

const { addBuff } = require("../effects");
const { calculateDamage, applyPostDamageEffects } = require("../combatHelpers");

module.exports = {
  "Basic Attack": {
    name: "Basic Attack",
    icon: "🗡️",
    execute: (attacker, defender) => {
      let logExtra = "";

      // 1. Check Miss
      if (attacker.effects) {
        const blindEffect = attacker.effects.find(
          (e) => e.stat === "missChance"
        );
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
          return {
            damage: 0,
            log: `**${defender.name}** dodged **${attacker.name}**'s attack!`,
          };
        }
      }

      const critChance = attacker.stats.critRate || 5;
      const isCrit = Math.random() * 100 < critChance;
      const rawDamage = attacker.stats.atk;
      const { damage, suffix } = calculateDamage(
        attacker,
        defender,
        rawDamage,
        isCrit
      );

      defender.stats.hp -= damage;

      let logPrefix = `**${attacker.name}** attacks!`;
      if (isCrit) logPrefix = `**CRITICAL HIT!** **${attacker.name}** attacks!`;
      let log = `${logPrefix} Dealt **${damage}** DMG.${suffix}`;
      //boothil
      if (
        (defender.effects && attacker.name === "Boothill") ||
        attacker.name.includes("Team")
      ) {
        // Ensure specific attacker trigger if desired, or generic if ally proc allowed
        const wantedDebuff = defender.effects.find((e) => e.name === "WANTED");

        if (wantedDebuff && Array.isArray(wantedDebuff.extra)) {
          let [stacks, currentTotalPct, stackShredPct] = wantedDebuff.extra;

          if (stacks < 3) {
            const flatInc = -Math.floor(
              defender.stats.def * (stackShredPct / 100)
            );

            // Apply
            wantedDebuff.amount += flatInc;
            defender.stats.def += flatInc; // Add negative number

            // Update Metadata
            stacks++;
            currentTotalPct += stackShredPct;
            wantedDebuff.extra = [stacks, currentTotalPct, stackShredPct];

            log += `\n **WANTED** level rises to **${stacks}**! Decreasing another **${stackShredPct}%** DEF!`;
          }
        }
      }
      // Mudrock Passive Logic
      if (isCrit) {
        const fortressBuff = attacker.effects.find(
          (e) => e.name === "Indomitable Fortress"
        );
        if (fortressBuff) {
          const [stunChance, selfDmgPct] = Array.isArray(fortressBuff.extra)
            ? fortressBuff.extra
            : [35, 11];
          const isImmune = defender.effects.some(
            (e) => e.stat === "stunImmunity"
          );

          if (!isImmune) {
            if (Math.random() * 100 < stunChance) {
              addBuff(defender, "Concussive Force", "stun", 1, 1);
              addBuff(defender, "Stun Immunity", "stunImmunity", 1, 3);
              const selfDmg = Math.floor(attacker.maxHp * (selfDmgPct / 100));
              attacker.stats.hp -= selfDmg;
              log += `\n🔨 **Indomitable Fortress** activates! **${defender.name}** is **Stunned**!\n**${attacker.name}** took **${selfDmg}** recoil damage from the impact!`;
            }
          }
        }
      }

      // Wisadel Ammo Cleanup
      if (attacker.name === "Wisadel" || attacker.name.includes("Team")) {
        const ammoBuff = attacker.effects.find(
          (e) => e.name === "Explosive Ammo"
        );
        if (ammoBuff && ammoBuff.amount <= 0) {
          attacker.effects = attacker.effects.filter(
            (e) => e.name !== "Explosive Ammo"
          );
          const statBuffs = attacker.effects.filter(
            (e) => e.name === "Wisadel Buff"
          );
          statBuffs.forEach((b) => {
            if (attacker.stats[b.stat] !== undefined)
              attacker.stats[b.stat] -= b.amount;
          });
          attacker.effects = attacker.effects.filter(
            (e) => e.name !== "Wisadel Buff"
          );
          log += `\n\n⚠️ **Wisadel's Ammo** depleted! Buffs ended.`;
        }
      }

      // ✅ BASIC ATTACK DAMAGE (Pass "BASIC")
      log += applyPostDamageEffects(defender, damage, "BASIC");

      // Passive: Lifesteal & Acheron
      if (attacker.effects) {
        const lifestealBuff = attacker.effects.find(
          (e) => e.stat === "lifesteal"
        );
        if (lifestealBuff) {
          const healAmount = Math.floor(damage * (lifestealBuff.amount / 100));
          if (healAmount > 0) {
            attacker.stats.hp = Math.min(
              attacker.maxHp,
              attacker.stats.hp + healAmount
            );
            log += `\nHealed **${healAmount}** HP via Lifesteal!`;
          }
        }
        const acheronBuff = attacker.effects.find(
          (e) => e.name === "Slashed Dream"
        );
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
            log += ` **Slashed Dream Consumed!**\n**${attacker.name}** unleashed **Crimson Slash**! Dealt **${nukeCalc.damage}** DMG! **CRITICAL HIT!!**${nukeCalc.suffix}`;

            // ✅ SKILL DAMAGE (Acheron Nuke is a skill effect)
            log += applyPostDamageEffects(defender, nukeCalc.damage, "SKILL");
          }
        }
      }
      return { damage: damage, log: log };
    },
  },
};
