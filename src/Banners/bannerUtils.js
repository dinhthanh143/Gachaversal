const { SBanner, Index } = require("../db");

async function getFeaturedBanner() {
  const now = Date.now();
  const EIGHT_HOURS = 3 * 60 * 60 * 1000;

  let bannerState = await SBanner.findOne({ id: "current_banner" });

  // Check if banner is missing OR expired
  if (!bannerState || now > new Date(bannerState.nextReset).getTime()) {
    console.log("🔄 Banner expired. Rotating...");
    // Rotate and return the new state
    return await rotateBanner(bannerState, EIGHT_HOURS);
  }

  return bannerState;
}

async function rotateBanner(oldState, duration) {
  // A. Fetch all characters
  const allChars = await Index.find({});
  if (allChars.length === 0) return null; 

  // B. Filter pool to avoid repeat of the exact previous character
  let pool = allChars;
  if (oldState && oldState.cardId) {
    pool = allChars.filter(c => c.pokeId !== oldState.cardId);
  }
  
  // Safety fallback if pool is empty
  if (pool.length === 0) pool = allChars;

  // C. Pick Random Character
  const randomChar = pool[Math.floor(Math.random() * pool.length)];

  // ============================================================
  // 🕒 TIME CALCULATION FIX (Schedule Alignment)
  // ============================================================
  let nextResetTime;
  const now = Date.now();

  if (oldState && oldState.nextReset) {
    // Start calculation from when it was SUPPOSED to reset
    let calculatedTime = new Date(oldState.nextReset).getTime();

    // If the bot was offline for a long time (e.g. 20 hours), 
    // keep adding 8-hour chunks until we find the *next* future slot.
    // Example: Old Reset 12:00. Now is 22:00 (10h later).
    // Loop 1: 12:00 + 8h = 20:00 (Still < 22:00)
    // Loop 2: 20:00 + 8h = 04:00 Next Day (Future! Stop here.)
    // Result: The banner will expire at 04:00, showing 6 hours remaining.
    while (calculatedTime <= now) {
      calculatedTime += duration;
    }
    nextResetTime = calculatedTime;
  } else {
    // First run ever: Start from Now + Duration
    nextResetTime = now + duration;
  }

  const nextReset = new Date(nextResetTime);

  // D. Save to DB 
  const newState = await SBanner.findOneAndUpdate(
    { id: "current_banner" },
    { 
      cardId: randomChar.pokeId, 
      nextReset: nextReset 
    },
    { upsert: true, new: true } 
  );

  return newState;
}

module.exports = { getFeaturedBanner };