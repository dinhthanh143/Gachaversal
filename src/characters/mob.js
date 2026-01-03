const { wrapSkillDescription} = require("../functions")
const mobs = [
  {
    enemyId: "1",
    name: "Slime",
    type: "Water 💧",
    rarity: 1,
    level: 1,
    stats: {
      hp: 30,
      atk: 15,
      def: 10,
      speed: 18,
    },
    skill: {
      name: "Tackle",
      description: wrapSkillDescription("Tackles the target, dealing {0}× ATK damage."),
      values: 1.1,
    },
    image:
      "https://res.cloudinary.com/pachi/image/upload/v1766817346/Gemini_Generated_Image_a9305ba9305ba930_w4fvpt.png",
    rewards: {
      gold: 25,
      xp: 10,
      drops: [],
    },
  },
  {
    enemyId: "2",
    name: "Zombie",
    type: "Dark 🌙",
    rarity: 1,
    level: 2,
    stats: {
      hp: 35, 
      atk: 24, 
      def: 15, 
      speed: 15, 
    },
    skill: {
      name: "Rotting Bite",
      description: wrapSkillDescription("Inflicts poison on the target, dealing {0}× ATK damage every turn for 2 turns."),
      values: 0.3,
    },
    image: "https://res.cloudinary.com/pachi/image/upload/v1766817871/Gemini_Generated_Image_cvi27zcvi27zcvi2_1_sg9opw.png",
    rewards: {
      gold: 30,
      xp: 15,
      drops: [],
    },
  },
  {
    enemyId: "3",
    name: "Skeleton",
    type: "Physical ⚔️",
    rarity: 1,
    level: 3,
    stats: {
      hp: 38,    
      atk: 26,   
      def: 13,  
      speed: 21, 
    },
    skill: {
      name: "Bone Slash",
      description: wrapSkillDescription("Strikes with a rusty blade, dealing {0}× ATK damage."),
      values: 1.2, 
    },
    image: "https://res.cloudinary.com/pachi/image/upload/v1766801659/Gemini_Generated_Image_r5o1ifr5o1ifr5o1_1_fxxs6p.png", 
    rewards: {
      gold: 35,
      xp: 20,
      drops: [],
    },
  },

   {
    enemyId: "4",
    name: "Ruined",
    type: "Tech 🤖",
    rarity: 1,
    level: 3,
    stats: {
      hp: 30,    
      atk: 21,   
      def: 28,  
      speed: 27, 
    },
    skill: {
      name: "Bone Slash",
      description: wrapSkillDescription("Strikes with a rusty blade, dealing {0}× ATK damage."),
      values: 1.2, 
    },
    image: "https://res.cloudinary.com/pachi/image/upload/v1766801659/Gemini_Generated_Image_r5o1ifr5o1ifr5o1_1_fxxs6p.png", 
    rewards: {
      gold: 39,
      xp: 25,
      drops: [],
    },
  },
];

module.exports = { mobs };
