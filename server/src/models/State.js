const mongoose = require("mongoose");

const stateSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "State code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [4, "Code cannot exceed 4 characters"],
    },
    name: {
      type: String,
      required: [true, "State name is required"],
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["State", "UT"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: get all districts of this state
stateSchema.virtual("districts", {
  ref: "District",
  localField: "_id",
  foreignField: "state",
});

module.exports = mongoose.model("State", stateSchema);
