const { Index, UserContainer, Inventory } = require("../db");
const { getRarityStars } = require("../functions");
const { getFeaturedBanner } = require("./bannerUtils");
const {
  executeTenPull,
  executeSinglePull,
  executeSpecificPull,
} = require("./pullSystem");
const { formatImage } = require("../commands/infoCard");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const PITY_CAP = 60;

const RATE_CONFIG = {
  p6: "0.5%",
  p5: "2.5%",
  p4: "15%",
  p3: "82%",
};

// Added Placeholders for the new banners
const IMAGES = {
  WUWA: "https://res.cloudinary.com/pachi/image/upload/v1766547601/wuwa_banner_d9spqp.jpg",
  ZZZ: "https://res.cloudinary.com/pachi/image/upload/v1766547600/zzz_banner_wuv8sz.png",
  STANDARD:
    "https://res.cloudinary.com/pachi/image/upload/v1766547600/banner_01_pebjwl.png",
  GENERIC:
    "https://res.cloudinary.com/pachi/image/upload/v1766548888/genericBg_khyk8b.png",
  // New Placeholders
  GENSHIN:
    "https://res.cloudinary.com/pachi/image/upload/v1766937166/Genshin-Impact-Fontaine-nhan-vat-1-1536x864_ckcrik.png",
  HSR: "https://res.cloudinary.com/pachi/image/upload/v1766937262/thumb-1280x720-37_msjqzl.png",
  ARKNIGHTS:
    "https://res.cloudinary.com/pachi/image/upload/v1766937573/wallpapersden.com_hd-rpg-arknights-girls-cool-art_1920x1080_xxq9cf.jpg",
};

// Added Icons for the new banners based on item list
const ICONS = {
  FEATURED: "✨",
  STANDARD: "🎫",
  WUWA: "<:wuwaPull:1453226896329412770>",
  ZZZ: "<:zzzPull:1453233952151310478>",
  GENSHIN: "<:genshinPull:1453234890416984207>",
  HSR: "<:hsrPull:1453226721632587849>",
  ARKNIGHTS: "<:permit:1454862332374155366>",
};

const BORDER_LINE = "**▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬**";
const BORDER_LINE_BANNER = "**▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬**";
const THIN_LINE = "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯";

