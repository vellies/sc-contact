const express = require("express");
const router = express.Router();
const {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
} = require("../controllers/contactController");
const { validateContact } = require("../validators/contactValidator");

router.route("/").get(getContacts).post(validateContact, createContact);

router.route("/:id").get(getContact).put(validateContact, updateContact).delete(deleteContact);

module.exports = router;
