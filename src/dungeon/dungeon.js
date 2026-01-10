const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { DUNGEON_AREAS } = require("./dungeonData");
const { UserContainer } = require("../db");
const xpIcon = "<:xp:1454544536390078647>"
// =========================================
// 🛠️ HELPER: Image Formatter
// =========================================
function formatImage(url, width, height) {
  if (!url) return null;
  if (url.includes("res.cloudinary.com")) {
    return url.replace("/upload/", `/upload/w_${width},h_${height},c_fill/`);
  }
  if (url.includes("via.placeholder.com")) {
    return `https://via.placeholder.com/${width}x${height}?text=Mob`;
  }
  return url;
}

// =========================================
// 🛠️ HELPER: Send Stage Embed (Shared)
// =========================================
async function sendStageInfo(message, areaData, stageId, mob) {
  // 1. Format Skill
  let desc = mob.skill.description || "No description.";
  const val = mob.skill.values;
  if (desc.includes("{0}") && val !== undefined) {
    desc = desc.replace("{0}", `**${val}**`);
  }

  // 2. Assets
  const skillIcon = mob.skill.icon || "⚔️";
  const xpImg = xpIcon; // Placeholder for XP Icon
  const fixedImage = formatImage(mob.image, 330, 550);
  const rMap = { 1: "💀", 2: "💀💀", 3: "💀💀💀", 4: "👺" };

  // 3. Build Embed
  const embed = new EmbedBuilder()
    .setColor("#DC143C") // Crimson
    .setTitle(`${mob.name} ${mob.type.split(" ")[1] || ""}`)
    .setAuthor({
      name: `${message.author.username}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
    })
    .addFields(
      {
        name: "Info",
        value:
          `**Area:** ${areaData.name}\n` +
          `**Stage:** ${stageId}\n` +
          `**Threat level:** ${rMap[mob.rarity] || "💀"}\n` +
          `**Type:** ${mob.type}\n` +
          `**Level:** ${mob.level}\n` +
          `**ATK:** ${mob.stats.atk}\n` +
          `**HP:** ${mob.stats.hp}\n` +
          `**Speed:** ${mob.stats.speed}\n` +
          `**Defense:** ${mob.stats.def}\n` +
          `**Rewards:** 🪙 ${mob.rewards.gold} | ${xpImg} ${mob.rewards.xp}`,
      },
      {
        name: `Skill: ${mob.skill.name} ${skillIcon}`,
        value: desc,
      }
    )
    .setImage(fixedImage)
    .setFooter({ text: "Dungeon Stage Info" });

  return message.reply({ embeds: [embed] });
}

// =========================================
// 🏰 COMMAND: !dungeon (Lists Areas)
// =========================================
async function dungeonHub(message) {
  try {
    const userId = message.author.id;
    const user = await UserContainer.findOne({ userId });
    const userMaxArea = user?.dungeon?.maxArea || 1;

    const areaKeys = Object.keys(DUNGEON_AREAS);
    const totalAreas = areaKeys.length;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(totalAreas / itemsPerPage);
    let currentPage = 1;

    const generateEmbed = (page) => {
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const currentKeys = areaKeys.slice(start, end);

      const listString = currentKeys
        .map((key) => {
          const area = DUNGEON_AREAS[key];
          const isLocked = parseInt(key) > userMaxArea;
          if (isLocked) {
            return `**Area ${key}: 🔒 ???**\n*[LOCKED] - Clear previous area to unlock*`;
          }
          return `**Area ${key}: ${area.name}**`;
        })
        .join("\n\n");

      return new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle(`☠️ Dungeon Map ☠️`)
        .setAuthor({
            name: message.author.username, 
            iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setImage("https://res.cloudinary.com/pachi/image/upload/v1766819403/Gemini_Generated_Image_qwbwx6qwbwx6qwbw_ltmsvw.png")
        .setDescription("-----------------------------\n" + (listString || "No areas found."))
        .setFooter({ text: `Page ${page}/${totalPages} | Prefix: !area [id] to travel` });
    };

    const getButtons = (page) => {
      const row = new ActionRowBuilder();
      const prev = new ButtonBuilder().setCustomId("prev").setLabel("◀").setStyle(ButtonStyle.Primary).setDisabled(page === 1);
      const next = new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle(ButtonStyle.Primary).setDisabled(page === totalPages);
      row.addComponents(prev, next);
      return row;
    };

    const msg = await message.reply({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage)] });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    collector.on("collect", async (i) => {
      if (i.user.id !== userId) return i.reply({ content: "Not your map!", ephemeral: true });
      if (i.customId === "prev") currentPage--;
      if (i.customId === "next") currentPage++;
      await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage)] });
    });
    collector.on("end", () => msg.edit({ components: [] }).catch(() => {}));

  } catch (err) {
    console.error(err);
    message.reply("Error loading dungeon.");
  }
}

// =========================================
// 📍 COMMAND: !area [id]
// =========================================
async function areaDetails(message) {
  try {
    const userId = message.author.id;
    const args = message.content.split(" ");
    let areaId = parseInt(args[1]);

    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("User not found.");

    if (!areaId || isNaN(areaId)) {
      if (user.dungeon && user.dungeon.currentArea > 0) {
        areaId = user.dungeon.currentArea;
      } else {
        return message.reply("⚠️ You haven't entered an Area yet. Use `!area [id]` to travel.");
      }
    } else {
      const userMaxArea = user.dungeon?.maxArea || 1;
      if (!DUNGEON_AREAS[areaId]) return message.reply(`❌ Area ${areaId} does not exist.`);
      if (areaId > userMaxArea) return message.reply(`🔒 **Area ${areaId} is locked!**`);
      
      if (!user.dungeon) user.dungeon = { currentArea: 0, currentStage: 0, maxArea: 1, maxStage: 1 };
      user.dungeon.currentArea = areaId;
      await user.save();
    }

    const area = DUNGEON_AREAS[areaId];
    const stageKeys = Object.keys(area.stages);
    const totalStages = stageKeys.length;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(totalStages / itemsPerPage);
    let currentPage = 1;

    const userMaxStage = user.dungeon.maxArea > areaId ? 999 : user.dungeon.maxStage || 1;

    const generateEmbed = (page) => {
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const currentKeys = stageKeys.slice(start, end);

      const stagesList = currentKeys.map((key) => {
          const stageNum = parseInt(key);
          if (stageNum > userMaxStage) return `**Stage ${key}** | 🔒 Locked`;

          const stage = area.stages[key];
          const mob = stage.mobs[0];
          const rMap = { 1: "💀", 2: "💀💀", 3: "💀💀💀", 4: "👺" };
          const icon = rMap[mob.rarity] || "💀";

          return `**Stage ${key}** | **${mob.name}** | Lv.${mob.level} | Type: ${mob.type.split(" ")[1] || ""} | ${icon}`;
        }).join("\n");

      return new EmbedBuilder()
        .setColor("#ffcc00")
        .setTitle(`📍 Area ${areaId}: ${area.name}`)
        .setThumbnail("https://res.cloudinary.com/pachi/image/upload/v1766821297/Gemini_Generated_Image_yw36w5yw36w5yw36_p0wt3c.png")
        .setDescription(`-----------------------------\n${stagesList}`)
        .setFooter({ text: `Page ${page}/${totalPages} | Current: Area ${areaId} • Use !stage [id] to inspect` });
    };

    const getButtons = (page) => {
        const row = new ActionRowBuilder();
        const prev = new ButtonBuilder().setCustomId("prev").setLabel("◀").setStyle(ButtonStyle.Primary).setDisabled(page === 1);
        const next = new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle(ButtonStyle.Primary).setDisabled(page === totalPages);
        row.addComponents(prev, next);
        return row;
      };
  
      const msg = await message.reply({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage)] });
  
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 60000 });
      collector.on("collect", async (i) => {
        if (i.user.id !== userId) return i.reply({ content: "Not your menu!", ephemeral: true });
        if (i.customId === "prev") currentPage--;
        if (i.customId === "next") currentPage++;
        await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage)] });
      });
      collector.on("end", () => msg.edit({ components: [] }).catch(() => {}));

  } catch (err) {
    console.error(err);
    message.reply("Error loading area.");
  }
}

// =========================================
// 🔍 COMMAND: !stage [id]
// =========================================
async function stageDetails(message) {
  try {
    const userId = message.author.id;
    const args = message.content.split(" ");
    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("User not found.");

    const currentAreaId = user.dungeon?.currentArea;
    if (!currentAreaId || currentAreaId === 0) return message.reply("⚠️ You haven't entered an Area yet. Use `!area [id]` first.");

    const areaData = DUNGEON_AREAS[currentAreaId];
    if (!areaData) return message.reply("❌ Invalid Area data.");

    // Determine Max Stage Logic
    const userMaxStage = user.dungeon.maxArea > currentAreaId ? 999 : user.dungeon.maxStage || 1;

    let stageId;
    const inputId = parseInt(args[1]);

    if (inputId && !isNaN(inputId)) {
      // ✅ USER PROVIDED ID (e.g., !stage 5)
      // Validate Existence
      if (!areaData.stages[inputId]) {
        return message.reply(`❌ Stage ${inputId} does not exist in Area ${currentAreaId}.`);
      }
      // Validate Lock Status
      if (inputId > userMaxStage) {
        return message.reply(`🔒 **Stage ${inputId} is locked.** Clear previous stages first.`);
      }

      // UPDATE DB: Move user to this stage
      user.dungeon.currentStage = inputId;
      await user.save();
      stageId = inputId;
    } else {
      // ❌ NO ID PROVIDED (e.g., !stage)
      // Read current location from DB
      stageId = user.dungeon.currentStage > 0 ? user.dungeon.currentStage : 1;
      
      // Safety check: if currentStage in DB is somehow invalid/locked (rare edge case), fallback
      if (!areaData.stages[stageId]) stageId = 1;
    }

    // Use Helper to display
    await sendStageInfo(message, areaData, stageId, areaData.stages[stageId].mobs[0]);

  } catch (err) {
    console.error(err);
    message.reply("Error loading stage details.");
  }
}

// =========================================
// ⏩ COMMAND: !next stage (Travel Only)
// =========================================
async function nextStage(message) {
  try {
    const userId = message.author.id;
    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("User not found.");

    const currentAreaId = user.dungeon?.currentArea;
    if (!currentAreaId || currentAreaId === 0) {
      return message.reply("⚠️ You haven't entered an Area yet.");
    }

    // 1. Calculate Next Stage
    const currentStage = user.dungeon.currentStage;
    const nextStageId = currentStage + 1;
    const areaData = DUNGEON_AREAS[currentAreaId];

    // 2. Check if Next Stage exists in this Area
    if (!areaData || !areaData.stages[nextStageId]) {
      return message.reply(`🚫 **Area Complete!** Use \`!area ${currentAreaId + 1}\` to move to the next Zone.`);
    }

    // 3. Check Lock Status
    const isUnlocked = (user.dungeon.maxArea > currentAreaId) || (nextStageId <= user.dungeon.maxStage);

    if (!isUnlocked) {
      return message.reply(`🔒 **Stage ${nextStageId} is locked.** You must defeat Stage ${currentStage} first!`);
    }

    // 4. Update User Location
    user.dungeon.currentStage = nextStageId;
    await user.save();

    // 5. Display (Reuse Helper)
    await sendStageInfo(message, areaData, nextStageId, areaData.stages[nextStageId].mobs[0]);

  } catch (err) {
    console.error(err);
    message.reply("Error moving to next stage.");
  }
}

module.exports = { dungeonHub, areaDetails, stageDetails, nextStage };