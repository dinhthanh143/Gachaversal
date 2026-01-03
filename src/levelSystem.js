// levelSystem.js
const { UserContainer } = require("./db");

// XP needed for next level
function xpForNextLevel(level) {
  return 100 + (level - 1) * 10;
}

// Adds EXP & handles level-up logic
async function addXp(userId, amount) {
  let user = await UserContainer.findOne({ userId });
  if (!user) {
    return null;
  }
  user.xp += amount;
  let leveledUp = false;

  // Handle multiple level-ups in one shot
  while (user.xp >= xpForNextLevel(user.level)) {
    user.xp -= xpForNextLevel(user.level);
    user.level++;
    leveledUp = true;
  }
  await user.save();
  return {
    leveledUp,
    level: user.level,
    currentXp: user.xp,
    nextLevelXp: xpForNextLevel(user.level),
  };
}

// Get player info
async function getLevel(userId) {
  let user = await UserContainer.findOne({ userId });
  if (!user) return null;

  return {
    level: user.level,
    currentXp: user.xp,
    nextLevelXp: xpForNextLevel(user.level),
  };
}

async function giveXpAndNotify(message, amount, addXpFunc) {
  const result = await addXpFunc(message.author.id, amount);

  if (!result) {
    message.reply("You don't exist yet... try `!create` first.");
    return;
  }

  if (result.leveledUp) {
    message.reply(
      `🎉 Congrats! You leveled up! Current Level: **${result.level}**`
    );
  } else {
    message.reply(
      `+${amount} XP! Current XP: **${result.currentXp}/${result.nextLevelXp}**`
    );
  }
}
module.exports = {
  addXp,
  getLevel,
  giveXpAndNotify,
};
