const battlingUsers = new Set();
const pullingUsers = new Set();
const tradingUsers = new Set();


module.exports = {
  isUserBattling: (userId) => battlingUsers.has(userId),
  setUserBattling: (userId) => battlingUsers.add(userId),
  removeUserBattling: (userId) => battlingUsers.delete(userId),

  isUserPulling: (userId) => pullingUsers.has(userId),
  setUserPulling: (userId) => pullingUsers.add(userId),
  removeUserPulling: (userId) => pullingUsers.delete(userId),

  isUserTrading: (userId) => tradingUsers.has(userId),
  setUserTrading: (userId) => tradingUsers.add(userId),
  removeUserTrading: (userId) => tradingUsers.delete(userId),

};