async function banners(message) {
  const userId = message.author.id;
  const currentUser = await UserContainer.findOne({ userId });
  try {
    const getRatesText = () => {
      return (
        `${getRarityStars(6)} **Mythic:** ${RATE_CONFIG.p6}\n` +
        `${getRarityStars(5)} **5-Star:** ${RATE_CONFIG.p5}\n` +
        `${getRarityStars(4)} **4-Star:** ${RATE_CONFIG.p4}\n` +
        `${getRarityStars(3)} **3-Star:** ${RATE_CONFIG.p3}`
      );
    };

    const menuEmbed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("✨ Banner List ✨")
      .setAuthor({
        name: `Wish ${message.author.username} the best of luck!`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setThumbnail(IMAGES.GENERIC)
      .setDescription(`${BORDER_LINE}`)
      .addFields(
        {
          name: `⭐ Featured Banner`,
          value: `Limited Time Rate-Up (Resets every 2h).\n${THIN_LINE}`,
          inline: false,
        },
        {
          name: `${ICONS.STANDARD} Standard Banner`,
          value: `Permanent pool. All characters.\n${THIN_LINE}`,
          inline: false,
        },
        {
          name: `${ICONS.WUWA} Wuthering Waves`,
          value: `Featured Resonator Convene.\n${THIN_LINE}`,
          inline: false,
        },
        {
          name: `${ICONS.ZZZ} Zenless Zone Zero`,
          value: `New Eridu City Fund.\n${THIN_LINE}`,
          inline: false,
        },
        // --- NEW FIELDS ---
        {
          name: `${ICONS.GENSHIN} Genshin Impact`,
          value: `Call upon featured heroes of Teyvat.\n${THIN_LINE}`,
          inline: false,
        },
        {
          name: `${ICONS.HSR} Honkai: Star Rail`,
          value: `Chart your path with Stellar Warp.\n${THIN_LINE}`,
          inline: false,
        },
        {
          name: `${ICONS.ARKNIGHTS} Arknights`,
          value: `Recruit elite Operators.\n${THIN_LINE}`,
          inline: false,
        }
      )
      .setColor("DarkPurple")
      .setFooter({ text: "Select a banner below." });

    // Row 1: Existing Banners
    const menuRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("view_featured")
        .setLabel("Featured")
        .setEmoji("⭐")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("view_standard")
        .setLabel("Standard")
        .setEmoji("1453227863107965018")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("view_wuwa")
        .setLabel("WuWa")
        .setEmoji("1453226896329412770")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("view_zzz")
        .setLabel("ZZZ")
        .setEmoji("1453233952151310478")
        .setStyle(ButtonStyle.Primary)
    );

    // Row 2: New Banners
    const menuRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("view_genshin")
        .setLabel("Genshin")
        .setEmoji("1453234890416984207")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("view_hsr")
        .setLabel("HSR")
        .setEmoji("1453226721632587849")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("view_arknights")
        .setLabel("Arknights")
        .setEmoji("1454862332374155366")
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await message.reply({
      embeds: [menuEmbed],
      components: [menuRow1, menuRow2], // Pass both rows
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: 60000,
    });

    const processingUsers = new Set();

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: "Not yours.", ephemeral: true });
      }

      if (processingUsers.has(interaction.user.id)) return;
      processingUsers.add(interaction.user.id);

      try {
        try {
          await interaction.deferUpdate();
        } catch (e) {
          if (e.code === 10062) {
            processingUsers.delete(interaction.user.id);
            return;
          }
          throw e;
        }

        let user = await UserContainer.findOne({ userId: interaction.user.id });
        if (!user) user = { pity: 0 };
        const currentPity = user.pity || 0;

        let inv = await Inventory.findOne({ userId: interaction.user.id });
        const getAmount = (id) =>
          inv?.items.find((i) => i.itemId === id)?.amount || 0;

        const rates = getRatesText();

        // PULL ACTIONS
        if (interaction.customId === "pull_1_specific") {
          await executeSpecificPull(interaction, "FEATURED", "✨", 1);
        } else if (interaction.customId === "pull_10_specific") {
          await executeSpecificPull(interaction, "FEATURED", "✨", 10);
        } else if (interaction.customId === "pull_1_standard") {
          await executeSinglePull(interaction, "STANDARD", ICONS.STANDARD);
        } else if (interaction.customId === "pull_10_standard") {
          await executeTenPull(interaction, "STANDARD", ICONS.STANDARD);
        } else if (interaction.customId === "pull_1_wuwa") {
          await executeSinglePull(interaction, "WUWA", ICONS.WUWA);
        } else if (interaction.customId === "pull_10_wuwa") {
          await executeTenPull(interaction, "WUWA", ICONS.WUWA);
        } else if (interaction.customId === "pull_1_zzz") {
          await executeSinglePull(interaction, "ZZZ", ICONS.ZZZ);
        } else if (interaction.customId === "pull_10_zzz") {
          await executeTenPull(interaction, "ZZZ", ICONS.ZZZ);
        }
        // --- NEW PULL ACTIONS ---
        else if (interaction.customId === "pull_1_genshin") {
          await executeSinglePull(interaction, "GENSHIN", ICONS.GENSHIN);
        } else if (interaction.customId === "pull_10_genshin") {
          await executeTenPull(interaction, "GENSHIN", ICONS.GENSHIN);
        } else if (interaction.customId === "pull_1_hsr") {
          await executeSinglePull(interaction, "HSR", ICONS.HSR);
        } else if (interaction.customId === "pull_10_hsr") {
          await executeTenPull(interaction, "HSR", ICONS.HSR);
        } else if (interaction.customId === "pull_1_arknights") {
          await executeSinglePull(interaction, "ARKNIGHTS", ICONS.ARKNIGHTS);
        } else if (interaction.customId === "pull_10_arknights") {
          await executeTenPull(interaction, "ARKNIGHTS", ICONS.ARKNIGHTS);
        }

        // ==========================================
        // 🖥️ VIEW: FEATURED BANNER
        // ==========================================
        else if (interaction.customId === "view_featured") {
          const bannerState = await getFeaturedBanner();
          const charId = Number(bannerState.cardId);
          let featuredChar = await Index.findOne({ pokeId: charId });

          if (!featuredChar) {
            console.error(
              `BANNER ERROR: Char ID ${charId} exists in SBanner but NOT in Index.`
            );
            return interaction.followUp({
              content:
                "⚠️ **System Error:** Featured character data is missing. Please contact admin.",
              ephemeral: true,
            });
          }

          const now = Date.now();
          const resetTime = new Date(bannerState.nextReset).getTime();
          const diff = resetTime - now;
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

          const tickets = getAmount("ticket");

          const embed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle(`✨ FEATURED BANNER ✨`)
            .setDescription(
              `${BORDER_LINE_BANNER}\n` +
                `**Featured:** ${featuredChar.name} ${
                  featuredChar.emoji || ""
                }\n` +
                `**Resets In:** ⏳ ${hours}h ${mins}m\n` +
                `${THIN_LINE}\n` +
                `${ICONS.STANDARD} **Tickets:** ${tickets}`
            )
            .setImage(formatImage(featuredChar.image, 250, 390))
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
              { name: "📊 Drop Rates", value: rates, inline: true },
              {
                name: "🎯 Rate Up",
                value: `**100% Chance** for\n**${featuredChar.name}**\non 5★ on guaranteed!`,
                inline: true,
              }
            )
            .setFooter({
              text: `Pity: ${currentPity}/${PITY_CAP} | Guaranteed: ${
                currentUser.guaranteed ? "Activated" : "Unactivated"
              }`,
            });

          const actionRow = new ActionRowBuilder().addComponents(
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
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.editReply({
            embeds: [embed],
            components: [actionRow],
            files: [],
          });
        }

        // ==========================================
        // 🖥️ VIEW: STANDARD BANNER
        // ==========================================
        else if (interaction.customId === "view_standard") {
          const allCards = await Index.find({});
          const tickets = getAmount("ticket");
          const embed = new EmbedBuilder()
            .setColor("#FF4500")
            .setTitle(`✨ STANDARD BANNER ✨`)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(
              `${BORDER_LINE_BANNER}\n${ICONS.STANDARD} **Tickets:** ${tickets}\nPermanent Pool. All non-limited characters.`
            )
            .setImage(IMAGES.STANDARD)
            .addFields(
              { name: "📊 Drop Rates", value: rates, inline: true },
              {
                name: "📑 Details",
                value: `**Pool:** All Franchises\n**Size:** ${allCards.length} characters`,
                inline: true,
              }
            )
            .setFooter({ text: `Pity: ${currentPity}/${PITY_CAP}` });
          const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("pull_1_standard")
              .setLabel("Pull x1")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("pull_10_standard")
              .setLabel("Pull x10")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("back_menu")
              .setLabel("Back")
              .setStyle(ButtonStyle.Danger)
          );
          await interaction.editReply({
            embeds: [embed],
            components: [actionRow],
            files: [],
          });
        }

        // ==========================================
        // 🖥️ VIEW: WUWA BANNER
        // ==========================================
        else if (interaction.customId === "view_wuwa") {
          const allCards = await Index.find({ franchise: "Wuthering Waves" });
          const tides = getAmount("tide");
          const embed = new EmbedBuilder()
            .setColor("#00d9ff")
            .setTitle(`✨ WUTHERING WAVES ✨`)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(
              `${BORDER_LINE_BANNER}\n${ICONS.WUWA} **Radiant Tides:** ${tides}\n**Tune the frequencies.**`
            )
            .setImage(IMAGES.WUWA)
            .addFields(
              { name: "📊 Rates", value: rates, inline: true },
              {
                name: "📑 Pool",
                value: `Size: ${allCards.length} characters`,
                inline: true,
              }
            )
            .setFooter({ text: `Pity: ${currentPity}/${PITY_CAP}` });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("pull_1_wuwa")
              .setLabel("Pull x1")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("pull_10_wuwa")
              .setLabel("Pull x10")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("back_menu")
              .setLabel("Back")
              .setStyle(ButtonStyle.Danger)
          );
          await interaction.editReply({ embeds: [embed], components: [row] });
        }

        // ==========================================
        // 🖥️ VIEW: ZZZ BANNER
        // ==========================================
        else if (interaction.customId === "view_zzz") {
          const allCards = await Index.find({ franchise: "Zenless Zone Zero" });
          const tapes = getAmount("tape");
          const embed = new EmbedBuilder()
            .setColor("#dfff00")
            .setTitle(`✨ ZENLESS ZONE ZERO ✨`)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(
              `${BORDER_LINE_BANNER}\n${ICONS.ZZZ} **Encrypted Tapes:** ${tapes}\n**Signal Search.**`
            )
            .setImage(IMAGES.ZZZ)
            .addFields(
              { name: "📊 Rates", value: rates, inline: true },
              {
                name: "📑 Pool",
                value: `Size: ${allCards.length} characters`,
                inline: true,
              }
            )
            .setFooter({ text: `Pity: ${currentPity}/${PITY_CAP}` });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("pull_1_zzz")
              .setLabel("Pull x1")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("pull_10_zzz")
              .setLabel("Pull x10")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("back_menu")
              .setLabel("Back")
              .setStyle(ButtonStyle.Danger)
          );
          await interaction.editReply({ embeds: [embed], components: [row] });
        }

        // ==========================================
        // 🖥️ VIEW: GENSHIN BANNER
        // ==========================================
        else if (interaction.customId === "view_genshin") {
          const allCards = await Index.find({ franchise: "Genshin Impact" });
          const fates = getAmount("fate");
          const embed = new EmbedBuilder()
            .setColor("#e0b0ff")
            .setTitle(`✨ GENSHIN IMPACT ✨`)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(
              `${BORDER_LINE_BANNER}\n${ICONS.GENSHIN} **Intertwined Fates:** ${fates}\n**Ad Astra Abyssosque.**`
            )
            .setImage(IMAGES.GENSHIN)
            .addFields(
              { name: "📊 Rates", value: rates, inline: true },
              {
                name: "📑 Pool",
                value: `Size: ${allCards.length} characters`,
                inline: true,
              }
            )
            .setFooter({ text: `Pity: ${currentPity}/${PITY_CAP}` });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("pull_1_genshin")
              .setLabel("Pull x1")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("pull_10_genshin")
              .setLabel("Pull x10")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("back_menu")
              .setLabel("Back")
              .setStyle(ButtonStyle.Danger)
          );
          await interaction.editReply({ embeds: [embed], components: [row] });
        }

        // ==========================================
        // 🖥️ VIEW: HSR BANNER
        // ==========================================
        else if (interaction.customId === "view_hsr") {
          const allCards = await Index.find({ franchise: "Honkai Star Rail" });
          const passes = getAmount("pass");
          const embed = new EmbedBuilder()
            .setColor("#708090")
            .setTitle(`✨ HONKAI: STAR RAIL ✨`)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(
              `${BORDER_LINE_BANNER}\n${ICONS.HSR} **Special Passes:** ${passes}\n**Journey to the stars.**`
            )
            .setImage(IMAGES.HSR)
            .addFields(
              { name: "📊 Rates", value: rates, inline: true },
              {
                name: "📑 Pool",
                value: `Size: ${allCards.length} characters`,
                inline: true,
              }
            )
            .setFooter({ text: `Pity: ${currentPity}/${PITY_CAP}` });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("pull_1_hsr")
              .setLabel("Pull x1")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("pull_10_hsr")
              .setLabel("Pull x10")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("back_menu")
              .setLabel("Back")
              .setStyle(ButtonStyle.Danger)
          );
          await interaction.editReply({ embeds: [embed], components: [row] });
        }

        // ==========================================
        // 🖥️ VIEW: ARKNIGHTS BANNER
        // ==========================================
        else if (interaction.customId === "view_arknights") {
          const allCards = await Index.find({ franchise: "Arknights" });
          const permits = getAmount("permit");
          const embed = new EmbedBuilder()
            .setColor("#1f1f1f")
            .setTitle(`✨ ARKNIGHTS ✨`)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(
              `${BORDER_LINE_BANNER}\n${ICONS.ARKNIGHTS} **Headhunting Permits:** ${permits}\n**Recruit Operators.**`
            )
            .setImage(IMAGES.ARKNIGHTS)
            .addFields(
              { name: "📊 Rates", value: rates, inline: true },
              {
                name: "📑 Pool",
                value: `Size: ${allCards.length} characters`,
                inline: true,
              }
            )
            .setFooter({ text: `Pity: ${currentPity}/${PITY_CAP}` });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("pull_1_arknights")
              .setLabel("Pull x1")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("pull_10_arknights")
              .setLabel("Pull x10")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("back_menu")
              .setLabel("Back")
              .setStyle(ButtonStyle.Danger)
          );
          await interaction.editReply({ embeds: [embed], components: [row] });
        } else if (interaction.customId === "back_menu") {
          await interaction.editReply({
            embeds: [menuEmbed],
            components: [menuRow1, menuRow2],
            files: [],
          });
        }
      } catch (err) {
        console.error("Button Logic Error:", err);
      } finally {
        processingUsers.delete(interaction.user.id);
      }
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  } catch (error) {
    console.error("Banner Command Error:", error);
    message.reply("Something went wrong loading the banners.");
  }
}

module.exports = { banners };
