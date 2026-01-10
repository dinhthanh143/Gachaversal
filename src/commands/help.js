const { EmbedBuilder } = require("discord.js");

async function help(message) {
  try {
    const helpEmbed = new EmbedBuilder()
      .setTitle("🧾 pachi's bot — Command List")
      .setColor(0x7dd3fc) // soft blue
      .setDescription(
        "Here are the available commands. I've put them in neat categories so your brain has a chance.\n**Default prefix:** !"
      )
      .addFields(
        {
          name: "General",
          value:
            "`!id` — Show your Discord ID\n`!create` — Create your profile\n`!quest` — View your current quests",
          inline: false,
        },
        {
          name: "Profile / Account",
          value:
            "`!profile` — Check profile stats\n`!level` — Check level & XP\n`!gold` — Check gold\n`!gem` — Check gems\n`!stam` — Check stamina\n`!pity` — Check gacha pity",
          inline: false,
        },
        {
          name: "Collection & Inventory",
          value:
            "`!cards` — View your cards\n`!inv` — Check Inventory\n`!view <uid>` — View specific card details\n`!select <uid>` — Select main card\n`!fav <uid>` — Favorite a card\n`!ascend <uid>` — Ascend a card\n`!useitem <id> <amount>` — Use an item",
          inline: false,
        },
        {
          name: "Economy & Shop",
          value:
            "`!hourly` — Claim hourly reward\n`!daily` — Claim daily reward\n`!weekly` — Claim weekly reward\n`!shop` — Open the shop\n`!buy <id> <qty>` — Buy items\n`!trade @user` — Start a trade",
          inline: false,
        },
        {
          name: "Gacha",
          value: "`!gacha` — View banners and pull for characters",
          inline: false,
        },
        {
          name: "Dungeon & Combat",
          value:
            "`!dungeon` — Open Dungeon Hub\n`!area <id>` — Select an area\n`!stage <id>` — Select a stage\n`!battle` — Start a battle\n`!sbt <amount>` — Skip battle (requires stamina)\n`!next` — Move to the next stage",
          inline: false,
        },
        {
          name: "Raids & Teams",
          value:
            "`!createraid` — Summon a Raid Boss\n`!raid lobby` — View active raids\n`!raid join <id>` — Join a raid\n`!raid battle` — Fight the boss (uses Entry)\n`!team` — View your raid team\n`!teamset <uid> <slot>` — Add card to team\n`!teamremove <slot>` — Remove card from team",
          inline: false,
        },
        {
          name: "Index (Global)",
          value:
            "`!index` — List all Characters\n`!info <cardId>` — Show global card information",
          inline: false,
        }
      )
      .setFooter({
        text: "Tip: For more help, join the official server.",
      })
      .setTimestamp();

    // Try DMing the user
    await message.author.send({ embeds: [helpEmbed] });

    // Optional: acknowledge in channel so they don't think nothing happened
    return message.reply(
      "I DMed you the help menu. Check your DMs."
    );
  } catch (err) {
    console.error("Help DM failed:", err);
    // Could be DMs disabled or blocked the bot
    return message.reply(
      "I couldn't DM you — your DMs might be closed. Please enable DMs to see the command list."
    );
  }
}

module.exports = { help };