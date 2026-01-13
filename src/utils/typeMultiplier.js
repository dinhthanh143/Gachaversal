const TYPE_CHART = {
    "Electric ⚡":  { strong: ["Water 💧"],            weak: ["Earth ⛰️"] },
    "Water 💧":     { strong: ["Fire 🔥"],             weak: ["Electric ⚡"] },
    "Fire 🔥":      { strong: ["Ice ❄️", "Nature 🌲"], weak: ["Water 💧"] },
    "Ice ❄️":       { strong: ["Nature 🌲"],            weak: ["Fire 🔥"] },
    "Earth ⛰️":     { strong: ["Electric ⚡"],         weak: ["Ice ❄️"] },

    "Wind 🌪️":      { strong: ["Earth ⛰️"],           weak: ["Nature 🌲"] },
    "Nature 🌲":    { strong: ["Wind 🌪️"],             weak: ["Fire 🔥"] },

    "Physical ⚔️":  { strong: ["Tech ⚙️"],             weak: ["Magic 🔮"] },
    "Tech ⚙️":      { strong: ["Magic 🔮"],            weak: ["Physical ⚔️"] },
    "Magic 🔮":     { strong: ["Physical ⚔️"],         weak: ["Tech ⚙️"] },

    "Light ☀️":     { strong: ["Dark 🌙"],             weak: ["Dark 🌙"] },
    "Dark 🌙":      { strong: ["Light ☀️"],            weak: ["Light ☀️"] },

    //neutral
    "Neutral ✨":   { strong: [],                      weak: [] }
};

// Helper function to calculate multiplier
function getTypeMultiplier(attackerType, defenderType) {
    const data = TYPE_CHART[attackerType];
    if (!data) return 1.0;

    if (data.strong.includes(defenderType)) return 1.5; 
    if (data.weak.includes(defenderType)) return 0.5;  
    
    return 1.0; // Neutral
}

module.exports = { TYPE_CHART, getTypeMultiplier };