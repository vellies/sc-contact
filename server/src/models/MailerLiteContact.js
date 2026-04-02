const mongoose = require("mongoose");

const mailerLiteContactSchema = new mongoose.Schema(
  {
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    contactName: {
      type: String,
      trim: true,
      default: "",
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    institutionName: {
      type: String,
      required: true,
      trim: true,
    },
    institutionType: {
      type: String,
      enum: ["school", "college", "polytechnic", "iti"],
      default: "school",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    areaName: {
      type: String,
      trim: true,
      default: "",
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
    },
    districtName: {
      type: String,
      trim: true,
      default: "",
    },
    stateName: {
      type: String,
      trim: true,
      default: "",
    },

    // Validation flags
    emailValid: {
      type: Boolean,
      default: false,
    },
    phoneValid: {
      type: Boolean,
      default: false,
    },
    isGenericEmail: {
      type: Boolean,
      default: false,
    },
    // Sync tracking
    mailerliteId: {
      type: String,
      default: "",
    },
    groupId: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "added", "valid", "email", "clicked", "demo"],
      default: "pending",
    },
    syncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One contact per institution, one email globally
mailerLiteContactSchema.index({ institution: 1 }, { unique: true });
mailerLiteContactSchema.index({ email: 1 }, { unique: true });
mailerLiteContactSchema.index({ institution: 1 });
mailerLiteContactSchema.index({ status: 1 });
mailerLiteContactSchema.index({ institutionType: 1 });
mailerLiteContactSchema.index({ stateName: 1 });
mailerLiteContactSchema.index({ districtName: 1 });
mailerLiteContactSchema.index({ emailValid: 1 });
mailerLiteContactSchema.index({ isGenericEmail: 1 });

module.exports = mongoose.model("MailerLiteContact", mailerLiteContactSchema);
