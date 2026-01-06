const { Cards, Index, Inventory } = require("../db");
const { getFixedCardXp, getCardLevelCap } = require("../dungeon/dungeonData");
const { getNextUid } = require("../functions");
const { updateQuestProgress } = require("../quest/questManager"); // ✅ Import Quest Manager

// ==========================================
// 1. CONFIGURATION & HELPERS
// ==========================================

const LEVEL_CAPS = {
  1: 40,
  2: 50,
  3: 60,
  4: 80,
  5: 90,
  6: 100,
};

const BLESSINGS = {
  b1: { name: "Minor Blessing", chance: 20, minThreat: 1 },
  b2: { name: "Major Blessing", chance: 8, minThreat: 1 },
  b3: { name: "Grand Blessing", chance: 1, minThreat: 2 },
  b4: { name: "Divine Blessing", chance: 0.5, minThreat: 3 },
};

// ✅ STAT CALCULATION
function calculateStats(baseStats, rarity) {
  const b = baseStats || { hp: 75, atk: 60, def: 50, speed: 69 };
  const r = typeof rarity === "number" ? rarity : 1;

  return {
    hp: Math.floor(b.hp * (3 + r) + r * 20 + Math.floor(Math.random() * 20)),
    atk: Math.floor(b.atk + 25 * r + Math.floor(Math.random() * 10)),
    def: Math.floor(b.def + 20 * r + Math.floor(Math.random() * 10)),
    speed: Math.floor(b.speed + 7 * r + Math.floor(Math.random() * 5)),
  };
}

// Roll Rarity
function rollDropRarity(threatLevel) {
  const rand = Math.random() * 100;
  let chance3 = 5;
  let chance2 = 20;

  if (threatLevel > 1) {
    const scale = (threatLevel - 1) * 5;
    chance3 += scale;
    chance2 += scale / 2;
  }

  chance3 = Math.min(chance3, 50);
  chance2 = Math.min(chance2, 40);

  if (rand < chance3) return 3;
  if (rand < chance3 + chance2) return 2;
  return 1;
}

// Roll Item Drop
function rollItemDrop(threatLevel) {
  const rand = Math.random() * 100;
  const threatMult = 1 + threatLevel * 0.5;

  if (
    threatLevel >= BLESSINGS.b4.minThreat &&
    rand < BLESSINGS.b4.chance * threatMult
  )
    return "b4";
  if (
    threatLevel >= BLESSINGS.b3.minThreat &&
    rand < BLESSINGS.b3.chance * threatMult
  )
    return "b3";
  if (rand < BLESSINGS.b2.chance * threatMult) return "b2";
  if (rand < BLESSINGS.b1.chance * threatMult) return "b1";
  return null;
}

// ==========================================
// 2. MAIN REWARD PROCESSOR
// ==========================================
async function processBattleRewards(
  userId,
  user,
  playerCard,
  stageData,
  loops = 1,
  message = null // ✅ Added optional message param for quest replies
) {
  const report = {
    gold: 0,
    cardXp: 0,
    accountXp: 0,
    levelsGained: 0,
    drops: [],
    itemDrops: [],
    accountLevelUp: false,
    lvlUpGold: 0,
    lvlUpTickets: 0,
    stamCapIncreased: false,
  };

  const mobTemplate = stageData.mobs[0];
  const difficulty = stageData.difficultyLevel;
  const threatLevel = mobTemplate.rarity || 1;

  // --- A. RESOURCE CALCULATION ---
  for (let i = 0; i < loops; i++) {
    report.gold += mobTemplate.rewards.gold || 100;
    report.cardXp += getFixedCardXp(difficulty);
    report.accountXp += 15 + (user.dungeon.currentArea || 1) * 5;
  }

  // --- B. CARD LEVELING ---
  playerCard.xp += report.cardXp;
  const maxLevel = LEVEL_CAPS[playerCard.rarity] || 60;
  let xpToNext = getCardLevelCap(playerCard.level);

  while (playerCard.xp >= xpToNext && playerCard.level < maxLevel) {
    playerCard.xp -= xpToNext;
    playerCard.level++;
    report.levelsGained++;
    
    // ✅ QUEST UPDATE: Card Level Up
    // If message is null, it just updates DB without replying.
    await updateQuestProgress(user, "CARD_LEVEL_UP", 1, message);

    playerCard.stats.hp = Math.floor(playerCard.stats.hp * 1.02);
    playerCard.stats.atk = Math.floor(playerCard.stats.atk * 1.015);
    playerCard.stats.def = Math.floor(playerCard.stats.def * 1.013);
    playerCard.stats.speed = Math.floor(playerCard.stats.speed * 1.01);
    xpToNext = getCardLevelCap(playerCard.level);
  }

  if (playerCard.level >= maxLevel) {
    playerCard.xp = 0;
    playerCard.xpCap = 0;
  } else {
    playerCard.xpCap = xpToNext;
  }

  // --- C. ACCOUNT LEVELING ---
  user.gold += report.gold;
  user.xp += report.accountXp;

  while (user.xp >= 100 + (user.level - 1) * 10) {
    user.xp -= 100 + (user.level - 1) * 10;
    user.level++;
    report.accountLevelUp = true;
    if (user.stamCap  < 150 && user.level % 2 == 0) {
      user.stamCap += 2;
      report.stamCapIncreased = true;
    }
    user.stam += user.stamCap;

    const goldGain = 5000 + user.level * 500;
    report.lvlUpGold += goldGain;
    user.gold += goldGain;
    report.lvlUpTickets += 2;
  }

  let userInv = await Inventory.findOne({ userId });
  if (!userInv) userInv = new Inventory({ userId, items: [] });

  if (report.lvlUpTickets > 0) {
    const ticketItem = userInv.items.find((i) => i.itemId === "ticket");
    if (ticketItem) ticketItem.amount += report.lvlUpTickets;
    else userInv.items.push({ itemId: "ticket", amount: report.lvlUpTickets });
  }

  // --- D. BATTLE DROPS (SAME CARD FIX) ---

  // 1. Fetch ONE random card (Base Card)
  const randomCardAgg = await Index.aggregate([{ $sample: { size: 1 } }]);
  const baseData =
    randomCardAgg && randomCardAgg.length > 0 ? randomCardAgg[0] : null;

  for (let i = 0; i < loops; i++) {
    // -- Card Drop (Copies of the same Base Card) --
    if (baseData) {
      const dropRarity = rollDropRarity(threatLevel);
      const uniqueStats = calculateStats(baseData.stats, dropRarity);

      // ✅ CALCULATE NEXT UID HERE
      const nextUid = await getNextUid(userId);

      await Cards.create({
        ownerId: userId,
        uid: nextUid, // Assign Persistent ID
        cardId: baseData.pokeId,
        stats: uniqueStats,
        rarity: dropRarity,
        level: 1,
        xp: 0,
      });
      report.drops.push(`${baseData.name} (${"⭐".repeat(dropRarity)})`);
    }

    // -- Item Drop --
    const itemDropId = rollItemDrop(threatLevel);
    if (itemDropId) {
      const itemData = BLESSINGS[itemDropId];
      report.itemDrops.push({ id: itemDropId, name: itemData.name });

      const invItem = userInv.items.find((i) => i.itemId === itemDropId);
      if (invItem) invItem.amount++;
      else userInv.items.push({ itemId: itemDropId, amount: 1 });
    }
  }

  await userInv.save();
  await user.save();
  await playerCard.save();

  return report;
}

module.exports = { processBattleRewards };