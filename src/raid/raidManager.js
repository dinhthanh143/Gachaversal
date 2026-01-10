const { UserContainer, Cards } = require("../db");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { drawRaidCanvas } = require("./raidCanva");
async function getUserTotalPower(userId) {
    const user = await UserContainer.findOne({ userId });
    if (!user || !user.team) return 0;

    const uids = user.team.filter(u => u !== null);
    if (uids.length === 0) return 0;

    // Fetch stats of equipped cards
    const cards = await Cards.find({ uid: { $in: uids }, ownerId: userId });
    
    // Sum stats
    const totalStats = { hp: 0, atk: 0, def: 0, speed: 0 };
    cards.forEach(c => {
        totalStats.hp += c.stats.hp;
        totalStats.atk += c.stats.atk;
        totalStats.def += c.stats.def;
        totalStats.speed += c.stats.speed;
    });

    return calculateTeamPower(totalStats);
}
// ✅ NEW: Power Level Calculation
function calculateTeamPower(stats) {
    // Formula: (HP / 5) + ATK + DEF + (Speed * 5)
    // HP is divided to prevent it from inflating the score too much.
    // Speed is multiplied because turn order is critical.
    const score = Math.floor(
        (stats.hp / 5) + 
        stats.atk + 
        stats.def + 
        (stats.speed * 5)
    );
    return score;
}

async function createMegaCard(message) {
  const userId = message.author.id;

  try {
    const user = await UserContainer.findOne({ userId });
    if (!user) return message.reply("❌ User profile not found.");

    // 1. Get Team UIDs
    const teamUids = user.team.filter((uid) => uid !== null);
    if (teamUids.length === 0) {
      return message.reply("⚠️ Your team is empty! Use `!teamset [uid]` to add cards.");
    }

    // 2. Fetch Card Data
    const cards = await Cards.find({
      ownerId: userId,
      uid: { $in: teamUids },
    }).populate("masterData");

    const cardMap = new Map();
    cards.forEach((c) => cardMap.set(c.uid, c));

    // 3. Prepare Data (Stats & Skills)
    const teamImages = [];
    const megaStats = { hp: 0, atk: 0, def: 0, speed: 0 };
    let skillDisplayString = "";

    // Loop through the team slots
    for (let i = 0; i < user.team.length; i++) {
      const uid = user.team[i];
      if (uid === null) continue;

      const card = cardMap.get(uid);
      if (!card || !card.masterData) continue;

      // -- A. Sum Stats --
      megaStats.hp += card.stats.hp;
      megaStats.atk += card.stats.atk;
      megaStats.def += card.stats.def;
      megaStats.speed += card.stats.speed;

      // -- B. Collect Image --
      if (card.masterData.image) {
        teamImages.push(card.masterData.image);
      }

      // -- C. Format Skill Description --
      const master = card.masterData;
      let desc = master.skill.description;

      if (master.skill.values && master.skill.values.length > 0) {
        const rarityIndex = Math.max(0, card.rarity - 1);

        master.skill.values.forEach((valueArray, index) => {
          if (Array.isArray(valueArray) && valueArray.length > 0) {
            const val = valueArray[rarityIndex] !== undefined 
              ? valueArray[rarityIndex] 
              : valueArray[valueArray.length - 1];

            const regex = new RegExp(`\\{${index}\\}`, "g");
            desc = desc.replace(regex, val);
          }
        });
      }

      skillDisplayString += `**${i + 1}. ${master.name}**\n⚡ ${master.skill.name}: ${desc}\n\n`;
    }

    // ✅ 4. CALCULATE POWER
    const teamPower = calculateTeamPower(megaStats);

    // 5. Generate Image
    const bossImage = teamImages.length > 0 ? teamImages[0] : null;
    const imageBuffer = await drawRaidCanvas(teamImages, bossImage);
    const attachment = new AttachmentBuilder(imageBuffer, { name: "raid-matchup.png" });

    // 6. Build Embed
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ RAID PARTY ASSEMBLED (CP: ${teamPower.toLocaleString()})`)
      .setColor("#FF4500")
      .addFields({
        name: "🛡️ Mega-Unit Stats (Combined)",
        value: `🩸 **HP:** ${megaStats.hp.toLocaleString()}\n` +
               `⚔️ **ATK:** ${megaStats.atk.toLocaleString()}\n` +
               `🛡️ **DEF:** ${megaStats.def.toLocaleString()}\n` +
               `💨 **SPD:** ${megaStats.speed.toLocaleString()}\n` +
               `💥 **Combat Power:** ${teamPower.toLocaleString()}`, // Added here too
        inline: false
      })
      .setDescription(`**📜 Team Abilities:**\n${skillDisplayString}`)
      .setImage("attachment://raid-matchup.png")
      .setFooter({ text: `Team Size: ${teamImages.length} | Power Formula: (HP/5)+ATK+DEF+(SPD*5)` });

    return message.reply({ embeds: [embed], files: [attachment] });

  } catch (err) {
    console.error(err);
    message.reply("❌ Error creating Raid Card.");
  }
}

module.exports = { createMegaCard, calculateTeamPower,getUserTotalPower };