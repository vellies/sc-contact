const mongoose = require("mongoose");

const gLeadsSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, default: "" },
    lastName:  { type: String, trim: true, default: "" },
    email:     { type: String, required: true, unique: true, trim: true, lowercase: true },
    phoneNumbers: { type: Object, default: {} },
    linkedinUrl:  { type: String, trim: true, default: "" },
    title:        { type: String, trim: true, default: "" },
    headline:     { type: String, trim: true, default: "" },
    state:        { type: String, trim: true, default: "" },
    city:         { type: String, trim: true, default: "" },
    country:      { type: String, trim: true, default: "" },
    // Status tracking (same pattern as MailerLite)
    status: {
      type: String,
      enum: ["pending", "contacted", "replied", "demo", "closed", "invalid"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "geto_leads",
  }
);

gLeadsSchema.index({ status: 1 });
gLeadsSchema.index({ state: 1 });
gLeadsSchema.index({ city: 1 });
gLeadsSchema.index({ country: 1 });
gLeadsSchema.index({ title: 1 });

module.exports = mongoose.model("GLeads", gLeadsSchema);
