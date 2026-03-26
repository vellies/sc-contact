const mongoose = require("mongoose");

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Institution name is required"],
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    phones: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    emails: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [],
    },
    contacts: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    website: {
      type: String,
      default: "",
      trim: true,
    },
    types: {
      type: [String],
      enum: ["school", "college", "polytechnic", "iti"],
      default: ["school"],
    },
    // Location references
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      required: [true, "Area reference is required"],
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

// Compound unique: same name + area can't repeat
institutionSchema.index({ name: 1, area: 1 }, { unique: true });

// Indexes for fast lookups
institutionSchema.index({ area: 1 });
institutionSchema.index({ district: 1 });
institutionSchema.index({ state: 1 });
institutionSchema.index({ types: 1 });

module.exports = mongoose.model("Institution", institutionSchema);
