const mongoose = require("mongoose");

const coachingInstituteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Institute name is required"],
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
      enum: ["coaching", "tutoring", "test_prep", "skill_training"],
      default: ["coaching"],
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
coachingInstituteSchema.index({ name: 1, area: 1 }, { unique: true });

// Indexes for fast lookups
coachingInstituteSchema.index({ area: 1 });
coachingInstituteSchema.index({ district: 1 });
coachingInstituteSchema.index({ state: 1 });
coachingInstituteSchema.index({ types: 1 });

module.exports = mongoose.model("CoachingInstitute", coachingInstituteSchema);
