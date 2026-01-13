const { addBuff } = require("../effects");
const { calculateDamage, applyPostDamageEffects } = require("../combatHelpers");

module.exports = {
  "Havoc of the Abyss": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Havoc of the Abyss",
    icon: "<:skirk_skill:1456936895115427860>",
    description:
      "Deals Ice DMG and reduces Speed. If already slowed, deals extra HP% damage.",
    execute: (attacker, defender, skillValues = [[90], [6]]) => {
      const dmgPercent =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        90;
      const extraHpPercent =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        6;

      const rawDamage = attacker.stats.atk * (dmgPercent / 100);
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** uses **Havoc of the Abyss**! Dealt **${damage}** Ice DMG!${suffix}`;

      // ✅ SKILL DAMAGE
      log += applyPostDamageEffects(defender, damage, "SKILL");

      let alreadySlowed = false;
      if (defender.effects) {
        const speedDebuff = defender.effects.find(
          (e) => e.stat === "speed" && e.amount < 0
        );
        if (speedDebuff) alreadySlowed = true;
      }

      if (alreadySlowed) {
        const extraDmg = Math.floor(defender.stats.hp * (extraHpPercent / 100));
        defender.stats.hp -= extraDmg;
        log += `\n**Abyssal Execution**: Target was slowed! Dealt **${extraDmg}** extra damage!`;

        // ✅ SKILL DAMAGE (Bonus Hit)
        log += applyPostDamageEffects(defender, extraDmg, "SKILL");
      }

      const speedReduction = Math.floor(defender.stats.speed * 0.25);
      addBuff(defender, "Abyssal Chill", "speed", -speedReduction, 5);
      log += `\n**${defender.name}**'s Speed reduced by **${speedReduction}** for 4 turns!`;

      return { damage, log };
    },
  },

  "Eternal Execution": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Eternal Execution",
    icon: "<:raiden_skill:1456922691411120170>",
    description:
      "Consumes 25-100% Energy to deal Electro DMG based on consumption.",
    execute: (attacker, defender, skillValues = [1]) => {
      const dmgPerPoint =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        1;
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

      // ✅ SKILL DAMAGE
      log += applyPostDamageEffects(defender, damage, "SKILL");

      return { damage, log };
    },
  },

  "Heavenfall Accord": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Heavenfall Accord",
    icon: "<:zhongli_skill:1456927829550829612>",
    description:
      "Raises Defense by {0}% for 2 turns. On expiry, Stuns target for 1 turn.",
    execute: (attacker, defender, skillValues = [20]) => {
      const percent =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        20;
      const boostAmount = Math.floor(attacker.stats.def * (percent / 100));
      addBuff(attacker, "Heavenfall Accord", "heavenfallDef", boostAmount, 3);
      return {
        damage: 0,
        log: `**${attacker.name}** uses **Heavenfall Accord**!\nDefense increased by **${boostAmount}**! Meteor incoming...`,
      };
    },
  },
  "Femboy Slash": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Femboy Slash",
    icon: "⚔️",
    description: "Slashes the target.",
    execute: (attacker, defender, skillValues = [1.1]) => {
      const multiplier =
        (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 1.1;
      const rawDamage = attacker.stats.atk * multiplier;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** uses **Femboy Slash**! Dealt **${damage}** DMG!${suffix}`;

      // ✅ SKILL DAMAGE
      log += applyPostDamageEffects(defender, damage, "SKILL");

      return { damage, log };
    },
  },
};
