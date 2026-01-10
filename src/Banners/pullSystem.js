const { Index, UserContainer, Cards, Inventory, SBanner } = require("../db");
const { getNextUid } = require("../functions"); // ✅ Imported
const { updateQuestProgress } = require('../quest/questManager'); // ✅ Imported
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

const RATES = {
  6: 0.005,
  5: 0.025,
  4: 0.17,
  3: 0.80,
};

const PITY_HARD_CAP = 60;
const LOADING_IMAGE =
  "https://res.cloudinary.com/pachi/image/upload/v1766588382/loadingGif1-ezgif.com-crop_qniwcq.gif";

const BANNER_CURRENCY = {
  STANDARD: "ticket",
  WUWA: "tide",
  ZZZ: "tape",
  FEATURED: "ticket",
  GENSHIN: "fate",
  HSR: "pass",
  ARKNIGHTS: "permit",
};

const BANNER_NAMES = {
  STANDARD: "Standard Banner",
  WUWA: "Wuthering Waves",
  ZZZ: "Zenless Zone Zero",
  FEATURED: "Featured Banner",
  GENSHIN: "Genshin Impact",
  HSR: "Honkai Star Rail",
  ARKNIGHTS: "Arknights",
};

// ==========================================
// 🛠️ HELPERS
// ==========================================

async function getBatchUids(userId, amount) {
  const userCards = await Cards.find({ ownerId: userId }).select("uid").sort({ uid: 1 });
  const usedIds = new Set(userCards.map(c => c.uid).filter(id => id != null));
  
  const freeIds = [];
  let candidate = 1;
  
  while (freeIds.length < amount) {
    if (!usedIds.has(candidate)) {
      freeIds.push(candidate);
    }
    candidate++;
  }
  return freeIds;
}

function determineRarity(currentPity) {
  if (currentPity >= PITY_HARD_CAP - 1) return 5;
  const rng = Math.random();
  if (rng < RATES[6]) return 6;
  if (rng < RATES[6] + RATES[5]) return 5;
  if (rng < RATES[6] + RATES[5] + RATES[4]) return 4;
  return 3;
}

function calculateStats(baseStats, rarity) {
  if (!baseStats) baseStats = { hp: 75, atk: 60, def: 50, speed: 69 };

  return {
    hp: Math.floor(
      baseStats.hp * (2 + rarity) + rarity * 10 + Math.floor(Math.random() * 20)
    ),
    atk: baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10),
    def: baseStats.def + 20 * rarity + Math.floor(Math.random() * 10),
    speed: baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5),
  };
}

