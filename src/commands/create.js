const { UserContainer, Inventory } = require("../db");
const { starterChoice } = require("../starter/starterChoice");

async function createAccount(message) {
  try {
    const userId = message.author.id;

    let existing = await UserContainer.findOne({ userId });
    if (existing) {
      return message.reply("You already have an account.");
    }

    await UserContainer.create({
      userId,
      gold: 5000,
      gem: 100,
      stam: 70,
      stamCap: 70,
      level: 1,
      xp: 0,
      pity: 0,
      lastHourly: null,
      selectedCard: null,
    });

    await Inventory.create({
      userId,
      items: [{ itemId: "ticket", amount: 10 }],
    });

    message.reply("Your profile has been created successfully!");
    await starterChoice(message);
  } catch (err) {
    console.error("Create error:", err);
    message.reply("Something exploded on the server.");
  }
}

module.exports = { createAccount };
