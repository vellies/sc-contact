// import mongoose from "mongoose";
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const apolloEmailMembersSchema = new Schema(
    {
        firstName: { type: String },
        lastName: { type: String },
        phoneNumbers: { type: Object, default: {} },
        email: { type: String, required: true, unique: true }, // Unique email
        linkedinUrl: { type: String },
        title: { type: String },
        headline: { type: String },
        state: { type: String },
        city: { type: String },
        country: { type: String },
    },
    {
        timestamps: true,
        collection: "geto_leads",
    }
);

module.exports = mongoose.model("ApolloEmailMember", apolloEmailMembersSchema);