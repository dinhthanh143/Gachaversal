// index.js
require("dotenv").config();
const token = process.env.DISCORD_TOKEN;
const {
  connectDB,
  Index,
  UserContainer,
  Cards,
  Inventory,
  Mobs,
  Raids,
} = require("./db");
const { addXp, getLevel, giveXpAndNotify } = require("./levelSystem");
const { wrapSkillDescription, getNextUid } = require("./functions");
const { id } = require("./commands/id");
const { createAccount } = require("./commands/create");
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
const { startRaidSweeper } = require("./utils/raidSweeper");
const {
  dungeonHub,
  areaDetails,
  stageDetails,
  nextStage,
} = require("./dungeon/dungeon");
const { startBattle, skipBattle } = require("./combat/battleManager");
const allCharacters = require("./characters/characters");
const { useitem } = require("./items/useItem");

const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");
const {
  initiateTrade,
  cancelTrade,
  confirmTrade,
  addCardToTrade,
  addItemToTrade,
  addGoldToTrade,
  resetTradeOffer,
} = require("./trade/tradeManager");
const { ascension } = require("./characters/ascension");
const { sellCard } = require("./commands/sellCard");
const { questEmbed } = require("./quest/questEmbed");
const { team } = require("./raid/playerTeam");
const { teamset, teamremove, teamReset } = require("./raid/selectTeam");
const { createRaid } = require("./raid/createRaid");
const { createMegaCard } = require("./raid/raidManager");
const {
  raidLobby,
  joinRaid,
  leaveRaid,
  kickPlayer,
  raidStart,
  raidEntries,
} = require("./raid/raidLobby");
const { startRaidBattle } = require("./raid/raidBattle");

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

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Ready! Logged in as ${c.user.tag}`);
  await connectDB();
  startRaidSweeper(client);
});

const VALID_COMMANDS = new Set([
  "!id",
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
  "!gua", 
  "!hackcard",

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

// ✅ ADMIN CONFIGURATION
const ADMIN_IDS = ["490338110572331018", "739760362567630959"];
const isAdmin = (id) => ADMIN_IDS.includes(id);

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // 1. PARSE COMMAND
  const args = message.content.trim().split(/ +/);
  const commandName = args[0].toLowerCase(); 

  // 2. CHECK COOLDOWNS & VALIDITY
  if (message.content.startsWith(prefix)) {
    if (VALID_COMMANDS.has(commandName)) {
      const userId = message.author.id;

      // ====================================================
      // GLOBAL ACCOUNT CHECK
      // ====================================================
      if (commandName !== prefix + "create" && commandName !== prefix + "help") {
        const userExists = await UserContainer.exists({ userId });
        if (!userExists) {
          return message.reply(
            "⚠️ You don't have a profile yet. Use `!create` first."
          );
        }
      }

      if (!isAdmin(userId)) {
        if (cooldowns.has(userId)) {
          const expirationTime =
            cooldowns.get(userId) + COOLDOWN_SECONDS * 1000;
          const now = Date.now();

          if (now < expirationTime) {
            return message.reply(`✋ **Calm down!** You are typing too fast.`);
          }
        }
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), COOLDOWN_SECONDS * 1000);
      }
      
      // Global stamina update
      try {
        const user = await UserContainer.findOne({ userId });
        if (user) {
          user.updateStamina();
          await user.save();
        }
      } catch (err) {
        console.error("Global Stamina Update Error:", err);
      }
    }
  }

  // ====================================================
  // ROUTING LOGIC (STRICT MATCHING)
  // ====================================================
  
  if (commandName === prefix + "raid" || commandName === prefix + "rd") {
    const subCommand = args[1] ? args[1].toLowerCase() : "";

    if (subCommand === "lobby") {
      await raidLobby(message);
    } else if (subCommand === "join") {
      await joinRaid(message);
    } else if (subCommand === "leave") {
      await leaveRaid(message);
    } else if (subCommand === "kick") {
      await kickPlayer(message);
    } else if (subCommand === "start") {
      await raidStart(message);
    } else if (subCommand === "entry" || subCommand === "e") {
      await raidEntries(message);
    } else if (subCommand === "battle" || subCommand === "bt") {
      await startRaidBattle(message);
    } else {
      message.reply(
        "⚠️ Invalid Raid Command.\nUsage: `!raid join [id]`, `!raid lobby`, `!raid leave`"
      );
    }
  }
  if (commandName === prefix + "teamstat") {
    await createMegaCard(message);
  }
  if (commandName === prefix + "team") {
    await team(message);
  }
  if (commandName === prefix + "resetteam" || commandName === prefix + "rt") {
    await teamReset(message);
  }
  if (commandName === prefix + "teamset" || commandName === prefix + "ts") {
    await teamset(message);
  }
  if (commandName === prefix + "teamremove" || commandName === prefix + "tr") {
    await teamremove(message);
  }
  if (commandName === prefix + "createraid" || commandName === prefix + "cr") {
    await createRaid(message);
  }

  // Quest & Trade
  if (commandName === prefix + "quest") {
    await questEmbed(message);
  }
  if (commandName === prefix + "trade") {
    await initiateTrade(message);
  }
  if (commandName === prefix + "addcard" || commandName === prefix + "ac") {
    await addCardToTrade(message);
  }
  if (commandName === prefix + "additem" || commandName === prefix + "ai") {
    await addItemToTrade(message);
  }
  if (commandName === prefix + "addgold" || commandName === prefix + "ag") {
    await addGoldToTrade(message);
  }
  if (
    commandName === prefix + "tradereset" ||
    commandName === prefix + "reset"
  ) {
    await resetTradeOffer(message);
  }
  if (
    commandName === prefix + "tradecancel" ||
    commandName === prefix + "cancel"
  ) {
    await cancelTrade(message);
  }
  if (
    commandName === prefix + "tradeconfirm" ||
    commandName === prefix + "confirm"
  ) {
    await confirmTrade(message);
  }

  // Ascension & ID
  if (commandName === prefix + "ascend" || commandName === prefix + "as") {
    await ascension(message);
  }

  if (commandName === prefix + "id") {
    id(message);
  }

  if (commandName === prefix + "sellcard" || commandName === prefix + "sc") {
    message.reply("Sell card not implemented yet.");
  }

  if (commandName === prefix + "create") {
    await createAccount(message);
  }

  // ✅ ADDXP (Admin Only)
  if (commandName === prefix + "addxp") {
    if (!isAdmin(message.author.id)) return; 
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
  if (commandName === prefix + "cards" || commandName === prefix + "c") {
    await cards(message);
  }
  if (commandName === prefix + "fav") {
    await fav(message);
  }

  if (commandName === prefix + "sell") {
    await sellCard(message);
  }

  // ✅ HACKCARD (Admin Only)
  if (commandName === prefix + "hackcard") {
    if (!isAdmin(message.author.id)) return;

    try {
      const cardId = parseInt(args[1]);
      let rarity = parseInt(args[2]);
      if (isNaN(rarity) || rarity < 1 || rarity > 6) rarity = 4;

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
          baseStats.hp * (1.4 + rarity) +
            rarity * 5 +
            Math.floor(Math.random() * 20)
        ),
        atk: baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10),
        def: baseStats.def + 20 * rarity + Math.floor(Math.random() * 10),
        speed: baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5),
      };
      const nextUid = await getNextUid(userId);
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
  
  // ✅ GUARANTEED (Admin Only)
  if (commandName === prefix + "gua") {
    if (!isAdmin(message.author.id)) return;
    await guaranteed(message);
  }

  // ✅ DELETE ACCOUNT (Admin Only)
  if (commandName === prefix + "delete") {
    if (!isAdmin(message.author.id)) return;

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

  // ✅ DELETE POKEMON DATA (Admin Only)
  if (commandName === prefix + "pd") {
    if (!isAdmin(message.author.id)) return;

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
  if (commandName === prefix + "addindex" && isAdmin(message.author.id)) {
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

  if (commandName === prefix + "addmob" && isAdmin(message.author.id)) {
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
  if (commandName === prefix + "addgold" && isAdmin(message.author.id)) {
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

  // ✅ RESET DUNGEON (Admin Only)
  if (commandName === prefix + "resetdun") {
    if (!isAdmin(message.author.id)) return;

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

  if (commandName === prefix + "addticket" && isAdmin(message.author.id)) {
    try {
      const toUser = message.mentions.users.first() || message.author;
      const targetUserId = toUser.id;
      const AMOUNT = parseInt(args[2]) || 10;

      let user = await UserContainer.findOne({ userId: targetUserId });
      if (!user) user = await UserContainer.create({ userId: targetUserId });

      let inv = await Inventory.findOne({ userId: targetUserId });
      if (!inv)
        inv = await Inventory.create({ userId: targetUserId, items: [] });

      user.gold += 999999999999999999999;
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

  if (commandName === prefix + "dacc" && isAdmin(message.author.id)) {
    const res = await UserContainer.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} accounts.`);
  }
  if (commandName === prefix + "draid" && isAdmin(message.author.id)) {
    const res = await Raids.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} raids.`);
  }
  if (commandName === prefix + "dindex" && isAdmin(message.author.id)) {
    const res = await Index.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} index entries.`);
  }
  if (commandName === prefix + "dall" && isAdmin(message.author.id)) {
    const res = await Cards.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} cards.`);
  }
  if (commandName === prefix + "dinv" && isAdmin(message.author.id)) {
    const res = await Inventory.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} inventories.`);
  }
  if (commandName === prefix + "dmob" && isAdmin(message.author.id)) {
    const res = await Mobs.deleteMany({});
    message.reply(`Deleted ${res.deletedCount} mobs.`);
  }
  if (commandName === prefix + "adminstam" && isAdmin(message.author.id)) {
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