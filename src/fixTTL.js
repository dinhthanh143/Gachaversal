const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require("mongoose");

async function fix() {
  try {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) throw new Error("Check .env location");

    await mongoose.connect(mongoUrl);
    console.log("Connected to DB...");

    const raidsCollection = mongoose.connection.collection("raids");
    
    // List all indexes to see what we have
    const indexes = await raidsCollection.indexes();
    console.log("Current Indexes:", indexes.map(i => i.name));

    // Try to drop the specific TTL index (usually named "createdAt_1")
    try {
      await raidsCollection.dropIndex("createdAt_1");
      console.log("✅ SUCCESS: Dropped 'createdAt_1' auto-delete rule.");
    } catch (e) {
      console.log("⚠️ Could not drop 'createdAt_1' (It might be named something else, or already gone).");
    }

    console.log("---------------------------------------------------");
    console.log("🎉 FIX COMPLETE. Restart your bot now.");
    console.log("---------------------------------------------------");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

fix();