const { UserContainer } = require("../db");
const {goldIcon} = require("../commands/hourly_daily_weekly")
async function gold(message) {
  try {
    const userId = message.author.id;
    let existing = await UserContainer.findOne({ userId });
    if (existing) {
      message.reply(`You currently have **${existing.gold}** ${goldIcon}.`);
    } else {
      message.reply(
        "You dont have an account! Type ```!create``` to create an account"
      );
    }
  } catch (error) {
    message.reply(`error!`);
  }
}
async function pity(message) {
  try {
    const userId = message.author.id;
    let existing = await UserContainer.findOne({ userId });
    if (existing) {
      message.reply(`You are currently at **${existing.pity}** pity.`);
    } else {
      message.reply(
        "You dont have an account! Type ```!create``` to create an account"
      );
    }
  } catch (error) {
    message.reply(`error!`);
  }
}
async function gem(message) {
  try {
    const userId = message.author.id;
    let existing = await UserContainer.findOne({ userId });
    if (existing) {
      message.reply(`You currently have **${existing.gem}** 💎.`);
    } else {
      message.reply(
        "You dont have an account! Type ```!create``` to create an account"
      );
    }
  } catch (error) {
    message.reply(`error!`);
  }
}
module.exports = { gold, pity, gem };
