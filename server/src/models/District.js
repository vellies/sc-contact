const mongoose = require("mongoose");

const districtSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "District name is required"],
      trim: true,
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      required: [true, "State reference is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique: same district name can't repeat within a state
districtSchema.index({ name: 1, state: 1 }, { unique: true });

// Virtual: get all areas of this district
districtSchema.virtual("areas", {
  ref: "Area",
  localField: "_id",
  foreignField: "district",
});

module.exports = mongoose.model("District", districtSchema);
