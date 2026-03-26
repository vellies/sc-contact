require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const State = require("../models/State");
const District = require("../models/District");
const Area = require("../models/Area");
const statesData = require("./statesData");

async function seed() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected for seeding...\n");

    // Clear existing data
    await Area.deleteMany({});
    await District.deleteMany({});
    await State.deleteMany({});
    console.log("Cleared existing States, Districts, Areas\n");

    let stateCount = 0;
    let districtCount = 0;
    let areaCount = 0;

    for (const stateData of statesData) {
      // 1. Create State
      const state = await State.create({
        code: stateData.code,
        name: stateData.name,
        type: stateData.type,
      });
      stateCount++;

      // 2. Create Districts & Areas (if districts data exists)
      if (stateData.districts) {
        for (const [districtName, areas] of Object.entries(stateData.districts)) {
          const district = await District.create({
            name: districtName,
            state: state._id,
          });
          districtCount++;

          // 3. Create Areas for this district
          if (areas.length > 0) {
            const areaDocs = areas.map((a) => ({
              pincode: a.pincode,
              area: a.area,
              city: a.city,
              district: district._id,
              state: state._id,
            }));

            await Area.insertMany(areaDocs);
            areaCount += areaDocs.length;
          }
        }
      }
    }

    console.log("Seeding complete!");
    console.log(`  States    : ${stateCount}`);
    console.log(`  Districts : ${districtCount}`);
    console.log(`  Areas     : ${areaCount}`);
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
}

seed();
