const { UserContainer, Index, Cards } = require("../db"); // Added Cards
const { getRarityStars } = require("../functions");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

async function dropCard(message) {
  try {
    const total = await Index.countDocuments();
    if (total === 0) return message.reply("Global card database is empty.");

    // 1. Fetch a Random Card from Index
    const randomIndex = Math.floor(Math.random() * total);
    const cardData = await Index.findOne().skip(randomIndex);

    // 2. Generate Random Rarity & Stats (Same logic as addcard)
    const rarity = Math.floor(Math.random() * 5) + 1;
     
    const uniqueStats = {
      hp: Math.floor(cardData.stats.hp * (8 + rarity) + (rarity * 50) + Math.floor(Math.random() * 50)),
      atk: cardData.stats.atk + (25 * rarity) + Math.floor(Math.random() * 10),
      def: cardData.stats.def + (20 * rarity) + Math.floor(Math.random() * 10),   
      speed: cardData.stats.speed + (2 * rarity) + Math.floor(Math.random() * 3)
    };

    // 3. Build the "Drop" Embed
    const embed = new EmbedBuilder()
      .setColor(cardData.cardColor ?? "#ffffff")
      .setTitle(`A wild card appeared!`)
      .setDescription(
        `**${cardData.name}**\n` +
        `**Rarity:** ${getRarityStars(rarity)}\n` +
        `Be the first to claim it!`
      )
      .setImage(cardData.image)
      .setFooter({ text: "Only ONE person can claim this." });

    const claimBtn = new ButtonBuilder()
      .setCustomId("claim_card")
      .setLabel("Claim")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(claimBtn);

    const msg = await message.reply({
      embeds: [embed],
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({
      time: 15000, // 15 seconds to claim
    });

    let claimed = false;

    collector.on("collect", async (interaction) => {
      const winnerId = interaction.user.id;

      // Check if winner has an account
      let winner = await UserContainer.findOne({ userId: winnerId });
      if (!winner) {
        // Optional: Auto-create account for them? 
        // For now, sticking to your logic of telling them to create one.
        return interaction.reply({
          content: "You don't have an account! Type `!start` or `!create` first.",
          ephemeral: true,
        });
      }

      if (claimed) return;
      claimed = true;
      collector.stop();

      // --- NEW SAVING LOGIC ---
      // Instead of pushing to array, we create a Document in 'Cards'
      await Cards.create({
        ownerId: winnerId,       // Who claimed it
        cardId: cardData.pokeId, // Link to Index
        stats: uniqueStats,      // The stats we calculated above
        rarity: rarity,
        level: 1,
        xp: 0
      });
      // ------------------------

      // Disable button
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim_card")
          .setLabel("Claimed")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await interaction.update({
        embeds: [embed],
        components: [disabledRow],
      });

      await interaction.followUp(`<@${winnerId}> claimed ${getRarityStars(rarity)} **${cardData.name}**! 🎉`);
    });

    collector.on("end", () => {
      if (!claimed) {
        // Disable the button if time runs out
        const disabledRow = new ActionRowBuilder().addComponents(
            claimBtn.setDisabled(true).setLabel("Expired").setStyle(ButtonStyle.Secondary)
        );
        msg.edit({
          content: "Nobody claimed it in time.",
          components: [disabledRow],
        });
      }
    });
  } catch (error) {
    console.log(error);
    message.reply("Something went wrong with the drop.");
  }
}

module.exports = { dropCard };