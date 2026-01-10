const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}

// 1. MASTER INDEX (The Encyclopedia)
const IndexSchema = new mongoose.Schema({
  pokeId: { type: Number, required: true, unique: true },
  franchise: { type: String },
  name: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  stats: {
    atk: Number,
    hp: Number,
    speed: Number,
    def: Number,
  },
  skill: {
    icon: String,
    name: String,
    description: { type: String },
    values: { type: [[Number]], default: [] },
  },
  image: { type: String, required: true },
  cardColor: { type: String, required: true },
});

// 2. USER PROFILE

// 3. USER CARD
const userCardSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  cardId: { type: Number, required: true },
  ascension: { type: Number, default: 0 },
  uid: { type: Number, index: true },
  fav: { type: Boolean, default: false },
  stats: {
    atk: Number,
    hp: Number,
    speed: Number,
    def: Number,
  },
  rarity: { type: Number, required: true },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  xpCap: { type: Number, default: 50 },
});

// Virtual to fetch the Image/Name from the Master Index
userCardSchema.virtual("masterData", {
  ref: "Pokes",
  localField: "cardId",
  foreignField: "pokeId",
  justOne: true,
});

//user inv
const InventorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: [
    {
      itemId: { type: String, required: true },
      amount: { type: Number, default: 0, min: 0 },
    },
  ],
});

//current special banner
const SpecificBanner = new mongoose.Schema({
  id: { type: String, default: "current_banner" },
  cardId: { type: Number, required: true },
  nextReset: { type: Date, required: true },
});

//mobs
const EnemySchema = new mongoose.Schema({
  enemyId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rarity: { type: Number, required: true },
  type: { type: String, required: true },
  level: { type: Number, required: true },
  skill: {
    name: { type: String, required: true },
    description: { type: String, required: true },
    values: { type: Number, required: true },
  },
  stats: {
    hp: { type: Number, required: true },
    atk: { type: Number, required: true },
    def: { type: Number, required: true },
    speed: { type: Number, required: true },
  },
  image: { type: String, default: "https://some-generic-monster-img.png" },
  rewards: {
    gold: { type: Number, default: 50 },
    xp: { type: Number, default: 100 },
    drops: [{ itemId: String, chance: Number }],
  },
});
//trade
const TradeSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },

  channelId: { type: String },
  messageId: { type: String },
  offers: {
    sender: {
      confirmed: { type: Boolean, default: false },
      cards: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cards" }],
      items: [{ itemId: String, amount: Number }],
      gold: { type: Number, default: 0 },
    },
    receiver: {
      confirmed: { type: Boolean, default: false },
      cards: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cards" }],
      items: [{ itemId: String, amount: Number }],
      gold: { type: Number, default: 0 },
    },
  },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});
const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  gold: { type: Number, default: 0 },
  gem: { type: Number, default: 0 },
  team: {
    type: [{ type: Number, default: null }],
    default: [null, null, null, null],
  },
  powerLevel : { type: Number, default: 0 },
  stam: { type: Number, default: 60 },
  lastStamUpdate: { type: Date, default: Date.now },
  // raidCreate: { type: Number, default: 2 },
  // lastRaidCreate : {date}
  inRaid: { type: Number, default: null },
  quests: [
    {
      questId: String,
      progress: { type: Number, default: 0 },
      claimed: { type: Boolean, default: false },
      dateAssigned: Date,
    },
  ],
  lastQuestReset: { type: Date, default: new Date(0) },
  stamCap: { type: Number, default: 60 },
  lastHourly: { type: Date, default: null },
  lastDaily: { type: Date, default: null },
  lastWeekly: { type: Date, default: null },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  pity: { type: Number, default: 0 },
  guaranteed: { type: Number, default: 0 },
  selectedCard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cards",
    default: null,
  },
  //dungeon floor
  dungeon: {
    maxArea: { type: Number, default: 1 },
    maxStage: { type: Number, default: 1 },
    currentArea: { type: Number, default: 0 },
    currentStage: { type: Number, default: 0 },
  },
});
UserSchema.methods.updateStamina = function () {
  const now = new Date();
  const REGEN_TIME_MS = 2.5 * 60 * 1000; // 2min30

  if (!this.lastStamUpdate) {
    this.lastStamUpdate = now;
  }
  if (this.stam >= this.stamCap) {
    this.lastStamUpdate = now;
    return;
  }

  const timePassed = now.getTime() - this.lastStamUpdate.getTime();

  if (timePassed >= REGEN_TIME_MS) {
    const staminaToGain = Math.floor(timePassed / REGEN_TIME_MS);

    const newStamina = Math.min(this.stamCap, this.stam + staminaToGain);

    this.stam = newStamina;

    this.lastStamUpdate = new Date(
      this.lastStamUpdate.getTime() + staminaToGain * REGEN_TIME_MS
    );

    // If we hit cap, reset the timer to now so it stops counting
    if (this.stam >= this.stamCap) {
      this.lastStamUpdate = now;
    }
  }
};
// Tell Mongoose to actually use this virtual
userCardSchema.set("toObject", { virtuals: true });
userCardSchema.set("toJSON", { virtuals: true });