async function performPullLogic(userId, bannerType, user) {
  let currentPity = user.pity || 0;
  const rarity = determineRarity(currentPity);

  if (rarity >= 5) currentPity = 0;
  else currentPity++;

  let dbFilter = {};
  if (bannerType !== "STANDARD" && bannerType !== "FEATURED") {
    dbFilter.franchise = BANNER_NAMES[bannerType];
  }

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
// 1. STANDARD / SERIES BANNERS
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
    return interaction.editReply({ content: `❌ **Insufficient Funds!**`, embeds: [] });

  item.amount -= 1;
  await inv.save();

  // ✅ QUEST UPDATE: Single Pull
  await updateQuestProgress(user, "GACHA_PULL", 1, interaction);

  const { resultCard, dbEntry, newPity } = await performPullLogic(userId, bannerType, user);
  user.pity = newPity;
  await user.save();

  if (dbEntry) {
    dbEntry.uid = await getNextUid(userId);
    await Cards.create(dbEntry);
  }

  try {
    const img = await generateSinglePullImage(resultCard);
    const file = new AttachmentBuilder(img, { name: "res.png" });
    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle(`✨ Result (${BANNER_NAMES[bannerType]}) ✨`)
      .setImage("attachment://res.png")
      .setFooter({ text: `Pity: ${user.pity}/60` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`pull_1_${bannerType.toLowerCase()}`).setLabel("Pull x1").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`pull_10_${bannerType.toLowerCase()}`).setLabel("Pull x10").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("back_menu").setLabel("Back").setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ content: null, embeds: [embed], files: [file], components: [row] });
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
  await interaction.editReply({ content: null, embeds: [loading], components: [], files: [] });

  let user = await UserContainer.findOne({ userId });
  if (!user) user = await UserContainer.create({ userId, pity: 0 });
  let inv = await Inventory.findOne({ userId });
  if (!inv) inv = await Inventory.create({ userId, items: [] });
  const item = inv.items.find((i) => i.itemId === currencyId);

  if (!item || item.amount < 10)
    return interaction.editReply({ content: `❌ **Insufficient Funds!**`, embeds: [] });

  item.amount -= 10;
  await inv.save();

  // ✅ QUEST UPDATE: 10 Pulls
  await updateQuestProgress(user, "GACHA_PULL", 10, interaction);

  const availableUids = await getBatchUids(userId, 10);

  const pulls = [];
  const saves = [];
  
  for (let i = 0; i < 10; i++) {
    const res = await performPullLogic(userId, bannerType, user);
    user.pity = res.newPity;
    pulls.push(res.resultCard);
    
    if (res.dbEntry) {
      res.dbEntry.uid = availableUids[i];
      saves.push(res.dbEntry);
    }
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
      new ButtonBuilder().setCustomId(`pull_1_${bannerType.toLowerCase()}`).setLabel("Pull x1").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`pull_10_${bannerType.toLowerCase()}`).setLabel("Pull x10").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("back_menu").setLabel("Back").setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ content: null, embeds: [embed], files: [file], components: [row] });
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// 2. FEATURED BANNER LOGIC
// ==========================================
async function executeSpecificPull(interaction, bannerType, icon, amount = 1) {
  const userId = interaction.user.id;
  const currencyId = "ticket";

  const loadingEmbed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle(`✨ Summoning x${amount} on Featured...`)
    .setImage(LOADING_IMAGE);
  await interaction.editReply({ content: null, embeds: [loadingEmbed], components: [], files: [] });

  const bannerState = await SBanner.findOne({ id: "current_banner" });
  if (!bannerState) return interaction.editReply({ content: "⚠️ Featured Banner inactive.", embeds: [] });
  const featuredId = Number(bannerState.cardId);

  let user = await UserContainer.findOne({ userId });
  if (!user) user = await UserContainer.create({ userId, pity: 0, guaranteed: 0 });

  if (user.guaranteed === undefined || user.guaranteed === null) {
    user.guaranteed = 0;
    await user.save();
  }

  let inv = await Inventory.findOne({ userId });
  if (!inv) inv = await Inventory.create({ userId, items: [] });
  const item = inv.items.find((i) => i.itemId === currencyId);

  if (!item || item.amount < amount) {
    return interaction.editReply({ content: `❌ **Insufficient Funds!**`, embeds: [] });
  }

  item.amount -= amount;
  await inv.save();

  // ✅ QUEST UPDATE: Featured Pulls (amount varies 1 or 10)
  await updateQuestProgress(user, "GACHA_PULL", amount, interaction);

  const availableUids = await getBatchUids(userId, amount);

  const pulls = [];
  const saves = [];

  for (let i = 0; i < amount; i++) {
    // Increment Pity
    let currentPity = user.pity || 0;
    const rarity = determineRarity(currentPity);

    // Reset Pity on 5 or 6 Star
    if (rarity >= 5) user.pity = 0;
    else user.pity++;

    let cardData = null;

    if (rarity === 6) {
      console.log(`[6★ PULL] User: ${user.userId} | 6-Star Drop! Guaranteed Featured.`);
      cardData = await Index.findOne({ pokeId: featuredId });
    } 
    else if (rarity === 5) {
      const isGuaranteed = user.guaranteed === 1;
      const won5050 = Math.random() < 0.5;

      console.log(`[5★ PULL] User: ${user.userId} | Guaranteed? ${isGuaranteed} | Won 50/50? ${won5050}`);

      if (isGuaranteed || won5050) {
        cardData = await Index.findOne({ pokeId: featuredId });
        user.guaranteed = 0; // Reset Guarantee
      } else {
        const lost5050Agg = await Index.aggregate([
          { $match: { pokeId: { $ne: featuredId } } },
          { $sample: { size: 1 } },
        ]);
        if (lost5050Agg.length > 0) cardData = lost5050Agg[0];
        else cardData = await Index.findOne({ pokeId: featuredId });
        
        user.guaranteed = 1; // SET GUARANTEE
      }
    } else {
      const randomAgg = await Index.aggregate([{ $sample: { size: 1 } }]);
      if (randomAgg.length > 0) cardData = randomAgg[0];
    }

    if (!cardData) cardData = await Index.findOne({ pokeId: featuredId }); 

    const uniqueStats = calculateStats(cardData.stats, rarity);

    pulls.push({
      name: cardData.name,
      rarity: rarity,
      image: cardData.image,
      stats: uniqueStats,
    });
    saves.push({
      ownerId: userId,
      uid: availableUids[i],
      cardId: cardData.pokeId,
      stats: uniqueStats,
      rarity: rarity,
      level: 1,
      xp: 0,
    });
  }

  await user.save();
  if (saves.length > 0) await Cards.insertMany(saves);

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
      new ButtonBuilder().setCustomId("pull_1_specific").setLabel("Pull x1").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("pull_10_specific").setLabel("Pull x10").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("back_menu").setLabel("Back").setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ content: null, embeds: [embed], files: [file], components: [row] });
  } catch (error) {
    console.error("Image Gen Error:", error);
    interaction.editReply({ content: "Error generating image.", embeds: [] });
  }
}

module.exports = {
  executeSinglePull,
  executeTenPull,
  executeSpecificPull,
  calculateStats,
};