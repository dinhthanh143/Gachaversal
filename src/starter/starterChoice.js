const { Index, Cards, UserContainer, Inventory } = require("../db");
// ✅ Added getNextUid import
const { getRarityStars, getNextUid } = require("../functions");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

// ==========================================
// 1. CONFIGURATION
// ==========================================
const STARTER_IDS = [4, 9, 10, 12, 20];
const FIXED_RARITY = 4;
const TIMEOUT_MS = 300000; // 5 Min

function formatImage(url) {
  if (!url) return null;
  if (url.includes("res.cloudinary.com")) {
    return url.replace("/upload/", `/upload/w_330,h_550,c_fill/`);
  }
  return url;
}

function calculateStats(baseStats, rarity) {
  if (!baseStats) baseStats = { hp: 75, atk: 60, def: 50, speed: 69 };
  return {
    hp: Math.floor(
      baseStats.hp * (3 + rarity) + rarity * 20 + Math.floor(Math.random() * 20)
    ),
    atk: Math.floor(
      baseStats.atk + 25 * rarity + Math.floor(Math.random() * 10)
    ),
    def: Math.floor(
      baseStats.def + 20 * rarity + Math.floor(Math.random() * 10)
    ),
    speed: Math.floor(
      baseStats.speed + 7 * rarity + Math.floor(Math.random() * 5)
    ),
  };
}