const RaidSchema = new mongoose.Schema({
  raidId: { type: Number },
  maxPlayers: { type: Number, default: 5 },
  enemyId: { type: Number, required: true },
  rarity: { type: Number, default: 1 },
  level: { type: Number, default: 1 },
  stats: {
    realHp: Number, //real scale hp
    atk: Number,
    hp: Number, //multipled hp
    speed: Number,
    def: Number,
  },
  bannedUsers: { type: [String], default: [] },
  started: { type: Boolean, default: false },
  currentHp: { type: Number, required: true },
  isDefeated: { type: Boolean, default: false },
  participants: [
    {
      isLeader: { type: Boolean, default: false },
      userId: { type: String },
      username: { type: String },
      damageDealt: { type: Number, default: 0 },
      attempts: { type: Number, default: 0 },
      entriesLeft: { type: Number, default: 5 },
      lastRegen: { type: Date, default: Date.now },
      powerLevel: { type: Number, default: 0 },
      lastAttack: { type: Date }
    },
  ],
  channelId: { type: String },
  messageId: { type: String },
  rewards: {
    gold: { type: Number, default: 0 },
    gem: { type: Number, default: 0 },
    ticket: { type: Number, default: 0 },
    items: [
      {
        itemId: String,
        name: String,
        qty: Number,
      },
    ],
    cards: [
      {
        rarity: Number,
        chance: Number, // e.g. 0.5 for 50%
        qty: Number,
      },
    ],
  },
  createdAt: { type: Date, default: Date.now },
});
RaidSchema.methods.joinLobby = async function (user, userPower) {
  if (this.started) throw new Error("Raid has already started!");
  if (this.participants.length >= this.maxPlayers) throw new Error("Lobby is full (5/5)!");
  
  // 1. Check if user is banned
  if (this.bannedUsers.includes(user.id)) {
    throw new Error("🚫 You have been kicked from this raid and cannot rejoin.");
  }

  const isAlreadyIn = this.participants.some(p => p.userId === user.id);
  if (isAlreadyIn) throw new Error("You are already in this raid.");

  const isFirstJoiner = this.participants.length === 0;
  this.participants.push({
    userId: user.id,
    username: user.username,
    isLeader: isFirstJoiner,
    entriesLeft: 5,
    lastRegen: new Date(),
    powerLevel: userPower || 0
  });

  return this.save();
};

