const battlingUsers = new Set();

module.exports = {
  isUserBattling: (userId) => battlingUsers.has(userId),
  setUserBattling: (userId) => battlingUsers.add(userId),
  removeUserBattling: (userId) => battlingUsers.delete(userId),
};