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
            "`!id` — Show your Discord ID\n`!start` — Check account status\n`!create` — Create your profile",
          inline: false,
        },
        {
          name: "Profile / Account",
          value:
            "`!gold` — Check gold\n`!stam` — Check stamina\n`!inv` - Check Inventory\n`!profile` — Check profile\n`!select` — Select card from your inventory\n",
          inline: false,
        },
        {
          name: "Economy",
          value: "`!hourly` — Claim hourly gold",
          inline: false,
        },
        {
          name: "Leveling",
          value:
            "`!addxp <amount>` — Add XP (admin/debug)\n`!level` — Show your level & XP",
          inline: false,
        },
        {
          name: "Index (global)",
          value:
            "`!index` — List all Characters\n`!info <cardId>` — Show global card information",
          inline: false,
        },
        { name: "Notes", value: "aaa", inline: false }
      )
      .setFooter({
        text: "Tip: For more help, join the offical server. idsjfsiuf",
      })
      .setTimestamp();

    // Try DMing the user
    await message.author.send({ embeds: [helpEmbed] });

    // Optional: acknowledge in channel so they don't think nothing happened
    return message.reply(
      "I DMed you the help menu. Check your DMs (or enable DMs from server members)."
    );
  } catch (err) {
    console.error("Help DM failed:", err);
    // Could be DMs disabled or blocked the bot
    return message.reply(
      "I couldn't DM you — your DMs might be closed. Here's the short list:\n`!help` requires open DMs."
    );
  }
}
module.exports = {help}