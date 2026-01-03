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
      "When attacking, if Speed is lower than the target’s, gains {0}% lifesteal; otherwise, gains +{1}% ATK \nand +{2}% Crit Rate.",
    values: [
      [20, 24, 28, 32, 36, 40], // Lifesteal %
      [10, 14, 18, 22, 26, 30], // ATK %
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
  stats: { atk: 77, hp: 65, speed: 89, def: 49 },
  skill: {
    icon: "<:miyabi_skill:1447562052771123323>",
    name: "Judgement Cut",
    description:
      "Marks the target with a silent slash. After 2 turns, the mark detonates, dealing {0} × SPD as **True Damage**.",
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
      "Silences the target for 2 turns. While Silenced, target loses {0} Energy at the start of each turn and cannot regenerate Energy or use Skill.",
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
      "Randomly sets the enemy’s Energy to 0–100%; if the new value is lower, Herta takes damage equal to {0}% of her Max HP based on the Energy lost, otherwise the enemy is marked with **Interpretation** and takes {1}% of Herta’s Max HP as Ice damage based on the Energy gained when they next act.",
    values: [
      [0.45, 0.4, 0.35, 0.3, 0.28, 0.25],
      [0.6, 0.7, 0.8, 0.9, 0.1, 1.1],
    ],
  },
  image:
    "https://res.cloudinary.com/pachi/image/upload/v1767285274/14081530953dd062ced940ea02798f2d_zpnrhp.jpg",
  cardColor: "#7f0dd6",
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
};
