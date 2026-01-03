// src/Gacha/canvasUtils.js
const { createCanvas, loadImage, registerFont } = require('canvas');
// Make sure this path points to where you actually exported formatImage!
// If you moved it to functions.js, change this to: require("../functions")
const { formatImage } = require("../commands/infoCard"); 

// Configuration for 10-Pull Grid
const CARD_WIDTH = 180;
const CARD_HEIGHT = 280;
const GAP = 25; 
const COLS = 5;
const ROWS = 2;

// Star Icon
const STAR_ICON_URL = "https://res.cloudinary.com/pachi/image/upload/v1766563921/rarity_star_fl2byc.png";
const STAR_SIZE = 24; 
const STAR_GAP = 2; 

// Result Background (For Single Pull)
const BG_IMAGE_URL = "https://res.cloudinary.com/pachi/image/upload/v1766586884/b3371446a6ba08b6469bb8863d0a4517_apv3y7.jpg";

// 10-Pull Canvas Dimensions
const GRID_WIDTH = (CARD_WIDTH * COLS) + (GAP * (COLS + 1));
const GRID_HEIGHT = (CARD_HEIGHT * ROWS) + (GAP * (ROWS + 1));

const RARITY_COLORS = {
    5: '#FFD700', 4: '#A020F0', 3: '#1E90FF', 2: '#808080', 1: '#FFFFFF'
};

// --- HELPER: Draw a single card at x,y ---
async function drawCardOnCanvas(ctx, card, x, y, starImg) {
    try {
        // ✅ UPDATED: Use formatImage here
        // This ensures Cloudinary crops the image to 180x280 BEFORE loading it
        let imgUrl = formatImage(card.image, CARD_WIDTH, CARD_HEIGHT);

        // Fallback if URL is null
        if (!imgUrl) {
            imgUrl = "https://via.placeholder.com/180x280?text=No+Image";
        }

        const charImg = await loadImage(imgUrl);
        ctx.drawImage(charImg, x, y, CARD_WIDTH, CARD_HEIGHT);

        // Border
        const rarityColor = RARITY_COLORS[card.rarity] || '#FFFFFF';
        ctx.lineWidth = 7;
        ctx.strokeStyle = rarityColor;
        ctx.strokeRect(x, y, CARD_WIDTH, CARD_HEIGHT);

        // Footer
        const footerHeight = 35;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y + CARD_HEIGHT - footerHeight, CARD_WIDTH, footerHeight);

        // Stars
        if (starImg) {
            const rarity = card.rarity || 1;
            const totalWidth = (rarity * STAR_SIZE) + ((rarity - 1) * STAR_GAP);
            let startX = x + (CARD_WIDTH - totalWidth) / 2;
            const startY = y + CARD_HEIGHT - footerHeight + (footerHeight - STAR_SIZE) / 2;

            for (let s = 0; s < rarity; s++) {
                ctx.drawImage(starImg, startX, startY, STAR_SIZE, STAR_SIZE);
                startX += STAR_SIZE + STAR_GAP;
            }
        } else {
            ctx.fillStyle = rarityColor;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("★".repeat(card.rarity), x + (CARD_WIDTH / 2), y + CARD_HEIGHT - 8);
        }
    } catch (e) {
        console.error("Card Draw Error:", e);
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
    }
}

/**
 * Draws a 2x5 grid of pulled cards.
 */
async function generateTenPullImage(cards) {
    const canvas = createCanvas(GRID_WIDTH, GRID_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Load Star
    let starImg = null;
    try { starImg = await loadImage(STAR_ICON_URL); } catch (e) {}

    // Dark background
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, GRID_WIDTH, GRID_HEIGHT);

    for (let i = 0; i < cards.length; i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = GAP + (col * (CARD_WIDTH + GAP));
        const y = GAP + (row * (CARD_HEIGHT + GAP));
        await drawCardOnCanvas(ctx, cards[i], x, y, starImg);
    }

    return canvas.toBuffer('image/png');
}

/**
 * Draws a SINGLE card centered on a custom background.
 */
async function generateSinglePullImage(card) {
    // 800x450 is a good 16:9 ratio for the background
    const canvas = createCanvas(800, 450); 
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    try {
        const bgImg = await loadImage(BG_IMAGE_URL);
        // Draw image covering the whole canvas
        ctx.drawImage(bgImg, 0, 0, 800, 450);
    } catch (e) {
        // Fallback if background fails
        ctx.fillStyle = '#2b2d31';
        ctx.fillRect(0, 0, 800, 450);
    }

    // 2. Load Star
    let starImg = null;
    try { starImg = await loadImage(STAR_ICON_URL); } catch (e) {}

    // 3. Center the Card
    const centerX = (800 - CARD_WIDTH) / 2;
    const centerY = (450 - CARD_HEIGHT) / 2;

    // 4. Draw Shadow/Glow behind card (Optional styling)
    ctx.shadowColor = "black";
    ctx.shadowBlur = 20;
    
    // 5. Draw the Card
    await drawCardOnCanvas(ctx, card, centerX, centerY, starImg);

    return canvas.toBuffer('image/png');
}

async function generateBannerImage(characterImageUrl) {
    // Standard banner size
    const width = 700;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    try {
        // 1. Load Background
        const bgUrl = "https://res.cloudinary.com/pachi/image/upload/v1766735490/74852874043_hxivry.png"; 
        const background = await loadImage(bgUrl);
        ctx.drawImage(background, 0, 0, width, height);

        // 2. Load Character Image
        // Optional: You can also use formatImage here if you want to optimize the banner image
        // const formattedUrl = formatImage(characterImageUrl, width, height);
        const charImage = await loadImage(characterImageUrl);

        // Padding Logic (5% Y, 10% X)
        const paddingY = height * 0.05;
        const paddingX = width * 0.10;
        
        const drawWidth = width - (paddingX * 2);
        const drawHeight = height - (paddingY * 2);
        
        // Maintain Aspect Ratio to fit inside padding box
        const hRatio = drawWidth / charImage.width;
        const vRatio = drawHeight / charImage.height;
        const ratio = Math.min(hRatio, vRatio);
        
        const finalWidth = charImage.width * ratio;
        const finalHeight = charImage.height * ratio;
        
        // Center the image
        const centerX = (width - finalWidth) / 2;
        const centerY = (height - finalHeight) / 2;

        ctx.drawImage(charImage, centerX, centerY, finalWidth, finalHeight);

        // 3. Draw "RATE UP!" Text
        ctx.save();
        ctx.font = 'bold 60px "Arial"';
        ctx.textAlign = 'center';
        
        // Stroke (Outline)
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 8;
        ctx.strokeText('RATE UP!', width / 2, height - 40);
        
        // Fill (Yellow)
        ctx.fillStyle = '#FFD700'; 
        ctx.fillText('RATE UP!', width / 2, height - 40);
        
        ctx.restore();

        return canvas.toBuffer();
    } catch (error) {
        console.error("Canvas Error:", error);
        return null; 
    }
}

module.exports = { generateTenPullImage, generateSinglePullImage, generateBannerImage };