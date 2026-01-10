
const QUESTS = {
  daily_gacha_2: {
    id: "daily_gacha_2",
    name: "Summoner's Call",
    description: "Pull on any banner 2 times.",
    type: "GACHA_PULL", 
    target: 2,
    rewards: {
      gold: 5000,
      gem: 0,
      items: [] 
    }
  },

  daily_stamina_100: {
    id: "daily_stamina_100",
    name: "Burning Energy",
    description: "Spend a total of 180 Stamina.",
    type: "SPEND_STAMINA", 
    target: 180,
    rewards: {
      gold: 2500,
      gem: 2,
      items: []
    }
  },

  daily_battle_10: {
    id: "daily_battle_10",
    name: "Dungeon Crawler",
    description: "Complete 10 Battles (Any Stage).",
    type: "BATTLE_COMPLETE", 
    target: 10,
    rewards: {
      gold: 4000,
      gem: 3,
      items: [] 
    }
  },

  daily_levelup_1: {
    id: "daily_levelup_1",
    name: "Rising Power",
    description: "Level up any card 1 time.",
    type: "CARD_LEVEL_UP", 
    target: 1,
    rewards: {
      gold: 2500,
      gem: 0,
      items: []
    }
  },

  daily_shop_spender: {
    id: "daily_shop_spender",
    name: "Window Shopper",
    description: "Buy at least 1 item from the Shop.",
    type: "SHOP_BUY",
    target: 1,
    rewards: {
      gold: 3500,
      gem: 0,
      items: []
    }
  },

  daily_gold_sink: {
    id: "daily_gold_sink",
    name: "Big Spender",
    description: "Spend a total of 10,000 Gold(excluding via trading).",
    type: "SPEND_GOLD", 
    target: 10000,
    rewards: {
      gold: 4500,
      gem: 2,
      items: []
    }
  },

  daily_hourly_claim: {
    id: "daily_hourly_claim",
    name: "Punctual",
    description: "Claim your !hourly command 3 times.",
    type: "HOURLY_CLAIM", 
    target: 3,
    rewards: {
      gold: 4000,
      gem: 0,
      items: []
    }
  },
};

module.exports = { QUESTS };