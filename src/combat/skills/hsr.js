const { addBuff } = require("../effects");
const { calculateDamage, applyPostDamageEffects } = require("../combatHelpers");

module.exports = {
  "Wanted: Dead or Alive": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Wanted: Dead or Alive",
    icon: "<:boothill_skill:placeholder>",
    description: "Shreds DEF. Attacks on target further reduce DEF.",
    execute: (attacker, defender, skillValues = [[20], [3]]) => {
      // 1. Extract Values
      const initialShred =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        20;
      const stackShred =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        3;

      // 2. Check for existing debuff (refresh if exists)
      const existing = defender.effects
        ? defender.effects.find((e) => e.name === "WANTED")
        : null;

      if (existing) {
        // Refresh turns, keep current stacks/shred
        existing.turns = 3;
        // Optionally reset stacks? The prompt implies "Applies a stack", usually resets new application.
        // Let's reset to initial state for a fresh cast.
        // Revert old def loss first to be clean
        defender.stats.def -= existing.amount; // amount is negative, so this adds it back

        // Apply new fresh debuff
        const flatLoss = -Math.floor(defender.stats.def * (initialShred / 100));
        defender.stats.def += flatLoss;
        existing.amount = flatLoss;
        existing.extra = [1, initialShred, stackShred]; // [CurrentStacks, CurrentTotal%, PerStack%]

        return {
          damage: 0,
          log: ` **${attacker.name}** refreshes the bounty!\n**${defender.name}** is **WANTED**! DEF reduced by **${initialShred}%**.`,
        };
      } else {
        // 3. Apply New Debuff
        // We store metadata in 'extra': [CurrentStacks, CurrentTotal%, PerStack%]
        const flatLoss = -Math.floor(defender.stats.def * (initialShred / 100));
        addBuff(defender, "WANTED", "def", flatLoss, 3, [
          1,
          initialShred,
          stackShred,
        ]);

        return {
          damage: 0,
          log: ` **${attacker.name}** posts a bounty!\n**${defender.name}** is **WANTED**! DEF reduced by **${initialShred}%**.`,
        };
      }
    },
  },
  "Cinderbloom Ritual": {
    initialEnergy: 75,
    requiredEnergy: 125,
    name: "Cinderbloom Ritual",
    icon: "<:lingsha_skill:placeholder>",
    description:
      "Converts {0}% Basic ATK dmg to healing. Skill dmg conversion reduced by {1}%.",
    execute: (attacker, defender, skillValues = [[64], [35]]) => {
      const basePct =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        64;
      const reducePct =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        35;

      // Store BOTH values in extra so the handler can distinguish source types
      addBuff(attacker, "Cinderbloom Ritual", "dmgConversion", basePct, 3, [
        basePct,
        reducePct,
      ]);

      return {
        damage: 0,
        log: `**${attacker.name}** initiates the **Cinderbloom Ritual**!\nConverts **${basePct}%** Basic Dmg to Heal (Skill Dmg -${reducePct}% effectiveness).`,
      };
    },
  },
  "Immortal's Will [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Immortal's Will [PASSIVE]",
    icon: "<:mydeiS:1459927676361113621>",
    description: "Start with high DEF. Decay DEF to gain ATK.",
    execute: (attacker, defender, skillValues = [[30], [16], [14]]) => {
      const startDefPct =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        30;
      const decayPct =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        16;
      const wrathAtkPct =
        (Array.isArray(skillValues[2]) ? skillValues[2][0] : skillValues[2]) ||
        14;

      const flatDefStart = Math.floor(attacker.stats.def * (startDefPct / 100));
      const flatDecay = Math.floor(attacker.stats.def * (decayPct / 100));

      addBuff(attacker, "Immortal's Will", "def", flatDefStart, 999, [
        flatDecay,
        wrathAtkPct,
      ]);

      return {
        damage: 0,
        log: `**${attacker.name}** exerts **Immortal's Will**!\nGained **+${flatDefStart} DEF** (${startDefPct}%)!`,
      };
    },
  },
  "Queen of the Death Kingdom [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Queen of the Death Kingdom [PASSIVE]",
    icon: "<:castorice_skill:1457011310767243405>",
    description:
      "Upon receiving fatal damage, prevents death and enters 'Death Kingdom' state for 3 turns.",
    execute: (attacker, defender, skillValues = [[1]]) => {
      const atkPercent =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        1;
      addBuff(attacker, "Death Kingdom Ward", "cheatDeath", 1, 999, atkPercent);
      return {
        damage: 0,
        log: `**${attacker.name}** is protected by the **Death Kingdom**.`,
      };
    },
  },
  "Echo of Calamity": {
    name: "Echo of Calamity",
    initialEnergy: 50,
    requiredEnergy: 100,
    execute: (att, def, values) => {
      const storePercent = values && values.length > 0 ? values[0] : 55;
      addBuff(att, "Echo of Calamity", "storeDmg", storePercent, 3, 0);
      return {
        log: `☀️ **${att.name}** activates **Echo of Calamity**! He will store **${storePercent}%** of damage taken for 3 turns!`,
      };
    },
  },

  "Crimson Verdict [PASSIVE]": {
    initialEnergy: 0,
    requiredEnergy: 999,
    name: "Crimson Verdict [PASSIVE]",
    icon: "<:acheron_skill:1456918056013135990>",
    description:
      "Attacks build Slashed Dream stacks. At 4 stacks, unleashes a guaranteed Crit slash.",
    execute: (attacker, defender, skillValues = [[20]]) => {
      const dmgPerStack =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        20;
      addBuff(attacker, "Slashed Dream", "stack", 0, 999, dmgPerStack);
      return {
        damage: 0,
        log: `**${attacker.name}** enters the battle with **Crimson Verdict** active!`,
      };
    },
  },
  "Key of Interpretation": {
    initialEnergy: 25,
    requiredEnergy: 75,
    name: "Key of Interpretation",
    icon: "<:herta_skill:1456549247611699200>",
    description: "Randomly sets enemy Energy.",
    execute: (attacker, defender, skillValues = [[0.6], [0.5]]) => {
      const selfMult =
        (Array.isArray(skillValues[0]) ? skillValues[0][0] : skillValues[0]) ||
        0.6;
      const enemyMult =
        (Array.isArray(skillValues[1]) ? skillValues[1][0] : skillValues[1]) ||
        0.5;
      const cap =
        defender.skill && defender.skill.requiredEnergy
          ? defender.skill.requiredEnergy
          : 100;

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

        // ✅ ATTACKER VICTIM (Self-Damage = SKILL)
        log += applyPostDamageEffects(attacker, damage, "SKILL");
      } else if (oldEnergy < newEnergy) {
        const rawIceDmg = Math.floor(attacker.maxHp * gapRatio * enemyMult);
        const { damage, suffix } = calculateDamage(
          attacker,
          defender,
          rawIceDmg,
          false
        );
        defender.stats.hp -= damage;

        log += `Gap: **${gapPercent}%** (Gained) ➔ **${defender.name}** received **${damage}** Ice DMG!${suffix}`;

        // ✅ SKILL DAMAGE
        log += applyPostDamageEffects(defender, damage, "SKILL");
      } else {
        log += `Gap: **0%** ➔ Nothing happened.`;
      }
      return { damage: 0, log };
    },
  },

  "Bulwark Protocol": {
    initialEnergy: 50,
    requiredEnergy: 100,
    name: "Bulwark Protocol",
    icon: "<:tb_skill:1454873572211425301>",
    description: "Increases Defense.",
    execute: (attacker, defender, skillValues = [15]) => {
      const percent =
        (Array.isArray(skillValues) ? skillValues[0] : skillValues) || 15;
      const boostAmount = Math.floor(attacker.stats.def * (percent / 100));
      addBuff(attacker, "Bulwark Protocol", "def", boostAmount, 2);
      return {
        damage: 0,
        log: `**${attacker.name}** used **Bulwark Protocol**!\nDefense increased!`,
      };
    },
  },
};
