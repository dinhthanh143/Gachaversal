// src/combat/skills/index.js

// Import Skill Groups
const arknights = require("./arknights");
const hsr = require("./hsr");
const genshin = require("./genshin");
const universal = require("./universal");
// const zzz = require("./zzz"); // Add more as you need
const zzz = require("./zzz");
const wuwa = require("./wuwa");

// Combine them all into one object
const Skills = {
  ...arknights,
  ...hsr,
  ...genshin,
  ...universal,
  ...zzz,
  ...wuwa
};

module.exports = { Skills };