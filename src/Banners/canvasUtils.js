const { createCanvas, loadImage, registerFont } = require("canvas");
// Make sure this path points to where you actually exported formatImage!
const { formatImage } = require("../commands/infoCard");

// Configuration for 10-Pull Grid
const CARD_WIDTH = 180;
const CARD_HEIGHT = 280;
const GAP = 25;
const COLS = 5;
const ROWS = 2;

// Star Icons
const STAR_ICON_URL =
  "https://res.cloudinary.com/pachi/image/upload/v1766563921/rarity_star_fl2byc.png";
const STAR_ICON_URL_6 =
  "https://res.cloudinary.com/pachi/image/upload/v1767565212/rarity_ultra_tldjnx.png";
const STAR_SIZE = 24;
const STAR_GAP = 2;
const BG_IMAGE_URL_10 =
  "https://res.cloudinary.com/pachi/image/upload/v1767564712/f8de3a2cf2e6608840a63dc24ca17d96_b1nayv.jpg";
// Result Background (Shared)
const BG_IMAGE_URL =
  "https://res.cloudinary.com/pachi/image/upload/v1766586884/b3371446a6ba08b6469bb8863d0a4517_apv3y7.jpg";
// 10-Pull Canvas Dimensions
const GRID_WIDTH = CARD_WIDTH * COLS + GAP * (COLS + 1);
const GRID_HEIGHT = CARD_HEIGHT * ROWS + GAP * (ROWS + 1);

const RARITY_COLORS = {
  6: "#dcecf2",
  5: "#FFD700",
  4: "#A020F0",
  3: "#1E90FF",
  2: "#808080",
  1: "#FFFFFF",
};

// --- HELPER: Draw a single card at x,y ---
async function drawCardOnCanvas(ctx, card, x, y, starImg, starImg6) {
  try {
    // 1. Format and Load Image
    let imgUrl = formatImage(card.image, CARD_WIDTH, CARD_HEIGHT);

    if (!imgUrl) {
      imgUrl = "https://via.placeholder.com/180x280?text=No+Image";
    }

    const charImg = await loadImage(imgUrl);
    ctx.drawImage(charImg, x, y, CARD_WIDTH, CARD_HEIGHT);

    // 2. Draw Border (Custom Logic for 6-Star)
    ctx.lineWidth = 7;
    const rarity = card.rarity || 1;

    if (rarity === 6) {
      // ✅ 6-STAR EXCLUSIVE: Vertical Gradient
      const gradient = ctx.createLinearGradient(x, y, x, y + CARD_HEIGHT);
      gradient.addColorStop(0, "#D0F0FF"); // Top
      gradient.addColorStop(0.5, "#4DA6FF"); // Middle
      gradient.addColorStop(1, "#7F00FF"); // Bottom
      ctx.strokeStyle = gradient;
    } else {
      // Standard Solid Color for 1-5 Stars
      ctx.strokeStyle = RARITY_COLORS[rarity] || "#FFFFFF";
    }

    ctx.strokeRect(x, y, CARD_WIDTH, CARD_HEIGHT);

    // 3. Footer Background
    const footerHeight = 35;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(x, y + CARD_HEIGHT - footerHeight, CARD_WIDTH, footerHeight);

    // 4. Draw Stars
    if (rarity === 6) {
      // ✅ 6-STAR EXCLUSIVE: Draw Single 6-Star Icon
      if (starImg6) {
        const startX = x + (CARD_WIDTH - STAR_SIZE) / 2;
        const startY =
          y + CARD_HEIGHT - footerHeight + (footerHeight - STAR_SIZE) / 2;
        ctx.drawImage(starImg6, startX, startY, STAR_SIZE, STAR_SIZE);
      } else {
        // Fallback if image fails
        ctx.fillStyle = RARITY_COLORS[rarity];
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          "★",
          x + CARD_WIDTH / 2,
          y + CARD_HEIGHT - 8
        );
      }
    } else if (starImg) {
      // Standard 1-5 Star Logic
      const totalWidth = rarity * STAR_SIZE + (rarity - 1) * STAR_GAP;
      let startX = x + (CARD_WIDTH - totalWidth) / 2;
      const startY =
        y + CARD_HEIGHT - footerHeight + (footerHeight - STAR_SIZE) / 2;

      for (let s = 0; s < rarity; s++) {
        ctx.drawImage(starImg, startX, startY, STAR_SIZE, STAR_SIZE);
        startX += STAR_SIZE + STAR_GAP;
      }
    } else {
      // Fallback if standard star image fails
      ctx.fillStyle = RARITY_COLORS[rarity] || "#FFFFFF";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        "★".repeat(rarity),
        x + CARD_WIDTH / 2,
        y + CARD_HEIGHT - 8
      );
    }
  } catch (e) {
    console.error("Card Draw Error:", e);
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
  }
}

