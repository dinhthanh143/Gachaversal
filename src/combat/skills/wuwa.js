const { addBuff } = require("../effects");
const { calculateDamage, applyPostDamageEffects } = require("../combatHelpers");

module.exports = {
  "Flamming bullets": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Flamming bullets",
    icon: "<:galbrena_skill:1446787462742409298>",
    description:
      "Fires incendiary rounds that deal {0}x **Max HP** damage and have a {1}% chance to ignite the target, dealing 7% of opponent's Max HP as damage every turn for 2 turns.",
    execute: (attacker, defender, skillValues = [[0.2], [25]]) => {
      const damageMult =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        0.2;
      const burnChance =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        25;

      const rawDamage = attacker.maxHp * damageMult;
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      let log = `**${attacker.name}** fires **Flamming bullets**! Dealt **${damage}** DMG!${suffix}`;

      // ✅ SKILL DAMAGE
      log += applyPostDamageEffects(defender, damage, "SKILL");

      if (Math.random() * 100 < burnChance) {
        addBuff(defender, "Ignite", "burn", 7, 2);
        log += `\n**${defender.name}** was ignited!`;
      } else {
        log += `\n(Ignite failed)`;
      }
      return { damage, log };
    },
  },
  "Tactical Overclock": {
    initialEnergy: 25,
    requiredEnergy: 75,
    name: "Tactical Overclock",
    icon: "<:chisa_skill:1446787026392190997>",
    description:
      "Gains {0}% Crit Rate and +{1}% Speed per stack (max 3 stacks).",
    execute: (attacker, defender, skillValues = [[10], [1]]) => {
      const critBase =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        10;
      const spdBase =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        1;

      if (!attacker.effects) attacker.effects = [];
      const critEff = attacker.effects.find(
        (e) => e.name === "Tactical Overclock" && e.stat === "critRate"
      );
      const spdEff = attacker.effects.find(
        (e) => e.name === "Tactical Overclock" && e.stat === "speed"
      );

      if (!critEff) {
        addBuff(attacker, "Tactical Overclock", "critRate", critBase, 4, 1);
        addBuff(attacker, "Tactical Overclock", "speed", spdBase, 4, 1);
        return {
          damage: 0,
          log: `**${attacker.name}** enters Overclock! (Stack 1)\nCurrently: **+${critBase}% Crit**, **+${spdBase} SPD**`,
        };
      }

      let stacks = critEff.extra || 1;
      critEff.turns = 4;
      if (spdEff) spdEff.turns = 4;

      if (stacks < 3) {
        stacks++;
        critEff.amount += critBase;
        if (spdEff) spdEff.amount += spdBase;
        if (attacker.stats.critRate !== undefined)
          attacker.stats.critRate += critBase;
        if (attacker.stats.speed !== undefined) attacker.stats.speed += spdBase;
        critEff.extra = stacks;
        if (spdEff) spdEff.extra = stacks;

        return {
          damage: 0,
          log: `**${
            attacker.name
          }** Overclock Rising! (Stack ${stacks})\nTotal: **+${
            critEff.amount
          }% Crit**, **+${spdEff ? spdEff.amount : 0} SPD**`,
        };
      }
      return {
        damage: 0,
        log: `**${attacker.name}** Overclock Refreshed! (Max Stacks)`,
      };
    },
  },

  "Piercing Shards": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Piercing Shards",
    icon: "<:carlotta_skill:1446787543092822027>",
    description: "Fires three searing shots.",
    execute: (attacker, defender, skillValues = [[0.3], [10]]) => {
      const dmgMult =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        0.3;
      const critChance =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        10;
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

      // ✅ SKILL DAMAGE
      log += applyPostDamageEffects(defender, totalDamage, "SKILL");

      return { damage: totalDamage, log };
    },
  },
  "Gale Disruption": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Gale Disruption",
    icon: "<:rover_skill_gale:1446799294492311603>",
    description: "Reduces enemy's accuracy.",
    execute: (attacker, defender, skillValues = [15]) => {
      const chance =
        (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 15;
      addBuff(defender, "Gale Disruption", "missChance", chance, 2);
      return {
        damage: 0,
        log: `**${attacker.name}** uses **Gale Disruption**!\n**${defender.name}**'s accuracy reduced!`,
      };
    },
  },
  "Wind's Edge [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Wind's Edge [PASSIVE]",
    icon: "<:qiuyuan_skill:1447262771245748255>",
    description: "Enters a defensive stance.",
    execute: (attacker, defender, skillValues = [10, 10]) => {
      const dodgeChance =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        10;
      const counterDmg =
        Array.isArray(skillValues) && skillValues[1] ? skillValues[1] : 10;
      addBuff(attacker, "Wind's Edge", "dodge", dodgeChance, 3, counterDmg);
      return {
        damage: 0,
        log: `**${attacker.name}** activates **Wind's Edge**!\nGain **${dodgeChance}% Dodge Chance** against Basic Attacks!`,
      };
    },
  },
};
