const express = require("express");
const router = express.Router();
const {
  searchEducation,
  searchByArea,
  searchByDistrict,
  saveInstitutions,
  getByArea,
  getByDistrict,
  getDistrictSummary,
  deleteInstitution,
  deleteByArea,
  updateInstitution,
  scrapeInstitution,
  scrapeByArea,
  getAllInstitutions,
  getDashboardStats,
} = require("../controllers/educationController");
const {
  validateSaveInstitutions,
  validateUpdateInstitution,
} = require("../validators/educationValidator");

// --- Search (Google Places API) ---
router.post("/search", searchEducation);
router.post("/search-by-area", searchByArea);
router.post("/search-by-district", searchByDistrict);

// --- Save to DB (with zod validation) ---
router.post("/save", validateSaveInstitutions, saveInstitutions);

// --- Dashboard ---
router.get("/dashboard", getDashboardStats);

// --- Get from DB ---
router.get("/all", getAllInstitutions);
router.get("/area/:areaId", getByArea);
router.get("/district/:districtId", getByDistrict);
router.get("/district/:districtId/summary", getDistrictSummary);

// --- Scraper ---
router.post("/:id/scrape", scrapeInstitution);
router.post("/area/:areaId/scrape-all", scrapeByArea);

// --- CRUD on saved (with zod validation) ---
router.put("/:id", validateUpdateInstitution, updateInstitution);
router.delete("/area/:areaId/all", deleteByArea);
router.delete("/:id", deleteInstitution);

module.exports = router;
