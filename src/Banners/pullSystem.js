const { Index, UserContainer, Cards, Inventory, SBanner } = require("../db");
const {
  generateTenPullImage,
  generateSinglePullImage,
} = require("./canvasUtils");
const {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const RATES = { 5: 0.025, 4: 0.155, 3: 0.82 };
const PITY_HARD_CAP = 60;
const LOADING_IMAGE =
  "https://res.cloudinary.com/pachi/image/upload/v1766588382/loadingGif1-ezgif.com-crop_qniwcq.gif";

// UPDATED CURRENCY MAPPING
const BANNER_CURRENCY = {
  STANDARD: "ticket",
  WUWA: "tide",
  ZZZ: "tape",
  FEATURED: "ticket",
  GENSHIN: "fate",
  HSR: "pass",
  ARKNIGHTS: "permit",
};

// UPDATED NAME MAPPING (Maps Internal ID to DB Franchise Name)
const BANNER_NAMES = {
  STANDARD: "Standard Banner",
  WUWA: "Wuthering Waves",
  ZZZ: "Zenless Zone Zero",
  FEATURED: "Featured Banner",
  GENSHIN: "Genshin Impact",
  HSR: "Honkai Star Rail",
  ARKNIGHTS: "Arknights",
};

function determineRarity(currentPity) {
  if (currentPity >= PITY_HARD_CAP - 1) return 5;
  const rng = Math.random();
  if (rng < RATES[5]) return 5;
  if (rng < RATES[5] + RATES[4]) return 4;
  return 3;
}

function calculateStats(baseStats, rarity) {
  if (!baseStats) baseStats = { hp: 75, atk: 60, def: 50, speed: 69 };

  return {
   // 🩸 HP Rebalanced: Base * (3 + Rarity)
    // 3-Star (Base 75): 75 * 6 = 450 HP
    // 5-Star (Base 75): 75 * 8 = 600 HP
   hp: Math.floor(
      baseStats.hp * (3 + rarity) + rarity * 20 + Math.floor(Math.random() * 20)
    ),

    atk: baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10),
    def: baseStats.def + 20 * rarity + Math.floor(Math.random() * 10),
    speed: baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5),
  };
}

// --- SHARED HELPER (Used by Standard/WuWa/ZZZ/Genshin/HSR/Arknights) ---
async function performPullLogic(userId, bannerType, user) {
  let currentPity = user.pity || 0;
  const rarity = determineRarity(currentPity);

  if (rarity === 5) currentPity = 0;
  else currentPity++;

  let dbFilter = {};
  if (bannerType !== "STANDARD" && bannerType !== "FEATURED") {
    dbFilter.franchise = BANNER_NAMES[bannerType];
  }

  // STANDARD LOGIC: Grab RANDOM card (No rarity filter)
  const randomCardAgg = await Index.aggregate([
    { $match: dbFilter },
    { $sample: { size: 1 } },
  ]);

  let resultCard = null;
  let dbEntry = null;

  if (randomCardAgg.length > 0) {
    const cardData = randomCardAgg[0];
    const uniqueStats = calculateStats(cardData.stats, rarity);

    resultCard = {
      name: cardData.name,
      rarity: rarity,
      image: cardData.image,
      stats: uniqueStats,
    };
    dbEntry = {
      ownerId: userId,
      cardId: cardData.pokeId,
      stats: uniqueStats,
      rarity: rarity,
      level: 1,
      xp: 0,
    };
  } else {
    resultCard = { name: "Error", rarity: 1, image: null };
  }

  return { resultCard, dbEntry, newPity: currentPity };
}

