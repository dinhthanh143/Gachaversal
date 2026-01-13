// src/levelSystem.js
const { UserContainer, Inventory } = require("./db");
const { goldIcon } = require("./commands/hourly_daily_weekly"); // Ensure path is correct

// XP needed for next level (Must match profile.js logic)
function xpForNextLevel(level) {
  return 100 + (level - 1) * 50; 
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

module.exports = {
  getLevel,
};