// ==========================================
// 2. MAIN FUNCTION
// ==========================================
async function starterChoice(message) {
  try {
    const userId = message.author.id;

    // 1. Fetch Data
    const starters = await Index.find({ pokeId: { $in: STARTER_IDS } });
    if (!starters || starters.length === 0) {
      return message.reply("Error loading starter pokemon. Contact admin.");
    }
    starters.sort(
      (a, b) => STARTER_IDS.indexOf(a.pokeId) - STARTER_IDS.indexOf(b.pokeId)
    );

    let currentIndex = 0;

    // 2. Embed Generator
    const generateEmbed = (index) => {
      const char = starters[index];
      const rarityStars = getRarityStars(FIXED_RARITY);
      const scaledImg = formatImage(char.image);

      let desc = char.skill.description;
      if (char.skill.values && char.skill.values.length > 0) {
        const rarityIndex = FIXED_RARITY - 1;
        char.skill.values.forEach((valueArray, i) => {
          if (Array.isArray(valueArray) && valueArray.length > 0) {
            const val =
              valueArray[rarityIndex] !== undefined
                ? valueArray[rarityIndex]
                : valueArray[valueArray.length - 1];
            const regex = new RegExp(`\\{${i}\\}`, "g");
            desc = desc.replace(regex, `**${val}**`);
          }
        });
      }

      const previewStats = calculateStats(char.stats, FIXED_RARITY);

      return new EmbedBuilder()
        .setColor(char.cardColor || "#ffffff")
        .setTitle(`Choose your Starter!`)
        .setDescription(
          `Select a unit to begin your journey. They will join you as a **4-Star** companion.\n\n⚠️ **You have 5 minutes to decide.**`
        )
        .setAuthor({
          name: `${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .addFields(
          {
            name: `${char.name} ${char.type.split(" ")[1] || ""}`,
            value: `**Franchise:** ${char.franchise}\n**Rarity:** ${rarityStars}`,
            inline: false,
          },
          {
            name: "Base Stats (Lv. 1)",
            value: `⚔️ **ATK:** ${previewStats.atk} \n🩸 **HP:** ${previewStats.hp}\n🛡️ **DEF:** ${previewStats.def} \n💨 **SPD:** ${previewStats.speed}`,
            inline: false,
          },
          {
            name: `Skill: ${char.skill.name} ${char.skill.icon || ""}`,
            value: desc,
            inline: false,
          }
        )
        .setImage(scaledImg)
        .setFooter({ text: `Character ${index + 1}/${starters.length}` });
    };

    // 3. Buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("confirm")
        .setLabel("Confirm Selection")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("▶")
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await message.reply({
      embeds: [generateEmbed(currentIndex)],
      components: [row],
    });

    // 4. Collector (5 Minutes)
    const filter = (i) => i.user.id === userId;
    const collector = msg.createMessageComponentCollector({
      filter,
      time: TIMEOUT_MS,
      componentType: ComponentType.Button,
    });

    collector.on("collect", async (interaction) => {
      try {
        await interaction.deferUpdate();
        collector.resetTimer({ time: TIMEOUT_MS });

        if (interaction.customId === "prev") {
          currentIndex = (currentIndex - 1 + starters.length) % starters.length;
          await msg.edit({ embeds: [generateEmbed(currentIndex)] });
        } else if (interaction.customId === "next") {
          currentIndex = (currentIndex + 1) % starters.length;
          await msg.edit({ embeds: [generateEmbed(currentIndex)] });
        } else if (interaction.customId === "confirm") {
          try {
            await message.author.send(
              "**Welcome aboard!** 👋\n\n" +
                "Just a quick note. I built this bot intentionally for my friends and me to mess around with. I dontt plan on making this public or going big with it.\n\n" +
                "Most of project was vibe coded and takes massive inspiration from **Anigame**. Everything here is purely for fun so enjoy ur time here with us :3!\n\n" +
                "Hope that you'll like it. Now you may use your free 5-star starter unit to start!"
            );
          } catch (dmError) {
            // Fallback if user has DMs blocked
            console.log(`Could not DM user ${userId}:`, dmError);
            message.channel.send(
              "⚠️ I tried to DM you the welcome guide, but your DMs seem to be closed!"
            );
          }
          const selectedChar = starters[currentIndex];
          const finalStats = calculateStats(selectedChar.stats, FIXED_RARITY);

          // ✅ 1. Get Next Unique ID
          const nextUid = await getNextUid(userId);

          // ✅ 2. Create Card with UID
          const newCard = await Cards.create({
            ownerId: userId,
            uid: nextUid, // ADDED HERE
            cardId: selectedChar.pokeId,
            stats: finalStats,
            rarity: FIXED_RARITY,
            level: 1,
            xp: 0,
          });

          const userToUpdate = await UserContainer.findOne({ userId: userId });
          if (userToUpdate) {
            userToUpdate.selectedCard = newCard._id;
            await userToUpdate.save();
          }

          const successEmbed = new EmbedBuilder()
            .setColor("#FFD700")
            .setAuthor({
              name: `${message.author.username}`,
              iconURL: message.author.displayAvatarURL({ dynamic: true }),
            })
            .setTitle(`🎉 **Adventure Started!**`)
            .setDescription(
              `You have selected **${selectedChar.name}** as your starter!`
            )
            .setImage(selectedChar.image)
            .addFields({
              name: "Reward",
              value: `${getRarityStars(FIXED_RARITY)} **${
                selectedChar.name
              }** (#${nextUid})`,
              inline: true,
            });

          await msg.edit({
            content: null,
            embeds: [successEmbed],
            components: [],
          });
          collector.stop("confirmed");
        }
      } catch (innerErr) {
        console.error("Starter Interaction Error:", innerErr);
      }
    });

    // 5. TIMEOUT HANDLER (DELETE ACCOUNT)
    collector.on("end", async (collected, reason) => {
      if (reason !== "confirmed") {
        try {
          // Delete incomplete account data
          await UserContainer.findOneAndDelete({ userId });
          await Inventory.findOneAndDelete({ userId });

          await msg.edit({
            content:
              "⏳ **Time ran out.** Guess you're not interested in this bot.\n*Account data has been deleted.*",
            embeds: [],
            components: [],
          });
        } catch (delErr) {
          console.error("Error deleting timed out account:", delErr);
        }
      }
    });
  } catch (error) {
    console.error("Starter Choice Error:", error);
    message.reply("An error occurred while loading starters.");
  }
}

module.exports = { starterChoice };
