// index.js
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
const { getRarityStars, wrapSkillDescription, getNextUid } = require("./functions");
const { id } = require("./commands/id");
const { createAccount } = require("./commands/create");
const { start } = require("./commands/start");
const { hourly, daily, weekly } = require("./commands/hourly_daily_weekly");
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
const allCharacters = require("./characters/characters");
const { useitem } = require("./items/useItem");

const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");
const { initiateTrade } = require("./trade/tradeManager");
const { ascension } = require("./characters/ascension");

connectDB();

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
  "!weekly",
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
  "!useitem",
  "!battle",
  "!bt",
  "!sbt",
  "!skipbattle",
  "!mindex",
  "!minfo",
  "!dungeon",
  "!area",
  "!stage",
  "!resetdun",
  "!next",
  // Admin commands
  "!pokeadd",
  "!addIndex",
  "!addgold",
  "!addticket",
  "!dacc",
  "!dindex",
  "!dall",
  "!dinv",
  "!addmob",
  "!dmob",
  "!adminstam",
]);

const cooldowns = new Map();
const COOLDOWN_SECONDS = 1;
const prefix = "!";
const ADMIN_ID = "490338110572331018";

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // 1. PARSE COMMAND
  const args = message.content.trim().split(/ +/);
  const commandName = args[0].toLowerCase(); // e.g., "!create", "!cards"

  // 2. CHECK COOLDOWNS & VALIDITY
  if (message.content.startsWith(prefix)) {
    if (VALID_COMMANDS.has(commandName)) {
      const userId = message.author.id;

      if (userId !== ADMIN_ID) {
        if (cooldowns.has(userId)) {
          const expirationTime =
            cooldowns.get(userId) + COOLDOWN_SECONDS * 1000;
          const now = Date.now();

          if (now < expirationTime) {
            // const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
            return message.reply(`✋ **Calm down!** You are typing too fast.`);
          }
        }
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), COOLDOWN_SECONDS * 1000);
      }
    }
  }

  // ====================================================
  // ROUTING LOGIC (STRICT MATCHING)
  // ====================================================
  if (commandName === prefix + "trade") {
    await initiateTrade(message);
  }
  //placeholder command
  if (commandName === prefix + "addcard") {
    await ascension(message);
  }
  if (commandName === prefix + "additem") {
    await ascension(message);
  }
  if (commandName === prefix + "tradecancel") {
    await ascension(message);
  }
  if (commandName === prefix + "tradeconfirm") {
    await ascension(message);
  }

  //ascension
  if (commandName === prefix + "ascend" || commandName === prefix + "as") {
    await ascension(message);
  }

  if (commandName === prefix + "id") {
    id(message);
  }

  if (commandName === prefix + "sellcard" || commandName === prefix + "sc") {
    // id(message); // Typo in your original code? Assuming you meant sell logic here
    message.reply("Sell card not implemented yet.");
  }

  if (commandName === prefix + "start") {
    await start(message);
  }

  if (commandName === prefix + "create") {
    await createAccount(message);
  }

  if (commandName === prefix + "addxp") {
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply("Give a positive XP number.");
    }
    await giveXpAndNotify(message, amount, addXp);
  }

  if (commandName === prefix + "level") {
    const info = await getLevel(message.author.id);
    if (!info) return message.reply("You don’t exist yet. Use !create");
    message.reply(
      `Level: **${info.level}**\nXP: **${info.currentXp}/${info.nextLevelXp}**`
    );
  }

  // Economy
  if (commandName === prefix + "hourly" || commandName === prefix + "h") {
    await hourly(message);
  }
  if (commandName === prefix + "daily" || commandName === prefix + "d") {
    await daily(message);
  }
  if (commandName === prefix + "weekly") {
    await weekly(message);
  }

  // Inventory & Cards
  if (commandName === prefix + "inv") {
    await inv(message);
  }
  // ✅ STRICT CHECK: Prevents !create from triggering !cards
  if (commandName === prefix + "cards" || commandName === prefix + "c") {
    await cards(message);
  }
  if (commandName === prefix + "fav") {
    await fav(message);
  }

  // Add Card (Admin/Debug)
  if (commandName === prefix + "hackcard") {
    try {
      const cardId = parseInt(args[1]);
      let rarity = parseInt(args[2]);
      if (isNaN(rarity) || rarity < 1 || rarity > 5) rarity = 4;

      if (isNaN(cardId)) {
        return message.reply("Try giving me a real number, genius.");
      }

      const cardData = await Index.findOne({ pokeId: cardId });
      if (!cardData) {
        return message.reply("That card does not exist in the Pokédex.");
      }

      const userId = message.author.id;
      let user = await UserContainer.findOne({ userId });
      if (!user) {
        user = await UserContainer.create({ userId });
      }

      const baseStats = cardData.stats;
      const uniqueStats = {
        hp: Math.floor(
          baseStats.hp * (3 + rarity) +
            rarity * 20 +
            Math.floor(Math.random() * 20)
        ),
        atk: baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10),
        def: baseStats.def + 20 * rarity + Math.floor(Math.random() * 10),
        speed: baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5),
      };
      const  nextUid = await getNextUid(userId)
      await Cards.create({
        ownerId: userId,
        uid: nextUid,
        cardId: cardData.pokeId,
        stats: uniqueStats,
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

  if (commandName === prefix + "view") {
    await view(message);
  }

  // Currency
  if (commandName === prefix + "gold" || commandName === prefix + "g") {
    await gold(message);
  }
  if (commandName === prefix + "stam" || commandName === prefix + "st") {
    await stam(message);
  }
  if (commandName === prefix + "gem") {
    await gem(message);
  }
  if (commandName === prefix + "pity") {
    await pity(message);
  }
  if (commandName === prefix + "gua") {
    await guaranteed(message);
  }

  // Deletion
  if (commandName === prefix + "delete") {
    const targetId = args[1];
    if (!targetId)
      return message.reply("You need to provide a user ID to delete.");

    try {
      const deletedUser = await UserContainer.findOneAndDelete({
        userId: targetId,
      });
      const delInv = await Inventory.findOneAndDelete({ userId: targetId });
      if (!deletedUser) return message.reply("No user found with that ID.");
      if (!delInv) return message.reply("No inv found with that ID.");
      message.reply(`User with ID **${targetId}** has been deleted.`);
    } catch (err) {
      console.error("Delete error:", err);
      message.reply("Something went wrong while deleting.");
    }
  }

  if (commandName === prefix + "pd") {
    const targetId = args[1];
    if (!targetId)
      return message.reply("You need to provide a Pokemon ID to delete.");

    try {
      const deletedIndex = await Index.findOneAndDelete({ pokeId: targetId });
      if (!deletedIndex) return message.reply("No Pokemon found with that ID.");
      message.reply(`Pokemon with ID **${targetId}** has been deleted.`);
    } catch (err) {
      console.error("Delete error:", err);
      message.reply("Something went wrong while deleting.");
    }
  }

  // Admin Tools
  if (commandName === prefix + "addindex" && message.author.id === ADMIN_ID) {
    try {
      const charList = Object.values(allCharacters);
      let added = 0;
      let skipped = 0;
      message.reply(`🔄 Processing ${charList.length} cards...`);

      for (const char of charList) {
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
        `**Database Update Complete!**\n✅ **Added:** ${added}\n⏭️ **Skipped:** ${skipped}`
      );
    } catch (error) {
      console.error(error);
      message.reply("Error updating index: " + error.message);
    }
  }

  if (commandName === prefix + "addmob" && message.author.id === ADMIN_ID) {
    try {
      const list = mobData.mobs;
      if (!list || !Array.isArray(list))
        return message.reply("❌ Error: Could not find array.");

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
        `**Mobs Update Complete!**\n✅ **Added:** ${added}\n⏭️ **Skipped:** ${skipped}`
      );
    } catch (error) {
      console.error(error);
      message.reply("Error updating mobs: " + error.message);
    }
  }

  // Gameplay
  if (commandName === prefix + "dropcard") {
    await dropCard(message);
  }
  if (commandName === prefix + "index") {
    await indexCard(message);
  }
  if (commandName === prefix + "info") {
    await infoCard(message);
  }
  if (commandName === prefix + "profile" || commandName === prefix + "p") {
    await profile(message);
  }
  if (commandName === prefix + "select") {
    await select(message);
  }
  if (commandName === prefix + "help") {
    await help(message);
  }
  if (commandName === prefix + "battle" || commandName === prefix + "bt") {
    await startBattle(message);
  }
  if (commandName === prefix + "sbt" || commandName === prefix + "skipbattle") {
    const times = args[1] ? args[1] : 1;
    await skipBattle(message, times);
  }
  if (commandName === prefix + "gacha") {
    await banners(message);
  }
  if (commandName === prefix + "shop") {
    await shop(message);
  }
  if (commandName === prefix + "useitem") {
    await useitem(message);
  }
  if (commandName === prefix + "buy") {
    await buy(message);
  }
  if (commandName === prefix + "mindex") {
    await mobIndex(message);
  }
  if (commandName === prefix + "minfo") {
    await mobInfo(message);
  }
  if (commandName === prefix + "dungeon") {
    await dungeonHub(message);
  }
  if (commandName === prefix + "area") {
    await areaDetails(message);
  }
  if (commandName === prefix + "stage") {
    await stageDetails(message);
  }
  if (
    (commandName === prefix + "next" && args[1] === "stage") ||
    (commandName === prefix + "next" && args[1] === "st")
  ) {
    await nextStage(message);
  }

  // Admin Cheats
  if (commandName === prefix + "addgold" && message.author.id === ADMIN_ID) {
    const amount = parseInt(args[1]);
    if (isNaN(amount)) return message.reply("Please provide a valid number.");

    try {
      const user = await UserContainer.findOne({ userId: message.author.id });
      if (user) {
        user.gold += amount;
        user.gem += amount;
        await user.save();
        message.reply(`✅ Added **${amount}** gold/gem.`);
      } else {
        message.reply("Create account first.");
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (commandName === prefix + "resetdun") {
    try {
      const user = await UserContainer.findOne({ userId: message.author.id });
      if (user) {
        user.dungeon = {
          maxArea: 1,
          maxStage: 1,
          currentArea: 0,
          currentStage: 0,
        };
        await user.save();
        message.reply("🔄 Dungeon progress reset.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (commandName === prefix + "addticket" && message.author.id === ADMIN_ID) {
    try {
      const toUser = message.mentions.users.first() || message.author;
      const targetUserId = toUser.id;
      const AMOUNT = parseInt(args[2]) || 10;

      let user = await UserContainer.findOne({ userId: targetUserId });
      if (!user) user = await UserContainer.create({ userId: targetUserId });

      let inv = await Inventory.findOne({ userId: targetUserId });
      if (!inv)
        inv = await Inventory.create({ userId: targetUserId, items: [] });

      user.gold += 99999999;
      user.gem += 10000;
      const ITEMS = ["ticket", "tide", "tape", "fate", "pass", "permit"];

      ITEMS.forEach((id) => {
        const item = inv.items.find((i) => i.itemId === id);
        if (item) item.amount += AMOUNT;
        else inv.items.push({ itemId: id, amount: AMOUNT });
      });

      await user.save();
      await inv.save();
      message.reply(`✅ Added tickets & currency to ${toUser.tag}.`);
    } catch (error) {
      console.error(error);
    }
  }

  if (commandName === prefix + "dacc" && message.author.id === ADMIN_ID) {
    const res = await UserContainer.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} accounts.`);
  }
  if (commandName === prefix + "dindex" && message.author.id === ADMIN_ID) {
    const res = await Index.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} index entries.`);
  }
  if (commandName === prefix + "dall" && message.author.id === ADMIN_ID) {
    const res = await Cards.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} cards.`);
  }
  if (commandName === prefix + "dinv" && message.author.id === ADMIN_ID) {
    const res = await Inventory.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} inventories.`);
  }
  if (commandName === prefix + "dmob" && message.author.id === ADMIN_ID) {
    const res = await Mobs.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} mobs.`);
  }
  if (commandName === prefix + "adminstam" && message.author.id === ADMIN_ID) {
    const user = await UserContainer.findOne({ userId: message.author.id });
    if (user) {
      user.stam += 100;
      await user.save();
      message.reply("Stamina added.");
    }
  }
});

client.login(token).catch((error) => {
  console.error("❌ Failed to log in to Discord:", error.message);
});
