const { UserContainer } = require("../db");
async function stam(message) {
  try {
    const userId = message.author.id;
    let existing = await UserContainer.findOne({ userId });
    if (existing) {
      message.reply(
        `You currently have **${existing.stam}/${existing.stamCap}** stamina.`
      );
    } else {
      message.reply(
        "You dont have an account! Type ```!create``` to create an account"
      );
    }
  } catch (error) {
    message.reply(`error!`);
  }
}

async function guaranteed(message) {
  try {
    const userId = message.author.id;
    let existing = await UserContainer.findOne({ userId });
    if (existing) {
      message.reply(
        `You currently have **${existing.guaranteed}** gua.`
      );
    } else {
      message.reply(
        "You dont have an account! Type ```!create``` to create an account"
      );
    }
  } catch (error) {
    message.reply(`error!`);
  }
}

module.exports = { stam, guaranteed };
