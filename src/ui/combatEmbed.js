const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
// ✅ FIX: Import these
const { getRarityStars, getThreatRarity } = require("../functions");

const BG_URL =
  "https://res.cloudinary.com/pachi/image/upload/v1766819403/Gemini_Generated_Image_qwbwx6qwbwx6qwbw_ltmsvw.png";

let cachedBackground = null;
async function getBackground() {
  if (cachedBackground) return cachedBackground;
  try {
    cachedBackground = await loadImage(BG_URL);
    return cachedBackground;
  } catch (err) {
    console.error("Failed to load background image", err);
    return null;
  }
}

function drawFramedImage(ctx, img, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "black";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(img, x, y, w, h);
  ctx.strokeStyle = "#b88c14";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

async function generateBattleImage(playerUrl, enemyUrl) {
  const width = 800;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // ✅ CONSTANTS: Ensure both are exactly the same scale/size
  const CARD_W = 225;
  const CARD_H = 370;
  const CARD_Y = 50; // Vertically centered: (450 - 350) / 2
  const P_X = 50; // Player X (Left margin)
  const E_X = 525; // Enemy X (Right margin: 800 - 50 - 225)

  try {
    const bg = await getBackground();
    if (bg) ctx.drawImage(bg, 0, 0, width, height);
    else {
      ctx.fillStyle = "#2b2d31";
      ctx.fillRect(0, 0, width, height);
    }

    // 1. Draw Player (Left)
    if (playerUrl) {
      const pImg = await loadImage(playerUrl).catch(() => null);
      if (pImg) drawFramedImage(ctx, pImg, P_X, CARD_Y, CARD_W, CARD_H);
    }

    // 2. Draw Enemy (Right)
    if (enemyUrl) {
      const eImg = await loadImage(enemyUrl).catch(() => null);
      if (eImg) drawFramedImage(ctx, eImg, E_X, CARD_Y, CARD_W, CARD_H);
    }

    // 3. Draw VS Text
    ctx.save();
    ctx.font = "bold 80px sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "black";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 15;
    ctx.strokeText("VS", width / 2, height / 2);
    ctx.fillText("VS", width / 2, height / 2);
    ctx.restore();

    return canvas.toBuffer();
  } catch (err) {
    console.error("Error generating battle image:", err);
    return null;
  }
}

// ==========================================
// 📝 EMBED BUILDER
// ==========================================
module.exports = async function (
  player,
  playerType,
  mobType,
  rarity,
  enemyRarity,
  enemy,
  logs,
  turn,
  existingBuffer = null,
  title = null,
  battleType = "dungeon"
) {
  const pHP = Math.max(0, player.stats.hp);
  const eHP = Math.max(0, enemy.stats.hp);

  let logText = "⚔️ **Battle Start!**";
  if (logs && logs.length > 0) {
    logText = logs[logs.length - 1]; // Get last log
  }

  let imageBuffer = existingBuffer;
  if (!imageBuffer) {
    imageBuffer = await generateBattleImage(player.image, enemy.image);
  }
  const eRarity = (battleType !== "dungeon" )? getRarityStars(enemyRarity) : getThreatRarity(enemyRarity)
  const embed = new EmbedBuilder()
    .setTitle(title || `⚔️ Battle - Turn ${turn}`)
    .setColor("#FF4500")
    .addFields(
      {
        // ✅ FIX: Show Rarity Stars
        name: `${player.name} (Lv.${player.level}) ${getRarityStars(
          rarity
        )} | ${playerType.split(" ")[1]}`,
        value:
          player.displayBars ||
          `❤️ **${pHP}/${player.maxHp}**\n⚡ **${player.energy}/100**`,
        inline: false,
      },
      {
        // ✅ FIX: Show Threat Rarity (for mobs)
        name: `${enemy.name} (Lv.${enemy.level}) ${eRarity} | ${mobType.split(" ")[1]}`,
        value:
          enemy.displayBars ||
          `❤️ **${eHP}/${enemy.maxHp}**\n⚡ **${enemy.energy}/100**`,
        inline: false,
      },
      {
        // ✅ FIX: Rename to Turn X
        name: `📝 Round ${turn}`,
        value: `${logText}`,
        inline: false,
      }
    )
    .setFooter({ text: `Battle in progress... ${turn}/25 Rounds` });

  const files = [];

  if (imageBuffer) {
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "battle_vs.png",
    });
    embed.setImage("attachment://battle_vs.png");
    files.push(attachment);
  } else {
    if (enemy.image) embed.setImage(enemy.image);
    if (player.image) embed.setThumbnail(player.image);
  }

  return { embed, files, buffer: imageBuffer };
};
