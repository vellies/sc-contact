const express = require("express");
const router = express.Router();
const {
  getStates,
  getState,
  createState,
  updateState,
  deleteState,
  getDistricts,
  getDistrict,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  getAreas,
  getArea,
  createArea,
  updateArea,
  deleteArea,
  searchByPincode,
  autoGenerateAreas,
  autoGeneratePreview,
  getDistrictAreaCount,
} = require("../controllers/locationController");

// --- States ---
router.route("/states").get(getStates).post(createState);
router.route("/states/:id").get(getState).put(updateState).delete(deleteState);

// --- Districts ---
router.get("/states/:stateId/districts", getDistricts);
router.route("/districts").post(createDistrict);
router.post("/districts/:id/auto-generate-areas", autoGenerateAreas);
router.get("/districts/:id/auto-generate-preview", autoGeneratePreview);
router.get("/districts/:id/area-count", getDistrictAreaCount);
router.route("/districts/:id").get(getDistrict).put(updateDistrict).delete(deleteDistrict);

// --- Areas ---
router.get("/districts/:districtId/areas", getAreas);
router.get("/areas/search/pincode", searchByPincode);
router.route("/areas").post(createArea);
router.route("/areas/:id").get(getArea).put(updateArea).delete(deleteArea);

module.exports = router;
