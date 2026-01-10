const { createCanvas, loadImage } = require("canvas");

// --- CONFIG: Background Image Pool ---
const backgroundPool = [
  "https://res.cloudinary.com/pachi/image/upload/v1768001898/Gemini_Generated_Image_lr51t7lr51t7lr51_dgzrbu.png", // Index 0
  "https://res.cloudinary.com/pachi/image/upload/v1768036218/unnamed_ljzdfw.jpg", // Index 1
  "https://res.cloudinary.com/pachi/image/upload/v1768043915/unnamed_p5a1ce.jpg", // Index 2
  "https://res.cloudinary.com/pachi/image/upload/v1768044346/unnamed_a8bqnm.jpg", // Index 3
  "https://res.cloudinary.com/pachi/image/upload/v1768044052/unnamed_kqpvrk.jpg"  // Index 4
];

// Helper to get total background count (useful for your main bot code)
const getBgPoolSize = () => backgroundPool.length;


/**
 * Draws the Raid Matchup Image
 * @param {Array} teamImages - Array of URLs for team units
 * @param {string} bossImage - URL for boss unit
 * @param {number|null} [persistentBgIndex=null] - OPTIONAL. The specific index of the background to use (0-4). If null, picks randomly.
 */
async function drawRaidCanvas(teamImages, bossImage, persistentBgIndex = null) {
  const width = 830;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // --- 1. Background Selection Logic ---
  let bgIndexToUse;

  // Check if a valid persistent index was passed from the main bot code
  if (persistentBgIndex !== null && Number.isInteger(persistentBgIndex) && persistentBgIndex >= 0 && persistentBgIndex < backgroundPool.length) {
      // Use the specific one requested to maintain consistency
      bgIndexToUse = persistentBgIndex;
  } else {
      // Fallback: If no specific index provided, pick a random one now.
      // (This will change on every call if you rely only on this fallback!)
      bgIndexToUse = Math.floor(Math.random() * backgroundPool.length);
  }

  const selectedBgUrl = backgroundPool[bgIndexToUse];

  try {
    const bg = await loadImage(selectedBgUrl);
    ctx.drawImage(bg, 0, 0, width, height);
  } catch (e) {
    console.error(`Error loading background image (Index ${bgIndexToUse}), using fallback color:`, e.message);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);
  }

  // --- CONFIG: Card Dimensions ---
  const cardW = 135;
  const cardH = 210;
  const r = 10; // Corner radius

  // Helper to draw a fancy card
  const drawFancyCard = (img, x, y, borderColor = "#FFD700") => {
      ctx.save();

      // Shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // Path for Rounded Rectangle
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + cardW - r, y);
      ctx.quadraticCurveTo(x + cardW, y, x + cardW, y + r);
      ctx.lineTo(x + cardW, y + cardH - r);
      ctx.quadraticCurveTo(x + cardW, y + cardH, x + cardW - r, y + cardH);
      ctx.lineTo(x + r, y + cardH);
      ctx.quadraticCurveTo(x, y + cardH, x, y + cardH - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      // Clip & Draw Image
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, x, y, cardW, cardH);
      ctx.restore();

      // Draw Border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
  };

  // --- 2. Team Images (Top Row) ---
  const validTeamImages = teamImages.filter((img) => img);
  const teamSize = validTeamImages.length;
  const gap = 25;
  const topY = 40;

  if (teamSize > 0) {
    const totalRowWidth = (teamSize * cardW) + ((teamSize - 1) * gap);
    const startX = (width - totalRowWidth) / 2;

    for (let i = 0; i < teamSize; i++) {
      try {
        const img = await loadImage(validTeamImages[i]);
        const currentX = startX + (i * (cardW + gap));

        drawFancyCard(img, currentX, topY, "#047ccc"); // Blue/Gold Border
      } catch (e) {
        console.error(`Failed to load team image ${i}:`, e.message);
      }
    }
  }

  // --- 3. Boss/Mega Unit (Bottom Row) ---
  const bottomY = height - cardH - 40; // 40px padding from bottom
  const bossX = (width - cardW) / 2;   // Perfectly centered

  if (bossImage) {
    try {
      const bImg = await loadImage(bossImage);
      // Red Border for the "Enemy/Boss" look
      drawFancyCard(bImg, bossX, bottomY, "#ff4444");
    } catch (e) {
      console.error("Failed to load boss image:", e.message);
    }
  }

  // --- 4. "VS" Text (Middle Overlay) ---
  const middleY = (topY + cardH + bottomY) / 2 + 10;

  ctx.save();
  ctx.shadowColor = "black";
  ctx.shadowBlur = 10;
  ctx.font = "bold italic 60px Verdana";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.lineWidth = 6;
  ctx.strokeStyle = "black";
  ctx.strokeText("VS", width / 2, middleY);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("VS", width / 2, middleY);
  ctx.restore();

  return canvas.toBuffer();
}

// Export the helper too so your main bot knows how many backgrounds exist
module.exports = { drawRaidCanvas, getBgPoolSize };