// src/combat/skills/arknights.js

const { addBuff } = require("../effects");
const { calculateDamage, applyPostDamageEffects } = require("../combatHelpers");

module.exports = {
  "BANG!": {
    initialEnergy: 175,
    requiredEnergy: 225,
    name: "BANG!",
    icon: "<:w_skill:1457218706731171840>",
    description: "Loads 5 Explosive Ammos.",
    execute: (attacker, defender, skillValues) => {
      const atkInc =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        4;
      const critInc =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        4;
      addBuff(attacker, "Explosive Ammo", "ammoCount", 5, 999, [
        atkInc,
        critInc,
      ]);
      return {
        damage: 0,
        log: `**${attacker.name}** activates **BANG!**\nReloaded **5 Explosive Ammos**!`,
      };
    },
  },

  "Arts Convergence": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Arts Convergence",
    icon: "<:amiya_skill:1457210609258070036>",
    description:
      "Channels Originium Arts to deal DMG and drain target's Energy.",
    execute: (attacker, defender, skillValues = [[105], [10]]) => {
      const dmgPercent =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        105;
      const drainAmount =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        10;

      const rawDamage = attacker.stats.atk * (dmgPercent / 100);
      const { damage, suffix } = calculateDamage(attacker, defender, rawDamage);
      defender.stats.hp -= damage;

      const targetCurrentEnergy = defender.energy || 0;
      const actualDrain = Math.min(targetCurrentEnergy, drainAmount);
      defender.energy -= actualDrain;

      let log = `**${attacker.name}** channels **Arts Convergence**! Dealt **${damage}** DMG!${suffix}`;
      if (actualDrain > 0)
        log += `\nDrained **${actualDrain}** Energy from **${defender.name}**!`;
      else log += `\n(Target had no Energy to drain)`;

      log += applyPostDamageEffects(defender, damage, "SKILL");

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
      const healPercent =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        5;
      addBuff(attacker, "Medic Protocol", "medicRegen", healPercent, 3);
      return {
        damage: 0,
        log: `**${attacker.name}** activates **Medic Protocol**!\nHealing systems initialized for 3 turns.`,
      };
    },
  },
  "Tides of the Abyssal Hunter": {
    initialEnergy: 75,
    requiredEnergy: 125,
    name: "Tides of the Abyssal Hunter",
    icon: "<:skadiS:1459944538243207168>",
    description: "Buffs ATK, HP, and DEF for 3 turns.",
    execute: (attacker, defender, skillValues = [[18], [13], [12]]) => {
      const atkPct =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        18;
      const hpPct =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        13;
      const defPct =
        (Array.isArray(skillValues[2]) ? skillValues[2][0] : skillValues[2]) ||
        12;

      const atkBoost = Math.floor(attacker.stats.atk * (atkPct / 100));
      const defBoost = Math.floor(attacker.stats.def * (defPct / 100));
      const hpBoost = Math.floor(attacker.maxHp * (hpPct / 100));

      addBuff(attacker, "Abyssal Tide", "atk", atkBoost, 3);
      addBuff(attacker, "Abyssal Tide", "def", defBoost, 3);
      addBuff(attacker, "Abyssal Tide", "hp", hpBoost, 3);

      if (attacker.stats.hp > attacker.maxHp) {
        attacker.maxHp = attacker.stats.hp;
      }

      return {
        damage: 0,
        log: `🌊 **${attacker.name}** channels the **Tides**!\nSurged with **+${atkBoost}** ATK, **+${defBoost}** DEF, and **+${hpBoost}** HP for 3 turns!`,
      };
    },
  },

  "Indomitable Fortress [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Indomitable Fortress [PASSIVE]",
    icon: "<:mudrock_skill:1459919648584634368>",
    description: "Gains Crit Rate. Crits can Stun but deal self-damage.",
    execute: (attacker, defender, skillValues = [[18], [35], [11]]) => {
      const critRate =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        18;
      const stunChance =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        35;
      const selfDmgPct =
        (Array.isArray(skillValues[2]) ? skillValues[2][0] : skillValues[2]) ||
        11;

      addBuff(attacker, "Indomitable Fortress", "critRate", critRate, 999, [
        stunChance,
        selfDmgPct,
      ]);

      return {
        damage: 0,
        log: `**${attacker.name}** stands firm as an **Indomitable Fortress**! Raising It's Crit Rate by ${critRate}% and chances to stun.`,
      };
    },
  },
  "Orbital Strike": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Orbital Strike",
    icon: "<:lemuen_skill:placeholder>",
    description: "Deals massive True DMG. Crits if HP > 50% but Stuns self.",
    execute: (attacker, defender, skillValues = [[14], [5]]) => {
      const hpPercent =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        14;
      const atkPercent =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        5;

      const hpDmg = defender.maxHp * (hpPercent / 100);
      const atkDmg = attacker.stats.atk * (atkPercent / 100);
      let totalDmg = Math.floor(hpDmg + atkDmg);

      let log = `**${attacker.name}** calls down an **Orbital Strike**!`;

      const targetHpPct = defender.stats.hp / defender.maxHp;
      if (targetHpPct > 0.5) {
        const critMult = (attacker.stats.critDmg || 140) / 100;
        totalDmg = Math.floor(totalDmg * critMult);
        addBuff(attacker, "Recoil", "stun", 1, 2);
        log += `\nTarget HP High! **CRITICAL HIT!** (Recoil Stuns Lemuen!)`;
      }

      defender.stats.hp -= totalDmg;
      log += `\nDealt **${totalDmg}** True Damage!`;

      // ✅ SKILL DAMAGE
      log += applyPostDamageEffects(defender, totalDmg, "SKILL");

      return { damage: totalDmg, log };
    },
  },
  "Nocturnal Silence": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Nocturnal Silence",
    icon: "<:lappland_skill:1454368319686840341>",
    description: "Silences the target.",
    execute: (attacker, defender, skillValues = [5]) => {
      const drainAmount =
        (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 5;
      addBuff(defender, "Nocturnal Silence", "energyDrain", drainAmount, 2);
      addBuff(defender, "Silenced", "silence", 1, 2);
      return {
        damage: 0,
        log: `**${attacker.name}** uses **Nocturnal Silence**!\n**${defender.name}** is **Silenced**!`,
      };
    },
  },
};
