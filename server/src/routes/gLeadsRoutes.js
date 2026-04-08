const express = require("express");
const router  = express.Router();
const {
  getContacts,
  getStats,
  bulkUpdateStatus,
  deleteContact,
  exportContacts,
  importContacts,
  fixPhoneNumbers,
  listFiles,
  getDuplicates,
  getByEmail,
  updateByEmail,
} = require("../controllers/gLeadsController");

router.get("/contacts",            getContacts);
router.get("/stats",               getStats);
router.get("/export",              exportContacts);
router.get("/duplicates",          getDuplicates);
router.get("/contact/:email",      getByEmail);
router.patch("/contact/:email",    updateByEmail);
router.post("/import",             importContacts);
router.post("/fix-phones",         fixPhoneNumbers);
router.post("/list-files",         listFiles);
router.post("/bulk-update-status", bulkUpdateStatus);
router.delete("/contacts/:id",     deleteContact);

module.exports = router;