/**
 * Draws a 2x5 grid of pulled cards.
 */
async function generateTenPullImage(cards) {
  const canvas = createCanvas(GRID_WIDTH, GRID_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Load Stars
  let starImg = null;
  let starImg6 = null;
  try {
    starImg = await loadImage(STAR_ICON_URL);
    starImg6 = await loadImage(STAR_ICON_URL_6);
  } catch (e) {}

  // ✅ FIXED: Draw Background Image instead of solid color
  try {
    const bgImg = await loadImage(BG_IMAGE_URL_10);
    // Scale bg to cover entire grid
    ctx.drawImage(bgImg, 0, 0, GRID_WIDTH, GRID_HEIGHT);
  } catch (e) {
    // Fallback if background fails
    ctx.fillStyle = "#2b2d31";
    ctx.fillRect(0, 0, GRID_WIDTH, GRID_HEIGHT);
  }

  for (let i = 0; i < cards.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = GAP + col * (CARD_WIDTH + GAP);
    const y = GAP + row * (CARD_HEIGHT + GAP);
    await drawCardOnCanvas(ctx, cards[i], x, y, starImg, starImg6);
  }

  return canvas.toBuffer("image/png");
}

/**
 * Draws a SINGLE card centered on a custom background.
 */
async function generateSinglePullImage(card) {
  // 800x450 is a good 16:9 ratio for the background
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext("2d");

  // 1. Draw Background
  try {
    const bgImg = await loadImage(BG_IMAGE_URL);
    ctx.drawImage(bgImg, 0, 0, 800, 450);
  } catch (e) {
    ctx.fillStyle = "#2b2d31";
    ctx.fillRect(0, 0, 800, 450);
  }

  // 2. Load Stars
  let starImg = null;
  let starImg6 = null;
  try {
    starImg = await loadImage(STAR_ICON_URL);
    starImg6 = await loadImage(STAR_ICON_URL_6);
  } catch (e) {}

  // 3. Center the Card
  const centerX = (800 - CARD_WIDTH) / 2;
  const centerY = (450 - CARD_HEIGHT) / 2;

  // 4. Draw Shadow/Glow
  ctx.shadowColor = "black";
  ctx.shadowBlur = 20;

  // 5. Draw the Card
  await drawCardOnCanvas(ctx, card, centerX, centerY, starImg, starImg6);

  return canvas.toBuffer("image/png");
}

async function generateBannerImage(characterImageUrl) {
  const width = 700;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  try {
    const bgUrl =
      "https://res.cloudinary.com/pachi/image/upload/v1766735490/74852874043_hxivry.png";
    const background = await loadImage(bgUrl);
    ctx.drawImage(background, 0, 0, width, height);

    const charImage = await loadImage(characterImageUrl);

    const paddingY = height * 0.05;
    const paddingX = width * 0.1;
    const drawWidth = width - paddingX * 2;
    const drawHeight = height - paddingY * 2;

    const hRatio = drawWidth / charImage.width;
    const vRatio = drawHeight / charImage.height;
    const ratio = Math.min(hRatio, vRatio);

    const finalWidth = charImage.width * ratio;
    const finalHeight = charImage.height * ratio;

    const centerX = (width - finalWidth) / 2;
    const centerY = (height - finalHeight) / 2;

    ctx.drawImage(charImage, centerX, centerY, finalWidth, finalHeight);

    ctx.save();
    ctx.font = 'bold 60px "Arial"';
    ctx.textAlign = "center";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;
    ctx.strokeText("RATE UP!", width / 2, height - 40);
    ctx.fillStyle = "#FFD700";
    ctx.fillText("RATE UP!", width / 2, height - 40);
    ctx.restore();

    return canvas.toBuffer();
  } catch (error) {
    console.error("Canvas Error:", error);
    return null;
  }
}

module.exports = {
  generateTenPullImage,
  generateSinglePullImage,
  generateBannerImage,
};