// index.js
// 1. Load environment variables first
require("dotenv").config();
const axios = require("axios");
const token = process.env.DISCORD_TOKEN;
const {
  connectDB,
  Index,
  UserContainer,
  Cards,
  Inventory,
  Mobs,
} = require("./db");
const { addXp, getLevel, giveXpAndNotify } = require("./levelSystem");
const { getRarityStars, wrapSkillDescription } = require("./functions");
const { id } = require("./commands/id");
const { createAccount } = require("./commands/create");
const { start } = require("./commands/start");
const { hourly, daily } = require("./commands/hourly_daily_weekly");
const { cards, inv, fav } = require("./commands/inv_cards");
const { view } = require("./commands/viewCard");
const { gold, pity, gem } = require("./commands/currency");
const { stam, guaranteed } = require("./commands/stam");
const { help } = require("./commands/help");
const { indexCard } = require("./commands/indexCard");
const { infoCard } = require("./commands/infoCard");
const { profile } = require("./commands/profile");
const { select } = require("./commands/select");
const { dropCard } = require("./commands/dropCard");
const { banners } = require("./Banners/banners");
const { shop } = require("./shop/shop");
const { buy } = require("./shop/buy");
const { mobInfo, mobIndex } = require("./characters/mobUtils");
const {
  dungeonHub,
  areaDetails,
  stageDetails,
  nextStage,
} = require("./dungeon/dungeon");
const { startBattle, skipBattle } = require("./combat/battleManager");
const mobData = require("./characters/mob");
connectDB();
// const { miyabi } = require("./characters/characters");
const allCharacters = require("./characters/characters");
// 3. Import necessary Discord.js classes
const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");

