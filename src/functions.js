const {Cards} = require("./db")
function getRarityStars(rarity) {
  if(rarity === 6){
    return "<:rarity_ultra:1447882692631724115>"
  }
  const filled = "<:rarity_star:1447272994610348244>".repeat(rarity);
  return filled;
}

function getThreatRarity(rarity) {
  if(rarity === 4){
    return "👹"
  }
  const filled = "💀".repeat(rarity);
  return filled;
}

function wrapSkillDescription(text, maxLetters = 42) {
  const words = text.split(" ");
  let currentLine = "";
  let currentCount = 0;
  let wrappedText = "";

  for (const word of words) {
    const letterCount = [...word].filter((ch) => /[a-zA-Z]/.test(ch)).length;

    if (currentCount + letterCount > maxLetters) {
      wrappedText += currentLine.trim() + "\n";
      currentLine = word + " ";
      currentCount = letterCount;
    } else {
      currentLine += word + " ";
      currentCount += letterCount;
    }
  }
  wrappedText += currentLine.trim();
  return wrappedText;
}

// MAIN LOGIC: Injects the correct number based on Rarity (1-6)
function getSkillDescription(skillData, rarity) {
  // 1. Safety check: If no values exist, return raw text
  if (!skillData.values || skillData.values.length === 0) {
      return wrapSkillDescription(skillData.description);
  }

  // 2. Determine Array Index (Star 1 = Index 0, Star 6 = Index 5)
  // We clamp it so a 7-star card doesn't crash the bot
  let index = (rarity || 1) - 1; 
  if (index < 0) index = 0;
  if (index >= skillData.values.length) index = skillData.values.length - 1;

  // 3. Get the value
  const val = skillData.values[index];

  // 4. Replace {0} with the value
  const rawText = skillData.description.replace("{0}", val);

  // 5. Wrap the result
  return wrapSkillDescription(rawText);
}


async function getNextUid(userId) {
  // 1. Get all used UIDs for this user, sorted
  const cards = await Cards.find({ ownerId: userId }).select("uid").sort({ uid: 1 });
  
  // 2. Iterate to find the first gap
  let expected = 1;
  for (const card of cards) {
    if (card.uid && card.uid === expected) {
      expected++;
    } else if (card.uid && card.uid > expected) {
      // Found a gap! (e.g. card.uid is 4, but we expected 3)
      return expected;
    }
  }
  return expected; 
}

module.exports = {
  getRarityStars,
  wrapSkillDescription,
  getSkillDescription,
  getThreatRarity,
  getNextUid
};
