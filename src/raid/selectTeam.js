const { UserContainer, Cards } = require("../db");

async function teamset(message) {
  const args = message.content.split(" ");
  const cardUid = parseInt(args[1]);
  const targetSlot = parseInt(args[2]); // Optional 3rd argument
  const userId = message.author.id;

  if (isNaN(cardUid)) {
    return message.reply(
      "⚠️ Please provide a valid Card UID. Usage: `!teamset [card_index] [slot]`"
    );
  }

  try {
    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("❌ User not found.");

    // ✅ CHECK: Block if user is in a Raid
    if (user.inRaid) {
        return message.reply("⚠️ You cannot modify your team while in a Raid! Please leave the raid first.");
    }

    // Initialize team if missing
    if (!user.team || user.team.length === 0) {
      user.team = [null, null, null, null];
    }

    // 1. Verify Ownership
    const card = await Cards.findOne({ ownerId: userId, uid: cardUid }).populate(
      "masterData"
    );

    if (!card) {
      return message.reply(`❌ You don't own a card with Index **#${cardUid}**.`);
    }

    // 2. Check for Duplicates (Card already in team?)
    if (user.team.includes(cardUid)) {
      return message.reply("⚠️ This card is already in your team!");
    }

    let finalSlotIndex = -1;

    // 3. Logic: Specific Slot vs Auto-Fill
    if (!isNaN(targetSlot)) {
      if (targetSlot < 1 || targetSlot > 4) {
        return message.reply("⚠️ Slot number must be between **1 and 4**.");
      }

      const arrayIndex = targetSlot - 1;

      if (user.team[arrayIndex] !== null) {
        return message.reply(
          `🚫 **Slot ${targetSlot} is occupied!**\nPlease use \`!teamremove ${targetSlot}\` first.`
        );
      }

      finalSlotIndex = arrayIndex;
    } else {
      finalSlotIndex = user.team.findIndex((slot) => slot === null);

      if (finalSlotIndex === -1) {
        return message.reply(
          "🚫 **Your team is full (4/4)!**\nUse `!teamremove [slot]` to free up space, or specify a slot: `!teamset [uid] [slot]`."
        );
      }
    }

    // 4. Set the card
    user.team[finalSlotIndex] = cardUid;

    user.markModified("team");
    await user.save();

    const cardName = card.masterData ? card.masterData.name : "Card";
    return message.reply(
      `✅ **Set Successful!**\nAdded **${cardName}** (Index: #${cardUid}) to Team Slot **${
        finalSlotIndex + 1
      }**.`
    );
  } catch (err) {
    console.error(err);
    message.reply("❌ Error setting team.");
  }
}

async function teamremove(message) {
  const args = message.content.split(" ");
  const slotNum = parseInt(args[1]);
  const userId = message.author.id;

  if (isNaN(slotNum) || slotNum < 1 || slotNum > 4) {
    return message.reply(
      "⚠️ Please specify a valid slot (1-4). Usage: `!teamremove 1`"
    );
  }

  try {
    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("❌ User not found.");

    // ✅ CHECK: Block if user is in a Raid
    if (user.inRaid) {
        return message.reply("⚠️ You cannot modify your team while in a Raid! Please leave the raid first.");
    }

    if (!user.team || user.team.length === 0) {
      user.team = [null, null, null, null];
    }

    const arrayIndex = slotNum - 1;
    if (user.team[arrayIndex] === null) {
      return message.reply(`⚠️ Slot **${slotNum}** is already empty.`);
    }

    const removedUid = user.team[arrayIndex];
    user.team[arrayIndex] = null;

    user.markModified("team");
    await user.save();

    return message.reply(
      `✅ **Removed!**\nCleared **UID: ${removedUid}** from Team Slot **${slotNum}**.`
    );
  } catch (err) {
    console.error(err);
    message.reply("❌ Error removing from team.");
  }
}

/**
 * Resets the user's team.
 * Can be called by a User Command (message object) OR Internally (userId string).
 */
async function teamReset(input) {
  let userId;
  let isCommand = false;

  // Check if input is a Discord Message (has .author.id) or just a String (UserId)
  if (input && input.author && input.author.id) {
    userId = input.author.id;
    isCommand = true; // User typed !resetteam
  } else {
    userId = input; // Internal call, input is the ID string
    isCommand = false;
  }

  try {
    const user = await UserContainer.findOne({ userId });
    
    // If internal and user not found, just return silently
    if (!user) {
      if (isCommand) return input.reply("❌ User not found.");
      return; 
    }

    // ✅ CHECK: Block if user is in a Raid (Only if it's a command)
    // We assume internal calls (isCommand = false) are system logic that might need to bypass this.
    if (isCommand && user.inRaid) {
        return input.reply("⚠️ You cannot modify your team while in a Raid! Please leave the raid first.");
    }

    // Reset the team array
    user.team = [null, null, null, null];
    
    user.markModified("team");
    await user.save();

    // Only reply if it was triggered by a command
    if (isCommand) {
      return input.reply(
        "✅ **Team Reset Successful!**\nAll team slots have been cleared."
      );
    }
    
    // If internal, logic ends here silently (no reply)
  } catch (err) {
    console.error(err);
    if (isCommand) input.reply("❌ Error resetting team.");
  }
}

module.exports = { teamset, teamremove, teamReset };