// ✅ UPDATED KICK METHOD (Add to ban list)
RaidSchema.methods.kickMember = async function (leaderId, slotInput) {
  const requestor = this.participants.find(p => p.userId === leaderId);
  if (!requestor || !requestor.isLeader) {
    throw new Error("Only the Raid Leader can kick members.");
  }
  const index = slotInput - 1; 
  if (index < 0 || index >= this.participants.length) {
    throw new Error(`Invalid slot number. Please choose between 1 and ${this.participants.length}.`);
  }
  const target = this.participants[index];
  if (target.userId === leaderId) {
    throw new Error("You cannot kick yourself. Use `!rd leave` instead.");
  }
  if (this.started) {
    // Check if idle: Entries == 5 AND lastRegen was > 15 mins ago
    const MAX_ENTRIES = 5;
    const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 Minutes
    const now = new Date();
    const timeSinceLastRegen = now - new Date(target.lastRegen);
    const isIdle = (target.entriesLeft >= MAX_ENTRIES) && (timeSinceLastRegen > IDLE_LIMIT_MS);
    if (!isIdle) {
      throw new Error("⚠️ Cannot kick active players during battle! They must be idle (5/5 entries) for **15+ minutes**.");
    }
  }

  const kickedUserId = target.userId;
  const kickedUsername = target.username;
  this.bannedUsers.push(kickedUserId);
  this.participants.splice(index, 1);
  await this.save();
  return { userId: kickedUserId, username: kickedUsername, raidId: this.raidId };
};
RaidSchema.methods.updateUserEntries = function (userId) {
  const participant = this.participants.find((p) => p.userId === userId);
  if (!participant) return null;

  const now = new Date();
  const REGEN_TIME = 5 * 60 * 1000;
  const MAX_ENTRIES = 5;

  const timePassed = now - participant.lastRegen;
  if (timePassed >= REGEN_TIME && participant.entriesLeft < MAX_ENTRIES) {
    const amount = Math.floor(timePassed / REGEN_TIME);
    participant.entriesLeft = Math.min(
      MAX_ENTRIES,
      participant.entriesLeft + amount
    );

    participant.lastRegen = new Date(now.getTime() - (timePassed % REGEN_TIME));
  }
  return participant.entriesLeft;
};
RaidSchema.methods.updateAllEntries = function () {
  const now = new Date();
  const REGEN_TIME = 5 * 60 * 1000; // 5 mins
  const MAX_ENTRIES = 5;

  let updated = false;

  this.participants.forEach((p) => {
    // 1. If they have LESS than 5 entries, try to regen
    if (p.entriesLeft < MAX_ENTRIES) {
      // Ensure lastRegen exists, fallback to now if missing
      if (!p.lastRegen) p.lastRegen = now;

      const timePassed = now - new Date(p.lastRegen);

      if (timePassed >= REGEN_TIME) {
        const amount = Math.floor(timePassed / REGEN_TIME);
        
        // Only update if there is actual change
        if (amount > 0) {
          const newEntries = Math.min(MAX_ENTRIES, p.entriesLeft + amount);
          
          // If they hit max, we set the time to NOW (start of idle)
          // Otherwise, we keep the remainder time for the next point
          if (newEntries === MAX_ENTRIES) {
             p.lastRegen = now; 
          } else {
             p.lastRegen = new Date(now.getTime() - (timePassed % REGEN_TIME));
          }

          p.entriesLeft = newEntries;
          updated = true;
        }
      }
    } 
    // 2. 🛑 IMPORTANT: If they already have 5 entries...
    else {
      // DO NOT update p.lastRegen = new Date();
      // Leaving this block empty means p.lastRegen stays as the OLD time 
      // (the time they effectively became "Idle").
    }
  });

  return updated ? this.save() : Promise.resolve(this);
};
RaidSchema.methods.leaveLobby = async function (userId) {
  const index = this.participants.findIndex(p => p.userId === userId);
  if (index === -1) return false; 
  
  const wasLeader = this.participants[index].isLeader;
  this.participants.splice(index, 1);
  
  // Pass leader role if needed
  if (wasLeader && this.participants.length > 0) {
    this.participants[0].isLeader = true;
  }
  
  // If everyone leaves, the raid effectively becomes a ghost instance until expiry
  return this.save();
};


RaidSchema.methods.startBattle = async function () {
  this.started = true;
  return this.save();
};

RaidSchema.methods.takeDamage = function (amount) {
  this.currentHp -= amount;
  if (this.currentHp <= 0) {
    this.currentHp = 0;
    this.isDefeated = true;
  }
};

// Models
const Raids = mongoose.model("Raids", RaidSchema, "raids");
const Index = mongoose.model("Pokes", IndexSchema, "pokes");
const UserContainer = mongoose.model("Users", UserSchema, "users");
const Cards = mongoose.model("Cards", userCardSchema, "cards");
const Inventory = mongoose.model("Inventory", InventorySchema, "inventory");
const SBanner = mongoose.model("SpecificBanner", SpecificBanner, "sbanner");
const Mobs = mongoose.model("Mobs", EnemySchema, "mobs");
const Trade = mongoose.model("Trade", TradeSchema, "trades");
module.exports = {
  connectDB,
  UserContainer,
  Index,
  Cards,
  Inventory,
  SBanner,
  Mobs,
  Trade,
  Raids,
};
