const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      trim: true,
      match: [/^\d{6}$/, "Pincode must be a 6-digit number"],
    },
    area: {
      type: String,
      required: [true, "Area name is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "District",
      required: [true, "District reference is required"],
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      required: [true, "State reference is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique: same pincode+area can't repeat within a district
areaSchema.index({ pincode: 1, area: 1, district: 1 }, { unique: true });

// Index for fast lookups
areaSchema.index({ pincode: 1 });
areaSchema.index({ district: 1 });
areaSchema.index({ state: 1 });
areaSchema.index({ city: 1 });

module.exports = mongoose.model("Area", areaSchema);
