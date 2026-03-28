const express = require("express");
const router = express.Router();
const {
  getContacts,
  getStats,
  generate,
  syncOne,
  deleteContact,
  bulkUpdateStatus,
  exportContacts,
} = require("../controllers/mailerLiteController");

router.get("/contacts", getContacts);
router.get("/stats", getStats);
router.get("/export", exportContacts);
router.post("/generate", generate);
router.post("/sync/:institutionId", syncOne);
router.post("/bulk-update-status", bulkUpdateStatus);
router.delete("/contacts/:id", deleteContact);

module.exports = router;
