// Galbrena (ID: 1)
const galbrena = {
  pokeId: 1,
  name: "Galbrena",
  franchise: "Wuthering Waves",
  type: "Fire 🔥",
  stats: { atk: 59, hp: 78, speed: 75, def: 60 },
  skill: {
    icon: "<:galbrena_skill:1446787462742409298>",
    name: "Flamming bullets",
    description:
      "Fires incendiary rounds that deal {0}× **Max HP** damage and have a {1}% chance to ignite the target, dealing 7% of opponent's Max HP as damage every turn for 2 turns.",
    // ✅ Single Variable: Wrapped in one outer array
    values: [
      [0.1, 0.15, 0.25, 0.3, 0.4, 0.5],
      [25, 30, 35, 40, 45, 50],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1766671335/galbrena_1_1_hqbixr.jpg",
  cardColor: "#091973",
};

// Carlotta (ID: 2)
const carlotta = {
  pokeId: 2,
  name: "Carlotta Montelli",
  franchise: "Wuthering Waves",
  type: "Ice ❄️",
  stats: { atk: 67, hp: 70, speed: 86, def: 53 },
  skill: {
    icon: "<:carlotta_skill:1446787543092822027>",
    name: "Piercing Shards",
    description:
      "Fires three searing shots, each dealing {0}× ATK damage. Every hit has a {1}% chance to critically strike.",
    values: [
      [0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
      [10, 15, 20, 25, 30, 35],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1764944111/carlot1_3_lwgq87.jpg",
  cardColor: "#d40b7d",
};

// Chisa (ID: 3)
const chisa = {
  pokeId: 3,
  name: "Kuchiba Chisa",
  franchise: "Wuthering Waves",
  type: "Neutral ✨",
  stats: { atk: 64, hp: 68, speed: 82, def: 58 },
  skill: {
    icon: "<:chisa_skill:1446787026392190997>",
    name: "Tactical Overclock",
    description:
      "Activates advanced targeting protocols, gaining {0}% Crit Rate and +{1}% Speed per stack (max 3 stacks); stacks expire after 4 turns.",
    values: [
      [10, 12, 15, 20, 25, 35],
      [1, 2, 3, 4, 5, 6],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1765006862/chisa_agmsgw.jpg",
  cardColor: "#7d0202",
};

// Rover (ID: 4)
const rover = {
  pokeId: 4,
  name: "Rover",
  franchise: "Wuthering Waves",
  type: "Wind 🌪️",
  stats: { atk: 75, hp: 69, speed: 68, def: 60 },
  skill: {
    icon: "<:rover_skill_gale:1446799294492311603>",
    name: "Gale Disruption",
    description: "Reduces enemy's accuracy by {0}% for 2 turns.",
    values: [[15, 20, 25, 30, 35, 40]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1765010491/rover_ms6erj.jpg",
  cardColor: "#31f593",
};

// Ye (ID: 5)
const ye = {
  pokeId: 5,
  name: "Ye Shunguang",
  franchise: "Zenless Zone Zero",
  type: "Physical ⚔️",
  stats: { atk: 86, hp: 74, speed: 63, def: 61 },
  skill: {
    icon: "<:ye_skill:1446822377101983787>",
    name: "Sword Of The Divine [PASSIVE]",
    description:
      "When attacking, if Speed is lower than the target’s, gains {0}% lifesteal and +{1}% ATK ; otherwise, gains +{1}% ATK \nand +{2}% Crit Rate.",
    values: [
      [17, 22, 29, 36, 43, 50], // Lifesteal %
      [10, 14, 20, 25, 30, 35], // ATK %
      [8, 10, 12, 14, 16, 18], // Crit Rate %
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1766652693/ye_u8zzsw.jpg",
  cardColor: "#ebb734",
};

// QiuYuan (ID: 6)
const qiuYuan = {
  pokeId: 6,
  name: "QiuYuan",
  franchise: "Wuthering Waves",
  type: "Wind 🌪️",
  stats: { atk: 76, hp: 68, speed: 78, def: 53 },
  skill: {
    icon: "<:qiuyuan_skill:1447262771245748255>",
    name: "Wind's Edge [PASSIVE]",
    description:
      "Has {0}% to dodge enemy's attack. Increases damage on next strike by {1}% after a successful dodge.",
    values: [
      [10, 12, 15, 20, 24, 28],
      [10, 15, 20, 25, 30, 35],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1765036839/2386df32b8eca33e9d431d0376e550d0_elmaon.jpg",
  cardColor: "#088c2c",
};

// Miyabi (ID: 7)
const miyabi = {
  pokeId: 7,
  name: "Hoshimi Miyabi",
  franchise: "Zenless Zone Zero",
  type: "Ice ❄️",
  stats: { atk: 81, hp: 66, speed: 89, def: 55 },
  skill: {
    icon: "<:miyabi_skill:1447562052771123323>",
    name: "Judgement Cut",
    description:
      "Marks the target with a silent slash. After 2 turns, the mark detonates, dealing {0} × ATK as **True Damage**.",
    values: [[1.1, 1.2, 1.3, 1.5, 1.7, 1.9]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1765013104/yabi_m4doiz.jpg",
  cardColor: "#03fcf4",
};

// Yixuan (ID: 8) - ⭐ DUAL SCALING EXAMPLE
const yixuan = {
  pokeId: 8,
  name: "Yixuan",
  franchise: "Zenless Zone Zero",
  type: "Magic 🔮",
  stats: { atk: 48, hp: 89, speed: 45, def: 81 },
  skill: {
    icon: "<:yixuan_skill:1453672321306067110>",
    name: "Divine Foresight",
    description:
      "For 2 turns, reduces incoming damage by {0}%. If HP is below 50%, restores {1}% of max HP at the end of each turn.",
    values: [
      [10, 14, 18, 22, 26, 30],
      [6, 7, 8, 9, 10, 11],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1765036439/53c9e799f3b0f6f524cd427f84ed095e_n6p9bo.jpg",
  cardColor: "#e8ab02",
};

// Aether (ID: 9)
const aether = {
  pokeId: 9,
  name: "Aether",
  franchise: "Genshin Impact",
  type: "Physical ⚔️",
  stats: { atk: 61, hp: 75, speed: 72, def: 55 },
  skill: {
    icon: "<:aether_skill:1454322228501151878>",
    name: "Femboy Slash",
    description: "Slashes like a femboy, dealing {0} × ATK damage.",
    values: [[1.1, 1.2, 1.3, 1.4, 1.5, 1.6]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1765037777/aether_ge4i6m.jpg",
  cardColor: "#ebdf91",
};

// Wise (ID: 10)
const wise = {
  pokeId: 10,
  name: "Wise",
  franchise: "Zenless Zone Zero",
  type: "Light 🌟 ",
  stats: { atk: 56, hp: 78, speed: 64, def: 65 },
  skill: {
    icon: "<:wise_skill:1454330440096944201>",
    name: "Proxy's Rizz",
    description:
      "Analyzes the target's weakness with undeniable charm, reducing their Defense by {0}% for 2 turns.",
    values: [[10, 14, 18, 22, 26, 30]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1765037638/wise_cykjto.jpg",
  cardColor: "#757571",
};

// Lappland (ID: 11)
const lappland = {
  pokeId: 11,
  name: "Lappland Saluzzo",
  franchise: "Arknights",
  type: "Dark 🌙",
  stats: { atk: 74, hp: 68, speed: 88, def: 55 },
  skill: {
    icon: "<:lappland_skill:1454368319686840341>",
    name: "Nocturnal Silence",
    description:
      "Silences the target for 2 turns. While Silenced, target loses {0} Energy at the start of each turn and cannot regenerate Energy nor use Skill.",
    values: [[5, 8, 11, 14, 17, 20]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767281958/lappy_znmf3i.jpg",
  cardColor: "#6d6d6e",
};

// Trailblazer (ID: 12)
const trailblazer = {
  pokeId: 12,
  name: "Trailblazer",
  franchise: "Honkai Star Rail",
  type: "Fire 🔥",
  stats: { atk: 58, hp: 79, speed: 62, def: 74 },
  skill: {
    icon: "<:tb_skill:1454873572211425301>",
    name: "Bulwark Protocol",
    description: "Increases Defense by {0}% for 2 turns.",
    values: [[15, 20, 25, 30, 35, 42]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1766939688/d07a1bd56a03dd5b5d3ea9c82e35a045_936523023715156546_lftbfu.png",
  cardColor: "#cf3a19",
};

const herta = {
  pokeId: 13,
  name: "The Herta",
  franchise: "Honkai Star Rail",
  type: "Ice ❄️",
  stats: {
    atk: 70,
    hp: 77,
    speed: 84,
    def: 65,
  },
  skill: {
    icon: "<:herta_skill:1456549247611699200>",
    name: "Key of Interpretation",
    description:
      "Randomly sets the enemy’s Energy to 0–100%; if the new value is lower, Herta takes damage equal to {0}% of her Max HP based on the Energy lost, otherwise the enemy is marked with **Interpretation** and takes {1}% of Herta’s Max HP as Ice damage based on the Energy gained.",
    values: [
      [0.45, 0.4, 0.35, 0.3, 0.28, 0.25],
      [0.6, 0.8, 1, 1.2, 1.4, 1.6],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767285274/14081530953dd062ced940ea02798f2d_zpnrhp.jpg",
  cardColor: "#7f0dd6",
};

const acheron = {
  pokeId: 14,
  name: "Acheron",
  franchise: "Honkai Star Rail",
  type: "Electric ⚡",
  stats: {
    atk: 78,
    hp: 69,
    speed: 84,
    def: 60,
  },
  skill: {
    icon: "<:acheron_skill:1456918056013135990>",
    name: "Crimson Verdict [PASSIVE]",
    description:
      "Each time Acheron attacks, she applies 1 stack of Slashed Dream; at 4 stacks, all stacks are consumed to unleash a Crimson Slash that deals {0}% ATK damage per stack and is guaranteed to Crit.",
    values: [[15, 20, 25, 30, 35, 40]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767422326/ed11f7eab53c677090f341de3af11da5_qm7prz.jpg",
  cardColor: "#460996",
};

const phainon = {
  pokeId: 15,
  name: "Phainon",
  franchise: "Honkai Star Rail",
  type: "Light ☀️",
  stats: {
    atk: 68,
    hp: 90,
    speed: 70,
    def: 52,
  },
  skill: {
    icon: "<:phainon_skill:1456918929531474001>",
    name: "Echo of Calamity",
    description:
      "For the next 3 turns, whenever Phainon takes damage, he stores {0}% of the damage received. When the duration ends, he retaliates against the target, dealing Light damage.",
    values: [[45, 50, 55, 60, 65, 70]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767422348/02b96ba754da2755c5691703772980de_udasvi.jpg",
  cardColor: "#e6cd17",
};

const raiden = {
  pokeId: 16,
  name: "Raiden Shogun",
  franchise: "Genshin Impact",
  type: "Electric ⚡",
  stats: {
    atk: 82,
    hp: 74,
    speed: 86,
    def: 54,
  },
  skill: {
    icon: "<:raiden_skill:1456922691411120170>",
    name: "Eternal Execution",
    description:
      "When Raiden uses her Skill, instead of fully depleting Energy, she consumes between 25-100% of her current Energy and channels it into a devastating strike. Deals Electro DMG equal to {0}% of ATK for each 1% Energy consumed.",
    values: [[1, 1.2, 1.4, 1.6, 1.8, 2]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767423122/d4408d2e73f1597d4ac54e533e3379f6_y5fexp.jpg",
  cardColor: "#8517e6",
};

const zhongli = {
  pokeId: 17,
  name: "Zhongli",
  franchise: "Genshin Impact",
  type: "Earth ⛰️",
  stats: {
    atk: 65,
    hp: 76,
    speed: 58,
    def: 86,
  },
  skill: {
    icon: "<:zhongli_skill:1456927829550829612>",
    name: "Heavenfall Accord",
    description:
      "Raises Defense by {0}% for 2 turns. When the effect expires, summons a falling meteor that Stuns the target for 1 turn.",
    values: [[20, 25, 30, 40, 50, 60]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767423167/1bf30c662a572a5d105b6fa9df74f407_zdc3ho.jpg",
  cardColor: "#805f06",
};

const skirk = {
  pokeId: 18,
  name: "Skirk",
  franchise: "Genshin Impact",
  type: "Ice ❄️",
  stats: {
    atk: 72,
    hp: 78,
    speed: 75,
    def: 70,
  },
  skill: {
    icon: "<:skirk_skill:1456936895115427860>",
    name: "Havoc of the Abyss",
    description:
      "Unleashes a ruthless ice strike, dealing {0}% ATK as Ice damage and reducing the target’s Speed by 25% for 4 turns. If the target is already Slowed, deals an additional instance of DMG equals to {1}% of the target's current HP.",
    values: [
      [90, 110, 125, 140, 155, 170],
      [10, 12, 14, 16, 18, 20],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767423140/da813163854318dfec789f7c916d8150_ybioqx.jpg",
  cardColor: "#106ec7",
};
//wip
const flins = {
  pokeId: 19,
  name: "Flins",
  franchise: "Genshin Impact",
  type: "Electric ⚡",
  stats: {
    atk: 73,
    hp: 66,
    speed: 81,
    def: 70,
  },
  skill: {
    icon: "👊",
    name: "Power Strike",
    description: "Deals a powerful strike equals to {0}% of ATK damage.",
    values: [[100, 110, 120, 130, 140, 150]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767423154/c4adb7e1359ce0bff6b914f2d92bbadd_kkbq1l.jpg",
  cardColor: "#341bb3",
};

const doctor = {
  pokeId: 20,
  name: "Doctor",
  franchise: "Arknights",
  type: "Nature 🍃",
  stats: {
    atk: 66,
    hp: 72,
    speed: 70,
    def: 68,
  },
  skill: {
    icon: "<:doctor_skill:1457010478885634062>",
    name: "Medic Protocol",
    description:
      "Activates healing protocols. For 3 turns, at the start of each turn, heals {0}% of Doctor's Max HP.",
    values: [[5, 7, 9, 11, 13, 15]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767429949/0e0f352babd23cbc4413f9ef735ad72c_ubsvku.jpg",
  cardColor: "#52d96d",
};
const castorice = {
  pokeId: 21,
  name: "Castorice",
  franchise: "Honkai Star Rail",
  type: "Dark 🌙",
  stats: {
    atk: 70,
    hp: 95,
    speed: 42,
    def: 72,
  },
  skill: {
    icon: "<:castorice_skill:1457011310767243405>",
    name: "Queen of the Death Kingdom [PASSIVE]",
    description:
      "When Castorice would be reduced to 0 HP, she instead remains in combat for 3 turns. During this time, she gains ATK equal to {0}% of her Max HP. After 3 turns, she dies. In Raids, she remains alive even after the effect ends while keeping the buff.",
    values: [[1, 2, 3, 4, 5, 6]],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767429948/3828ca7218feffb362d69235ec249906_vsrwlx.jpg",
  cardColor: "#c36ce0",
};

const amiya = {
  pokeId: 22,
  name: "Amiya",
  franchise: "Arknights",
  type: "Water 💧 ",
  stats: {
    atk: 70,
    hp: 74,
    speed: 70,
    def: 72,
  },
  skill: {
    icon: "<:amiya_skill:1457210609258070036>",
    name: "Arts Convergence",
    description:
      "Channels the power of Originium Arts, firing concentrated shots that deal {0}% ATK as damage and drain {1} Energy of the target.",
    values: [
      [105, 108, 111, 114, 117, 121],
      [10, 12, 14, 16, 20, 25],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767458551/ce0eba0ab4c62466a6c058fb72b38c96_relmyx.jpg",
  cardColor: "#054973",
};
const wisadel = {
  pokeId: 23,
  name: "Wisadel",
  franchise: "Arknights",
  type: "Dark 🌙",
  stats: {
    atk: 86,
    hp: 67,
    speed: 80,
    def: 59,
  },
  skill: {
    icon: "<:w_skill:1457218706731171840>",
    name: "BANG!",
    description:
      "Upon activation, Wisadel stores 5 Explosive Ammos and consumes one each time she attacks. Each ammo consumed increases her ATK by {0}% and Crit Rate by {1}%. The buffs end after she uses up all her Ammos.",
    values: [
      [4, 5, 6, 7, 8, 10], // ATK % (was 8-18)
      [4, 5, 6, 7, 8, 9], // Crit Rate % (was 5-10)
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767459025/37239f0f7f676c94155741e5b913b225_mvymoz.jpg",
  cardColor: "#7a1c02",
};

const yuzuha = {
  pokeId: 24,
  name: "Ukinami Yuzuha",
  franchise: "Zenless Zone Zero",
  type: "Neutral ✨",
  stats: {
    atk: 68,
    hp: 75,
    speed: 82,
    def: 64,
  },
  skill: {
    icon: "<:yuzuha_skill:1457214067638009956>",
    name: "Sugar Rush",
    description:
      "Yuzuha sweetly invigorates herself, increasing ATK by {0}% and Energy regeneration by {1}% for 4 turns. The duration resets everytime she uses her skill, this effect can stack up to 2 times.",
    values: [
      [12, 14, 16, 18, 20, 22],
      [12, 14, 16, 18, 20, 22],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767459013/6d474d90e1557b32084db830752f1b98_dcjwno.jpg",
  cardColor: "#e02f2f",
};
//wip
const skadi = {
  pokeId: 25,
  name: "Skadi",
  franchise: "Arknights",
  type: "Water 💧 ",
   stats: {
    atk: 0,
    hp: 0,
    speed: 0,
    def: 0,
  },
  skill: {
    icon: "",
    name: "",
    description: "",
    values: [
      [12, 14, 16, 18, 20, 22],
      [12, 14, 16, 18, 20, 22],
    ],
  },
  image: "https://res.cloudinary.com/pachi/image/upload/v1767609894/333d0ac60c8f81fd8a96f3bbb9f58466_ivxr3i.jpg",
  cardColor: "#ab0a40",
};
const mydei = {
  pokeId: 26,
  name: "Mydei",
  franchise: "Honkai Star Rail",
  type: "Earth ⛰️",
   stats: {
    atk: 0,
    hp: 0,
    speed: 0,
    def: 0,
  },
  skill: {
    icon: "",
    name: "",
    description: "",
    values: [
    ],
  },
  image: "https://res.cloudinary.com/pachi/image/upload/v1767609904/5dd5a00d3ba240e3bb754c341bf25e6d_hxtgvo.jpg",
  cardColor: "#dea426",
};
module.exports = {
  galbrena,
  carlotta,
  chisa,
  rover,
  ye,
  qiuYuan,
  miyabi,
  yixuan,
  aether,
  wise,
  lappland,
  trailblazer,
  herta,
  acheron,
  phainon,
  raiden,
  skirk,
  zhongli,
  flins,
  doctor,
  castorice,
  amiya,
  wisadel,
  yuzuha,
  skadi,mydei
};
