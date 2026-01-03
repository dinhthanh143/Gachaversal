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
const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  gold: { type: Number, default: 0 },
  gem: { type: Number, default: 0 },
  stam: { type: Number, default: 60 },
  stamCap: { type: Number, default: 60 },
  lastHourly: { type: Date, default: null },
  lastDaily: { type: Date, default: null },
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

// 3. USER CARD
const userCardSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  cardId: { type: Number, required: true }, // Links to pokeId in Index
  fav: {type: Boolean , default : false},
  stats: {
    atk: Number,
    hp: Number,
    speed: Number,
    def: Number,
  },
  rarity: { type: Number, required: true },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  xpCap: { type: Number, default: 50 }
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

// Tell Mongoose to actually use this virtual
userCardSchema.set("toObject", { virtuals: true });
userCardSchema.set("toJSON", { virtuals: true });

// Models
const Index = mongoose.model("Pokes", IndexSchema, "pokes");
const UserContainer = mongoose.model("Users", UserSchema, "users");
const Cards = mongoose.model("Cards", userCardSchema, "cards");
const Inventory = mongoose.model("Inventory", InventorySchema, "inventory");
const SBanner = mongoose.model("SpecificBanner", SpecificBanner, "sbanner");
const Mobs = mongoose.model("Mobs", EnemySchema, "mobs");

module.exports = {
  connectDB,
  UserContainer,
  Index,
  Cards,
  Inventory,
  SBanner,
  Mobs,
};
