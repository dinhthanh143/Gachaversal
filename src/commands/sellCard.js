const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { Cards, UserContainer } = require("../db");
const { getRarityStars } = require("../functions");
const { getAscIcon } = require("../commands/inv_cards");

const BASE_SELL_X2 = {
  1: { gold: 200, gem: 0 },
  2: { gold: 500, gem: 0 },
  3: { gold: 1000, gem: 0 },
  4: { gold: 5000, gem: 0 },
  5: { gold: 24000, gem: 4 },
  6: { gold: 200000, gem: 20 },
};

async function sellCard(message) {
  const userId = message.author.id;
  const args = message.content.split(" ");

  // 1. Fetch User (To check equipped card AND team)
  const userProfile = await UserContainer.findOne({ userId });
  if (!userProfile) return message.reply("❌ User profile not found.");

  let cardsToSell = [];

  // ---------------------------------------------------------
  // 2. PARSE ARGUMENTS (Single UID vs Filters)
  // ---------------------------------------------------------

  // CASE A: Sell by UID (e.g. !sell 5)
  if (args[1] && !args[1].startsWith("-") && !isNaN(parseInt(args[1]))) {
    const indexInput = parseInt(args[1]);
    const userCards = await Cards.find({ ownerId: userId })
      .sort({ _id: 1 })
      .populate("masterData");

    const targetCard = userCards.find((c, i) => {
      const displayId = c.uid ? c.uid : i + 1;
      return displayId === indexInput;
    });

    if (targetCard) cardsToSell.push(targetCard);
    else return message.reply(`❌ Card **#${indexInput}** not found.`);
  }
  // CASE B: Sell by Filters (e.g. !sell -r 1)
  else {
    const getArgValue = (flag) => {
      const index = args.indexOf(flag);
      if (index !== -1 && args[index + 1]) {
        let value = [];
        for (let i = index + 1; i < args.length; i++) {
          if (args[i].startsWith("-")) break;
          value.push(args[i]);
        }
        return value.join(" ").toLowerCase();
      }
      return null;
    };

    const searchName = getArgValue("-n");
    const searchType = getArgValue("-t");
    const searchRarity = getArgValue("-r");
    const searchFranchise = getArgValue("-f");
    const searchAscension = getArgValue("-a");

    if (
      !searchName &&
      !searchType &&
      !searchRarity &&
      !searchFranchise &&
      !searchAscension
    ) {
      return message.reply(
        "⚠️ Usage: `!sell [uid]` OR `!sell -r 1 -n [Card name]` (filters)."
      );
    }

    let userCards = await Cards.find({ ownerId: userId }).populate("masterData");

    cardsToSell = userCards.filter((card) => {
      const master = card.masterData;
      if (!master) return false;

      if (searchName && !master.name.toLowerCase().includes(searchName))
        return false;
      if (searchType && !master.type.toLowerCase().includes(searchType))
        return false;
      if (searchRarity && card.rarity !== parseInt(searchRarity)) return false;
      if (
        searchFranchise &&
        master.franchise &&
        !master.franchise.toLowerCase().includes(searchFranchise)
      )
        return false;
      if (searchAscension && card.ascension !== parseInt(searchAscension))
        return false;

      return true;
    });
  }

  // ---------------------------------------------------------
  // 3. SAFETY CHECKS (Favorites, Equipped & TEAM)
  // ---------------------------------------------------------

  const initialCount = cardsToSell.length;
  cardsToSell = cardsToSell.filter((c) => {
    // Check Favorite
    if (c.fav) return false;
    
    // Check Equipped (Main Slot)
    if (
      userProfile.selectedCard &&
      userProfile.selectedCard.toString() === c._id.toString()
    )
      return false;

    // Check Team (NEW)
    // If the card's UID is found in the user's team array, filter it out
    if (userProfile.team && userProfile.team.includes(c.uid)) {
      return false;
    }

    return true;
  });

  if (cardsToSell.length === 0) {
    if (initialCount > 0)
      return message.reply(
        "⚠️ All selected cards are protected.\nThey are either **Favorite** (❤️), **Equipped**, or **currently on your Team**.\n\n🚫 **Please remove cards from your Team before selling.**"
      );
    return message.reply("🔍 No cards found matching your criteria.");
  }

  // ---------------------------------------------------------
  // 4. CALCULATE VALUE & GROUP DISPLAY
  // ---------------------------------------------------------

  let totalGold = 0;
  let totalGem = 0;
  const groups = {};

  for (const card of cardsToSell) {
    const val = BASE_SELL_X2[card.rarity] || { gold: 0, gem: 0 };
    totalGold += val.gold;
    totalGem += val.gem;

    const masterName = card.masterData ? card.masterData.name : "Unknown";
    const key = `${masterName}_${card.rarity}_${card.level}_${card.ascension}`;

    if (!groups[key]) {
      groups[key] = {
        name: masterName,
        rarity: card.rarity,
        level: card.level,
        ascension: card.ascension,
        count: 0,
      };
    }
    groups[key].count++;
  }

  const displayLines = Object.values(groups).map((g) => {
    const stars = getRarityStars(g.rarity);
    const ascIcon = getAscIcon ? getAscIcon(g.ascension) : `A${g.ascension}`;
    return `x${g.count} **${g.name}** ${stars} [Lv.${g.level}] ${ascIcon}`;
  });

  let descriptionStr = displayLines.slice(0, 15).join("\n");
  if (displayLines.length > 15)
    descriptionStr += `\n...and ${displayLines.length - 15} more groups.`;

  // ---------------------------------------------------------
  // 5. SEND CONFIRMATION EMBED
  // ---------------------------------------------------------

  const embed = new EmbedBuilder()
    .setColor("#FFAA00")
    .setTitle("💰 Sell Confirmation")
    .setDescription(
      `Are you sure you want to sell **${cardsToSell.length}** cards?\n\n${descriptionStr}`
    )
    .addFields({
      name: "Total Rewards",
      value: `💰 **${totalGold.toLocaleString()}** Gold\n💎 **${totalGem.toLocaleString()}** Gems`,
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_sell")
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("cancel_sell")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  const replyMsg = await message.reply({ embeds: [embed], components: [row] });

  // ---------------------------------------------------------
  // 6. COLLECTOR HANDLER
  // ---------------------------------------------------------

  const filter = (i) => i.user.id === userId;
  const collector = replyMsg.createMessageComponentCollector({
    filter,
    time: 30000,
    componentType: ComponentType.Button,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "cancel_sell") {
      await interaction.update({
        content: "❌ Sell cancelled.",
        embeds: [],
        components: [],
      });
      return collector.stop();
    }

    if (interaction.customId === "confirm_sell") {
      try {
        // Double check inventory logic here if needed
        const idsToDelete = cardsToSell.map((c) => c._id);
        await Cards.deleteMany({ _id: { $in: idsToDelete } });

        userProfile.gold += totalGold;
        userProfile.gem += totalGem;
        await userProfile.save();

        // Optional: Run teamReset silently just in case (though we filtered them out earlier)
        // await teamReset(userId); 

        const successEmbed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle("✅ Successfully Sold")
          .setDescription(
            `Sold **${cardsToSell.length}** cards.\n\n${descriptionStr}`
          )
          .addFields({
            name: "Rewards Received",
            value: `💰 **+${totalGold.toLocaleString()}** Gold\n💎 **+${totalGem.toLocaleString()}** Gems`,
          });

        await interaction.update({ embeds: [successEmbed], components: [] });
        collector.stop();
      } catch (err) {
        console.error("Sell Error:", err);
        await interaction.followUp({
          content: "❌ An error occurred while selling.",
          ephemeral: true,
        });
      }
    }
  });

  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      replyMsg
        .edit({ content: "⚠️ Sell confirmation timed out.", components: [] })
        .catch(() => {});
    }
  });
}

module.exports = { sellCard };