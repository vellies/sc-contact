const express = require("express");
const router = express.Router();
const {
  searchCoaching,
  searchByArea,
  searchByDistrict,
  saveInstitutes,
  getAllInstitutes,
  getByArea,
  getByDistrict,
  getDistrictSummary,
  deleteInstitute,
  deleteByArea,
  updateInstitute,
  scrapeInstitute,
  getDashboardStats,
} = require("../controllers/coachingController");
const {
  validateSaveCoachingInstitutes,
  validateUpdateCoachingInstitute,
} = require("../validators/coachingValidator");

// --- Search (Google Places API) ---
router.post("/search", searchCoaching);
router.post("/search-by-area", searchByArea);
router.post("/search-by-district", searchByDistrict);

// --- Save to DB ---
router.post("/save", validateSaveCoachingInstitutes, saveInstitutes);

// --- Dashboard ---
router.get("/dashboard", getDashboardStats);

// --- Get from DB ---
router.get("/all", getAllInstitutes);
router.get("/area/:areaId", getByArea);
router.get("/district/:districtId", getByDistrict);
router.get("/district/:districtId/summary", getDistrictSummary);

// --- CRUD ---
router.post("/:id/scrape", scrapeInstitute);
router.put("/:id", validateUpdateCoachingInstitute, updateInstitute);
router.delete("/area/:areaId/all", deleteByArea);
router.delete("/:id", deleteInstitute);

module.exports = router;