// ==========================================
// 1. STANDARD/WUWA/ZZZ + NEW BANNERS PULLS
// ==========================================
async function executeSinglePull(interaction, bannerType, ticketType) {
  const userId = interaction.user.id;
  const currencyId = BANNER_CURRENCY[bannerType];

  const loading = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(`✨ Summoning x1...`)
    .setImage(LOADING_IMAGE);
  await interaction.editReply({
    content: null,
    embeds: [loading],
    components: [],
    files: [],
  });

  let user = await UserContainer.findOne({ userId });
  if (!user) user = await UserContainer.create({ userId, pity: 0 });
  let inv = await Inventory.findOne({ userId });
  if (!inv) inv = await Inventory.create({ userId, items: [] });
  const item = inv.items.find((i) => i.itemId === currencyId);

  if (!item || item.amount < 1)
    return interaction.editReply({
      content: `❌ **Insufficient Funds!**`,
      embeds: [],
    });

  item.amount -= 1;
  await inv.save();

  const { resultCard, dbEntry, newPity } = await performPullLogic(
    userId,
    bannerType,
    user
  );
  user.pity = newPity;
  await user.save();
  if (dbEntry) await Cards.create(dbEntry);

  try {
    const img = await generateSinglePullImage(resultCard);
    const file = new AttachmentBuilder(img, { name: "res.png" });
    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle(`✨ Result (${BANNER_NAMES[bannerType]}) ✨`)
      .setImage("attachment://res.png")
      .setFooter({ text: `Pity: ${user.pity}/60` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pull_1_${bannerType.toLowerCase()}`)
        .setLabel("Pull x1")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pull_10_${bannerType.toLowerCase()}`)
        .setLabel("Pull x10")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("back_menu")
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({
      content: null,
      embeds: [embed],
      files: [file],
      components: [row],
    });
  } catch (e) {
    console.error(e);
  }
}

async function executeTenPull(interaction, bannerType, ticketType) {
  const userId = interaction.user.id;
  const currencyId = BANNER_CURRENCY[bannerType];

  const loading = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(`✨ Summoning x10...`)
    .setImage(LOADING_IMAGE);
  await interaction.editReply({
    content: null,
    embeds: [loading],
    components: [],
    files: [],
  });

  let user = await UserContainer.findOne({ userId });
  if (!user) user = await UserContainer.create({ userId, pity: 0 });
  let inv = await Inventory.findOne({ userId });
  if (!inv) inv = await Inventory.create({ userId, items: [] });
  const item = inv.items.find((i) => i.itemId === currencyId);

  if (!item || item.amount < 10)
    return interaction.editReply({
      content: `❌ **Insufficient Funds!**`,
      embeds: [],
    });

  item.amount -= 10;
  await inv.save();

  const pulls = [];
  const saves = [];
  for (let i = 0; i < 10; i++) {
    const res = await performPullLogic(userId, bannerType, user);
    user.pity = res.newPity;
    pulls.push(res.resultCard);
    if (res.dbEntry) saves.push(res.dbEntry);
  }
  await user.save();
  if (saves.length > 0) await Cards.insertMany(saves);

  try {
    const img = await generateTenPullImage(pulls);
    const file = new AttachmentBuilder(img, { name: "res.png" });
    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle(`✨ 10x Results (${BANNER_NAMES[bannerType]}) ✨`)
      .setImage("attachment://res.png")
      .setFooter({ text: `Pity: ${user.pity}/60` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pull_1_${bannerType.toLowerCase()}`)
        .setLabel("Pull x1")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pull_10_${bannerType.toLowerCase()}`)
        .setLabel("Pull x10")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("back_menu")
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({
      content: null,
      embeds: [embed],
      files: [file],
      components: [row],
    });
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// 2. FEATURED BANNER LOGIC (FIXED)
// ==========================================
async function executeSpecificPull(interaction, bannerType, icon, amount = 1) {
  const userId = interaction.user.id;
  const currencyId = "ticket"; // Ensure this matches your DB item ID

  // 1. Loading Embed
  const loadingEmbed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle(`✨ Summoning x${amount} on Featured...`)
    .setImage(LOADING_IMAGE);
  await interaction.editReply({
    content: null,
    embeds: [loadingEmbed],
    components: [],
    files: [],
  });

  // 2. Get Featured ID
  const bannerState = await SBanner.findOne({ id: "current_banner" });
  if (!bannerState)
    return interaction.editReply({
      content: "⚠️ Featured Banner inactive.",
      embeds: [],
    });
  const featuredId = Number(bannerState.cardId);

  // 3. User & Inventory Setup
  let user = await UserContainer.findOne({ userId });
  if (!user)
    user = await UserContainer.create({ userId, pity: 0, guaranteed: 0 });

  // 🛡️ SAFETY FIX: Handle existing users who don't have the field yet
  if (user.guaranteed === undefined || user.guaranteed === null) {
    console.log(`[DEBUG] Initializing guaranteed field for ${userId}`);
    user.guaranteed = 0;
    await user.save();
  }

  let inv = await Inventory.findOne({ userId });
  if (!inv) inv = await Inventory.create({ userId, items: [] });
  const item = inv.items.find((i) => i.itemId === currencyId);

  if (!item || item.amount < amount) {
    return interaction.editReply({
      content: `❌ **Insufficient Funds!**`,
      embeds: [],
    });
  }

  item.amount -= amount;
  await inv.save();

  const pulls = [];
  const saves = [];

  for (let i = 0; i < amount; i++) {
    // Increment Pity
    let currentPity = user.pity || 0;
    const rarity = determineRarity(currentPity);

    if (rarity === 5) user.pity = 0;
    else user.pity++;

    let cardData = null;

    if (rarity === 5) {
      // ====================================================
      // ⭐ 50/50 LOGIC
      // ====================================================
      const isGuaranteed = user.guaranteed === 1;
      const won5050 = Math.random() < 0.5;

      console.log(
        `[5★ PULL] User: ${user.userId} | Guaranteed? ${isGuaranteed} | Won 50/50? ${won5050}`
      );

      if (isGuaranteed || won5050) {
        // 🎉 WIN: Featured Character
        console.log(`--> Result: WIN (Featured)`);
        cardData = await Index.findOne({ pokeId: featuredId });

        // Reset Guarantee
        user.guaranteed = 0;
      } else {
        // 💀 LOSE: Standard Character Logic
        console.log(`--> Result: LOSS (Standard Logic)`);

        // FIX: Removed { rarity: 5 } filter.
        // We now look for ANY card that is NOT the featured ID.
        const lost5050Agg = await Index.aggregate([
          { $match: { pokeId: { $ne: featuredId } } },
          { $sample: { size: 1 } },
        ]);

        if (lost5050Agg.length > 0) {
          cardData = lost5050Agg[0];
        } else {
          console.log(
            `--> [WARNING] No other cards found in DB. Forcing Featured.`
          );
          cardData = await Index.findOne({ pokeId: featuredId });
        }

        // SET GUARANTEE FOR NEXT TIME
        user.guaranteed = 1;
      }

      // Fallback if findOne failed somehow
      if (!cardData) cardData = await Index.findOne({ pokeId: featuredId });
    } else {
      // Standard 3/4 Star (Random pool)
      const randomAgg = await Index.aggregate([{ $sample: { size: 1 } }]);
      if (randomAgg.length > 0) cardData = randomAgg[0];
    }

    if (!cardData)
      return interaction.editReply({
        content: "DB Error: No cards found.",
        embeds: [],
      });

    // Calculate stats based on the determined Rarity (this upgrades standard cards to 5-star stats)
    const uniqueStats = calculateStats(cardData.stats, rarity);

    // Add to lists
    pulls.push({
      name: cardData.name,
      rarity: rarity,
      image: cardData.image,
      stats: uniqueStats,
    });
    saves.push({
      ownerId: userId,
      cardId: cardData.pokeId,
      stats: uniqueStats,
      rarity: rarity,
      level: 1,
      xp: 0,
    });
  }

  // SAVE USER STATE (Pity + Guaranteed)
  await user.save();
  if (saves.length > 0) await Cards.insertMany(saves);

  // Generate Image & Reply
  try {
    let img;
    let fname;
    if (amount === 1) {
      img = await generateSinglePullImage(pulls[0]);
      fname = "single.png";
    } else {
      img = await generateTenPullImage(pulls);
      fname = "ten.png";
    }

    const file = new AttachmentBuilder(img, { name: fname });

    // Display Status
    const nextStatus = user.guaranteed === 1 ? "Activated" : "Unactivated";

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle(`✨ Featured Results ✨`)
      .setDescription(`**Inventory:** ${item.amount} Tickets`)
      .setImage(`attachment://${fname}`)
      .setFooter({
        text: `Pity: ${user.pity}/60 | Guaranteed: ${nextStatus}`,
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pull_1_specific")
        .setLabel("Pull x1")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("pull_10_specific")
        .setLabel("Pull x10")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("back_menu")
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: null,
      embeds: [embed],
      files: [file],
      components: [row],
    });
  } catch (error) {
    console.error("Image Gen Error:", error);
    interaction.editReply({ content: "Error generating image.", embeds: [] });
  }
}

module.exports = { executeSinglePull, executeTenPull, executeSpecificPull };

module.exports = { executeTenPull, executeSinglePull, executeSpecificPull };
