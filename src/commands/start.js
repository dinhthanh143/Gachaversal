const { UserContainer } = require("../db");

async function start(message) {
  try {
    const userId = message.author.id;
    let existing = await UserContainer.findOne({ userId });

    if (existing) {
      message.reply(
        `You already have an account with the id: ${existing.userId}`
      );
    } else {
      message.reply(
        "You don't have an account! Type `!create` to create one."
      );
    }
  } catch (error) {
    console.error("Start error:", error);
    message.reply("error!");
  }
}

module.exports = { start };
