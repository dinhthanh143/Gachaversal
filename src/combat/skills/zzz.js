const { addBuff } = require("../effects");
const { calculateDamage, applyPostDamageEffects } = require("../combatHelpers");

module.exports = {
  "Sugar Rush": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Sugar Rush",
    icon: "<:yuzuha_skill:1457214067638009956>",
    description: "Increases ATK and Energy Regen.",
    execute: (attacker, defender, skillValues = [[12], [10]]) => {
      const atkPct =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        12;
      const erPct =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        10;
      const calcAtkBoost = Math.floor(attacker.stats.atk * (atkPct / 100));
      const existing = attacker.effects.find((e) => e.name === "Sugar Rush");

      if (!existing) {
        addBuff(attacker, "Sugar Rush", "atk", calcAtkBoost, 5, 1);
        addBuff(attacker, "Sugar Rush", "energyRegen", erPct, 5, 1);
        return {
          damage: 0,
          log: `**${attacker.name}** uses **Sugar Rush**! (Stack 1)\nATK increased by **${calcAtkBoost}** & Energy Regen by **${erPct}%**!`,
        };
      } else {
        const allBuffs = attacker.effects.filter(
          (e) => e.name === "Sugar Rush"
        );
        let stack = existing.extra || 1;
        let log = "";
        if (stack < 2) {
          stack++;
          attacker.stats.atk += calcAtkBoost;
          allBuffs.forEach((e) => {
            e.turns = 5;
            e.extra = stack;
            if (e.stat === "atk") e.amount += calcAtkBoost;
            if (e.stat === "energyRegen") e.amount += erPct;
          });
          log = `**${attacker.name}** uses **Sugar Rush**! (Stack ${stack})\nBuffs stacked and duration reset!`;
        } else {
          allBuffs.forEach((e) => (e.turns = 5));
          log = `**${attacker.name}** uses **Sugar Rush**! (Max Stacks)\nDuration refreshed!`;
        }
        return { damage: 0, log };
      }
    },
  },
  "Sword Of The Divine [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Sword Of The Divine [PASSIVE]",
    icon: "<:ye_skill:1446822377101983787>",
    description:
      "If Speed < Target: Gain Lifesteal. Else: Gain ATK & Crit Rate.",
    execute: (attacker, defender, skillValues = [[17], [10], [8]]) => {
      const lsVal =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        17;
      const atkVal =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        10;
      const critVal =
        (Array.isArray(skillValues[2]) ? skillValues[2][0] : skillValues[2]) ||
        8;

      let log = "";
      if (attacker.stats.speed < defender.stats.speed) {
        addBuff(attacker, "Sword Of The Divine", "lifesteal", lsVal, 999);
        log = `**${attacker.name}** is slower! Gained **${lsVal}% Lifesteal**!`;
      } else {
        addBuff(attacker, "Sword Of The Divine", "atk", atkVal, 999);
        addBuff(attacker, "Sword Of The Divine", "critRate", critVal, 999);
        if (attacker.stats.atk !== undefined) attacker.stats.atk += atkVal;
        if (attacker.stats.critRate !== undefined)
          attacker.stats.critRate += critVal;
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
      const percentage =
        (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 100;
      const multiplier = percentage / 100;
      const rawDamage = attacker.stats.atk * multiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** uses **Power Strike**! Dealt **${damage}** DMG!${suffix}`;

      // ✅ SKILL DAMAGE
      log += applyPostDamageEffects(defender, damage, "SKILL");

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
      const multiplier =
        (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const trueDamage = Math.floor(attacker.stats.atk * multiplier);
      addBuff(defender, "Judgement Mark", "delayedDmg", trueDamage, 2);
      return {
        damage: 0,
        log: `**${attacker.name}** uses **Judgement Cut**!\n**${defender.name}** is marked for 2 turns...`,
      };
    },
  },

  "Divine Foresight": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Divine Foresight",
    icon: "<:yixuan_skill:1453672321306067110>",
    description: "Reduces incoming damage and prepares healing.",
    execute: (attacker, defender, skillValues = [[10], [4]]) => {
      const reduction =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        10;
      const healPercent =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        4;
      addBuff(attacker, "Divine Shield", "dmgRed", reduction, 3);
      addBuff(attacker, "Divine Regen", "condRegen", healPercent, 3);
      return {
        damage: 0,
        log: `**${attacker.name}** uses **Divine Foresight**!\nDecreases incoming DMG and prepares healing!`,
      };
    },
  },
  "Proxy's Rizz": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Proxy's Rizz",
    icon: "<:wise_skill:1454330440096944201>",
    description: "Reduces Defense.",
    execute: (attacker, defender, skillValues = [10]) => {
      const percent =
        (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 10;
      const reduceAmount = -Math.floor(defender.stats.def * (percent / 100));
      addBuff(defender, "Proxy's Rizz", "def", reduceAmount, 2);
      return {
        damage: 0,
        log: `**${attacker.name}** uses **Proxy's Rizz**!\n**${defender.name}**'s Defense reduced!`,
      };
    },
  },
};