if (!token) {
  console.error(
    "Error: DISCORD_TOKEN not found. Did you create a .env file and define it?"
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Ready! Logged in as ${c.user.tag}`);
});
const VALID_COMMANDS = new Set([
  "!id",
  "!start",
  "!create",
  "!level",
  "!addxp",
  "!hourly",
  "!h",
  "!daily",
  "!d",
  "!inv",
  "!cards",
  "!c",
  "!addcard",
  "!view",
  "!gold",
  "!g",
  "!stam",
  "!st",
  "!gem",
  "!pity",
  "!delete",
  "!pd",
  "!dropcard",
  "!select",
  "!index",
  "!info",
  "!profile",
  "!p",
  "!help",
  "!fight",
  "!gacha",
  "!shop",
  "!buy",
  // Admin commands
  "!pokeadd",
  "!addIndex",
  "!addgold",
  "!addticket",
  "!dacc",
  "!dindex",
  "!dall",
  "!dinv",
]);
const cooldowns = new Map();
const COOLDOWN_SECONDS = 1;
const prefix = "!";

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith(prefix)) {
    const args = message.content.trim().split(/ +/);
    const commandName = args[0].toLowerCase();
    if (VALID_COMMANDS.has(commandName)) {
      const userId = message.author.id;
      const ADMIN_ID = "490338110572331018";

      if (userId !== ADMIN_ID) {
        if (cooldowns.has(userId)) {
          const expirationTime =
            cooldowns.get(userId) + COOLDOWN_SECONDS * 1000;
          const now = Date.now();

          if (now < expirationTime) {
            const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
            return message.reply(`✋ **Calm down!** You are typing too fast.`);
          }
        }
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), COOLDOWN_SECONDS * 1000);
      }
    }
  }

  // ====================================================
  // COMMANDS START HERE
  // ====================================================

  // show acc id
  if (message.content === prefix + "id") {
    id(message);
  }
  // start game
  if (message.content === prefix + "start") {
    await start(message);
  }
  // create
  if (message.content === prefix + "create") {
    await createAccount(message);
  }
  // addxp
  if (message.content.startsWith("!addxp")) {
    const args = message.content.split(" ");
    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount <= 0) {
      return message.reply("Give a positive XP number.");
    }
    // give exp
    await giveXpAndNotify(message, amount, addXp);
  }
  // level
  if (message.content === "!level") {
    const info = await getLevel(message.author.id);
    if (!info) return message.reply("You don’t exist yet. Use !create");

    message.reply(
      `Level: **${info.level}**\nXP: **${info.currentXp}/${info.nextLevelXp}**`
    );
  }
  // Hourly gold
  if (
    message.content === prefix + "hourly" ||
    message.content === prefix + "h"
  ) {
    await hourly(message);
  }
  // daiky
  if (
    message.content === prefix + "daily" ||
    message.content === prefix + "d"
  ) {
    await daily(message);
  }
  // inv & cards
  if (message.content === prefix + "inv") {
    await inv(message);
  }
  if (
    message.content === prefix + "cards" ||
    message.content === prefix + "c"
  ) {
    await cards(message);
  }
  if (message.content.startsWith(prefix + "fav")) {
    await fav(message);
  }

  // add card to inv
if (message.content.startsWith(prefix + "addcard")) {
    try {
      const args = message.content.split(" ");
      const cardId = parseInt(args[1]);
      
      // ✅ Optional: Allow setting rarity (Default to 4 if not typed)
      // Usage: !addcard <id> <rarity>
      let rarity = parseInt(args[2]);
      if (isNaN(rarity) || rarity < 1 || rarity > 5) rarity = 4;

      if (isNaN(cardId)) {
        return message.reply("Try giving me a real number, genius.");
      }

      // 1. Fetch global card from Index
      const cardData = await Index.findOne({ pokeId: cardId });
      if (!cardData) {
        return message.reply("That card does not exist in the Pokédex.");
      }

      const userId = message.author.id;

      // 2. Ensure User Exists (Create if not)
      let user = await UserContainer.findOne({ userId });
      if (!user) {
        user = await UserContainer.create({ userId });
      }

      // 3. ✅ CALCULATE STATS (Matches pullSystem.js logic)
      const baseStats = cardData.stats;
      const uniqueStats = {
        // 🩸 HP: Base * (3 + Rarity) + Flat Variance
        // 5-Star (Base 75): ~600 HP
        hp: Math.floor(
          baseStats.hp * (3 + rarity) + rarity * 20 + Math.floor(Math.random() * 20)
        ),

        // ⚔️ ATK: Base + 25*R
        atk: baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10),

        // 🛡️ DEF: Base + 20*R
        def: baseStats.def + 20 * rarity + Math.floor(Math.random() * 10),

        // 💨 SPEED: Base + 7*R
        speed: baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5),
      };

      await Cards.create({
        ownerId: userId, // Who owns it
        cardId: cardData.pokeId, // Link to Index
        stats: uniqueStats, // The RNG stats
        rarity: rarity,
        level: 1,
        xp: 0,
      });

      const embed = new EmbedBuilder()
        .setColor(cardData.cardColor || "#FFFFFF")
        .setTitle(`🎴 Obtained ${cardData.name}!`)
        .setDescription(
          `**Rarity:** ${rarity} ⭐\n` +
          `**HP:** ${uniqueStats.hp} | **ATK:** ${uniqueStats.atk} | **DEF:** ${uniqueStats.def} | **SPD:** ${uniqueStats.speed}`
        )
        .setThumbnail(cardData.image);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply("Something exploded inside the code again.");
    }
  }

  // view card inv
  if (message.content.startsWith(prefix + "view")) {
    const args = message.content.trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === prefix + "view") {
      await view(message);
    }
  }
  //show gold
  if (message.content === prefix + "gold" || message.content === prefix + "g") {
    await gold(message);
  }
  //show stam
  if (
    message.content === prefix + "stam" ||
    message.content === prefix + "st"
  ) {
    await stam(message);
  }

  if (message.content === prefix + "gua") {
    await guaranteed(message);
  }
  // delete
  if (message.content.startsWith(prefix + "delete")) {
    const args = message.content.split(" ");
    const targetId = args[1];

    if (!targetId) {
      return message.reply("You need to provide a user ID to delete.");
    }

    try {
      const deletedUser = await UserContainer.findOneAndDelete({
        userId: targetId,
      });

      if (!deletedUser) {
        return message.reply("No user found with that ID.");
      }

      message.reply(`User with ID **${targetId}** has been deleted.`);
    } catch (err) {
      console.error("Delete error:", err);
      message.reply("Something went wrong while deleting.");
    }
  }
  // delete card
  if (message.content.startsWith(prefix + "pd")) {
    const args = message.content.split(" ");
    const targetId = args[1];

    if (!targetId) {
      return message.reply("You need to provide a user ID to delete.");
    }

    try {
      const deletedUser = await Index.findOneAndDelete({
        pokeId: targetId,
      });

      if (!deletedUser) {
        return message.reply("No Pokemon found with that ID.");
      }

      message.reply(`Pokemon with ID **${targetId}** has been deleted.`);
    } catch (err) {
      console.error("Delete error:", err);
      message.reply("Something went wrong while deleting.");
    }
  }
  // add all to index
  if (
    message.content === prefix + "addindex" &&
    message.author.id === "490338110572331018"
  ) {
    try {
      // Convert the exported object into a list of characters
      const charList = Object.values(allCharacters);

      let added = 0;
      let skipped = 0;

      message.reply(`🔄 Processing ${charList.length} cards...`);

      for (const char of charList) {
        // Check if this specific char is already in DB
        const exists = await Index.findOne({ name: char.name });

        if (exists) {
          skipped++;
        } else {
          char.skill.description = wrapSkillDescription(char.skill.description);
          await Index.create(char);
          added++;
        }
      }

      message.reply(
        `**Database Update Complete!**\n` +
          `✅ **Added:** ${added} new cards\n` +
          `⏭️ **Skipped:** ${skipped} (Already existed)`
      );
    } catch (error) {
      console.error(error);
      message.reply("Error updating index: " + error.message);
    }
  }
  //add mobs
  if (
    message.content === prefix + "addmob" &&
    message.author.id === "490338110572331018"
  ) {
    try {
      const list = mobData.mobs;

      if (!list || !Array.isArray(list)) {
        return message.reply(
          "❌ Error: Could not find an array in `./characters/mob.js`."
        );
      }
      let added = 0;
      let skipped = 0;
      message.reply(`🔄 Processing ${list.length} enemies...`);

      for (const mob of list) {
        const exists = await Mobs.findOne({ enemyId: mob.enemyId });

        if (exists) {
          skipped++;
        } else {
          await Mobs.create(mob);
          added++;
        }
      }

      message.reply(
        `**Mobs Update Complete!**\n` +
          `✅ **Added:** ${added} new mobs\n` +
          `⏭️ **Skipped:** ${skipped} (Already existed)`
      );
    } catch (error) {
      console.error(error);
      message.reply("Error updating mobs: " + error.message);
    }
  }

  // drop card
  if (message.content === prefix + "dropcard") {
    await dropCard(message);
  }

  // view index
if (message.content.startsWith(prefix + "index")) {
    await indexCard(message);
}

  // info card global
  if (message.content.startsWith(prefix + "info")) {
    await infoCard(message);
  }

  if (
    message.content.startsWith(prefix + "profile") ||
    message.content.startsWith(prefix + "p")
  ) {
    const args = message.content.trim().split(/ +/);
    const cmd = args[0].toLowerCase();
    if (cmd === prefix + "profile" || cmd === prefix + "p") {
      await profile(message);
    }
  }
  if (message.content.startsWith(prefix + "select")) {
    await select(message);
  }
  // HELP
  if (message.content === prefix + "help") {
    await help(message);
  }
  if (message.content === prefix + "battle" || message.content === prefix + "bt") {
    // No arguments needed for standard battle now
    await startBattle(message);
  }

  // SKIP BATTLE COMMAND (!sbt or !skipbattle)
 if (message.content.startsWith(prefix + "sbt") || message.content.startsWith(prefix + "skipbattle")) {
    const args = message.content.split(" ");
    const times = args[1] ? args[1] : 1; 

    await skipBattle(message, times);
}
  // add gold to demo gacha
  if (message.content.startsWith(prefix + "addgold")) {
    if (message.author.id !== "490338110572331018") {
      return message.reply("Nice try. You aren't the admin.");
    }
    const args = message.content.split(" ");
    const amount = parseInt(args[1]); // Grab index 1 ("500")
    if (isNaN(amount)) {
      return message.reply(
        "Please provide a valid number (e.g., `!addgold 100`)."
      );
    }

    try {
      const userId = message.author.id;
      let user = await UserContainer.findOne({ userId });
      if (user) {
        user.gold += amount;
        user.gem += amount;
        await user.save();
        message.reply(
          `✅ Success! Added **${amount}** gold and gem. New Balance: **${user.gold}**`
        );
      } else {
        message.reply("You don't have an account! Type `!create` first.");
      }
    } catch (error) {
      console.error(error);
      message.reply("Error adding gold.");
    }
  }
  // display pity
  if (message.content === prefix + "pity") {
    await pity(message);
  }
  // display gem
  if (message.content === prefix + "gem") {
    await gem(message);
  }
  if (message.content === prefix + "gacha") {
    await banners(message);
  }
  //shop
  if (message.content === prefix + "shop") {
    await shop(message);
  }

  //buy
  if (message.content.startsWith(prefix + "buy")) {
    await buy(message);
  }
  //mobs
  if (message.content === prefix + "mindex") {
    await mobIndex(message);
  }
  if (message.content.startsWith(prefix + "minfo")) {
    await mobInfo(message);
  }
  //dungeon
  if (message.content === prefix + "dungeon") {
    await dungeonHub(message);
  }

  if (message.content.startsWith(prefix + "area")) {
    await areaDetails(message);
  }

  if (message.content.startsWith(prefix + "stage")) {
    await stageDetails(message);
  }
  //dungeon reeset
  if (message.content === prefix + "resetdun") {
    // Optional: Add admin check here
    // if (message.author.id !== "YOUR_ADMIN_ID") return;
    try {
      const user = await UserContainer.findOne({ userId: message.author.id });
      if (!user) return message.reply("User not found.");

      user.dungeon = {
        maxArea: 1,
        maxStage: 1,
        currentArea: 0,
        currentStage: 0,
      };

      await user.save();
      message.reply("🔄 **Dungeon progress has been reset to default.**");
    } catch (err) {
      console.error(err);
      message.reply("Error resetting dungeon.");
    }
  }
  if (
    message.content === prefix + "next stage" ||
    message.content === prefix + "next st"
  ) {
    await nextStage(message);
  }
  // add ticket admin
  if (message.content.startsWith("!addticket")) {
    if (message.author.id !== "490338110572331018") {
      return message.reply("Nice try diddy. Admin only.");
    }

    try {
      const toUser = message.mentions.users.first();
      const args = message.content.split(" ");
      const targetUserId = toUser.id;
      const AMOUNT = parseInt(args[2]) || 10;
      const user = await UserContainer.findOne({ userId: targetUserId });
      if (!user) {
        await UserContainer.create({
          userId: targetUserId,
          gold: 5000,
          gem: 0,
          stam: 70,
          stamCap: 70,
          level: 1,
          xp: 0,
          pity: 0,
          lastHourly: null,
          selectedCard: null,
        });
      }

      let inv = await Inventory.findOne({ userId: targetUserId });
      if (!inv) {
        inv = await Inventory.create({ userId: targetUserId, items: [] });
      }

      const ITEMS_TO_ADD = ["ticket", "tide", "tape", "fate", "pass", "permit"];

      ITEMS_TO_ADD.forEach((targetItemId) => {
        const itemIndex = inv.items.findIndex((i) => i.itemId === targetItemId);

        if (itemIndex > -1) {
          inv.items[itemIndex].amount += AMOUNT;
        } else {
          inv.items.push({ itemId: targetItemId, amount: AMOUNT });
        }
      });

      await inv.save();

      const targetName = args[1] ? `User \`${targetUserId}\`` : "your account";
      message.reply(
        `✅ **Success!** Added ${AMOUNT}x Tickets, Tides, and Tapes to ${targetName}.`
      );
    } catch (error) {
      console.error(error);
      message.reply("Something went wrong adding tickets.");
    }
  }
  // del all accounts
  if (message.content === "!dacc") {
    if (message.author.id !== "490338110572331018") {
      return message.reply("Only the bot owner can wipe the database.");
    }

    try {
      const result = await UserContainer.deleteMany({});

      message.reply(
        `Success. Deleted ${result.deletedCount} accounts from the database.`
      );
    } catch (err) {
      console.error(err);
      message.reply("Failed to delete accounts. Check the console for errors.");
    }
  }
  // del index
  if (message.content === "!dindex") {
    if (message.author.id !== "490338110572331018") {
      return message.reply("Only the bot owner can wipe the database.");
    }

    try {
      const result = await Index.deleteMany({});

      message.reply(
        `Success. Deleted ${result.deletedCount} index cards from the database.`
      );
    } catch (err) {
      console.error(err);
      message.reply(
        "Failed to delete index cards. Check the console for errors."
      );
    }
  }
  // del all cards
  if (message.content === "!dall") {
    if (message.author.id !== "490338110572331018") {
      return message.reply("Only the bot owner can wipe the database.");
    }

    try {
      const result = await Cards.deleteMany({});

      message.reply(
        `Success. Deleted ${result.deletedCount} cards from the database.`
      );
    } catch (err) {
      console.error(err);
      message.reply("Failed to delete cards. Check the console for errors.");
    }
  }
  // del all inv
  if (message.content === "!dinv") {
    if (message.author.id !== "490338110572331018") {
      return message.reply("Only the bot owner can wipe the database.");
    }

    try {
      const result = await Inventory.deleteMany({});

      message.reply(
        `Success. Deleted ${result.deletedCount} invs from the database.`
      );
    } catch (err) {
      console.error(err);
      message.reply("Failed to delete inv. Check the console for errors.");
    }
  }
  //del mobs
  if (message.content === "!dmob") {
    if (message.author.id !== "490338110572331018") {
      return message.reply("Only the bot owner can wipe the database.");
    }

    try {
      const result = await Mobs.deleteMany({});

      message.reply(
        `Success. Deleted ${result.deletedCount} mobs from the database.`
      );
    } catch (err) {
      console.error(err);
      message.reply("Failed to delete mobs. Check the console for errors.");
    }
  }
  if (message.content === prefix + "adminstam") {
    const id = message.author.id;
    const user = await UserContainer.findOne({ userId : id });
    if (user) {
      user.stam += 100;
      user.save();
            message.reply(`done`)
    } else {
      message.reply(`error`)
    }
  }
});

client.login(token).catch((error) => {
  console.error("❌ Failed to log in to Discord: !!", error.message);
});
