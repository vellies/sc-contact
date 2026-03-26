const State = require("../models/State");
const District = require("../models/District");
const Area = require("../models/Area");
const districtAreasData = require("../seeds/districtAreasData");

// ==================== STATES ====================

// @desc    Get all states
// @route   GET /api/locations/states
exports.getStates = async (req, res, next) => {
  try {
    const { type, search } = req.query;
    const query = {};
    if (type) query.type = type;
    if (search) query.name = { $regex: search, $options: "i" };

    const states = await State.find(query).sort({ name: 1 });
    res.json({ success: true, count: states.length, data: states });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single state with its districts
// @route   GET /api/locations/states/:id
exports.getState = async (req, res, next) => {
  try {
    const state = await State.findById(req.params.id).populate({
      path: "districts",
      select: "name",
      options: { sort: { name: 1 } },
    });
    if (!state) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
};

// @desc    Create state
// @route   POST /api/locations/states
exports.createState = async (req, res, next) => {
  try {
    const { code, name, type } = req.body;
    const existing = await State.findOne({ $or: [{ code }, { name }] });
    if (existing) {
      return res.status(400).json({ success: false, message: "State with this code or name already exists" });
    }
    const state = await State.create({ code, name, type });
    res.status(201).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
};

// @desc    Update state
// @route   PUT /api/locations/states/:id
exports.updateState = async (req, res, next) => {
  try {
    const state = await State.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!state) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete state (cascades: deletes districts & areas)
// @route   DELETE /api/locations/states/:id
exports.deleteState = async (req, res, next) => {
  try {
    const state = await State.findById(req.params.id);
    if (!state) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    // Cascade delete
    const districts = await District.find({ state: state._id });
    const districtIds = districts.map((d) => d._id);
    await Area.deleteMany({ district: { $in: districtIds } });
    await District.deleteMany({ state: state._id });
    await State.findByIdAndDelete(state._id);

    res.json({ success: true, message: "State and all related districts & areas deleted" });
  } catch (error) {
    next(error);
  }
};

// ==================== DISTRICTS ====================

// @desc    Get districts by state
// @route   GET /api/locations/states/:stateId/districts
exports.getDistricts = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = { state: req.params.stateId };
    if (search) query.name = { $regex: search, $options: "i" };

    const districts = await District.find(query)
      .populate("state", "name code")
      .sort({ name: 1 });
    res.json({ success: true, count: districts.length, data: districts });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single district with its areas
// @route   GET /api/locations/districts/:id
exports.getDistrict = async (req, res, next) => {
  try {
    const district = await District.findById(req.params.id)
      .populate("state", "name code")
      .populate({
        path: "areas",
        select: "pincode area city",
        options: { sort: { pincode: 1 } },
      });
    if (!district) {
      return res.status(404).json({ success: false, message: "District not found" });
    }
    res.json({ success: true, data: district });
  } catch (error) {
    next(error);
  }
};

// @desc    Create district
// @route   POST /api/locations/districts
exports.createDistrict = async (req, res, next) => {
  try {
    const { name, state: stateId } = req.body;
    const stateExists = await State.findById(stateId);
    if (!stateExists) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    const existing = await District.findOne({ name, state: stateId });
    if (existing) {
      return res.status(400).json({ success: false, message: "District already exists in this state" });
    }
    const district = await District.create({ name, state: stateId });
    const populated = await district.populate("state", "name code");
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Update district
// @route   PUT /api/locations/districts/:id
exports.updateDistrict = async (req, res, next) => {
  try {
    const district = await District.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("state", "name code");
    if (!district) {
      return res.status(404).json({ success: false, message: "District not found" });
    }
    res.json({ success: true, data: district });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete district (cascades: deletes areas)
// @route   DELETE /api/locations/districts/:id
exports.deleteDistrict = async (req, res, next) => {
  try {
    const district = await District.findById(req.params.id);
    if (!district) {
      return res.status(404).json({ success: false, message: "District not found" });
    }
    await Area.deleteMany({ district: district._id });
    await District.findByIdAndDelete(district._id);
    res.json({ success: true, message: "District and all related areas deleted" });
  } catch (error) {
    next(error);
  }
};

// ==================== AREAS ====================

// @desc    Get areas by district
// @route   GET /api/locations/districts/:districtId/areas
exports.getAreas = async (req, res, next) => {
  try {
    const { search, pincode, city } = req.query;
    const query = { district: req.params.districtId };
    if (search) {
      query.$or = [
        { area: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { pincode: { $regex: search, $options: "i" } },
      ];
    }
    if (pincode) query.pincode = pincode;
    if (city) query.city = { $regex: city, $options: "i" };

    const areas = await Area.find(query)
      .populate("district", "name")
      .populate("state", "name code")
      .sort({ pincode: 1 });
    res.json({ success: true, count: areas.length, data: areas });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single area
// @route   GET /api/locations/areas/:id
exports.getArea = async (req, res, next) => {
  try {
    const area = await Area.findById(req.params.id)
      .populate("district", "name")
      .populate("state", "name code");
    if (!area) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }
    res.json({ success: true, data: area });
  } catch (error) {
    next(error);
  }
};

// @desc    Create area
// @route   POST /api/locations/areas
exports.createArea = async (req, res, next) => {
  try {
    const { pincode, area: areaName, city, district: districtId } = req.body;
    const districtDoc = await District.findById(districtId).populate("state", "_id");
    if (!districtDoc) {
      return res.status(404).json({ success: false, message: "District not found" });
    }
    const existing = await Area.findOne({ pincode, area: areaName, district: districtId });
    if (existing) {
      return res.status(400).json({ success: false, message: "Area with this pincode already exists in this district" });
    }
    const areaDoc = await Area.create({
      pincode,
      area: areaName,
      city,
      district: districtId,
      state: districtDoc.state._id,
    });
    const populated = await areaDoc.populate([
      { path: "district", select: "name" },
      { path: "state", select: "name code" },
    ]);
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Update area
// @route   PUT /api/locations/areas/:id
exports.updateArea = async (req, res, next) => {
  try {
    const area = await Area.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("district", "name")
      .populate("state", "name code");
    if (!area) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }
    res.json({ success: true, data: area });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete area
// @route   DELETE /api/locations/areas/:id
exports.deleteArea = async (req, res, next) => {
  try {
    const area = await Area.findByIdAndDelete(req.params.id);
    if (!area) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }
    res.json({ success: true, message: "Area deleted" });
  } catch (error) {
    next(error);
  }
};

// @desc    Auto-generate all areas for a district from master data
// @route   POST /api/locations/districts/:id/auto-generate-areas
exports.autoGenerateAreas = async (req, res, next) => {
  try {
    const district = await District.findById(req.params.id).populate("state", "_id name");
    if (!district) {
      return res.status(404).json({ success: false, message: "District not found" });
    }

    // Check if district already has areas
    const existingCount = await Area.countDocuments({ district: district._id });
    if (existingCount > 0) {
      return res.status(400).json({
        success: false,
        message: `District "${district.name}" already has ${existingCount} areas. Cannot auto-generate.`,
      });
    }

    // Look up master data for this district
    const masterAreas = districtAreasData[district.name];
    if (!masterAreas || masterAreas.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No master area data found for district "${district.name}". Please add areas manually.`,
      });
    }

    // Bulk create all areas from master data
    const areasToCreate = masterAreas.map((a) => ({
      pincode: a.pincode,
      area: a.area,
      city: a.city,
      district: district._id,
      state: district.state._id,
    }));

    const created = await Area.insertMany(areasToCreate);

    res.status(201).json({
      success: true,
      message: `Auto-generated ${created.length} areas for "${district.name}"`,
      count: created.length,
      data: created,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Preview how many areas will be auto-generated (from master data)
// @route   GET /api/locations/districts/:id/auto-generate-preview
exports.autoGeneratePreview = async (req, res, next) => {
  try {
    const district = await District.findById(req.params.id);
    if (!district) {
      return res.status(404).json({ success: false, message: "District not found" });
    }

    const existingCount = await Area.countDocuments({ district: district._id });
    const masterAreas = districtAreasData[district.name] || [];

    res.json({
      success: true,
      data: {
        districtName: district.name,
        existingCount,
        availableCount: masterAreas.length,
        canGenerate: existingCount === 0 && masterAreas.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get area count for a district
// @route   GET /api/locations/districts/:id/area-count
exports.getDistrictAreaCount = async (req, res, next) => {
  try {
    const count = await Area.countDocuments({ district: req.params.id });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

// @desc    Search areas by pincode
// @route   GET /api/locations/areas/search/pincode?q=641001
exports.searchByPincode = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
    }
    const areas = await Area.find({ pincode: { $regex: `^${q}`, $options: "i" } })
      .populate("district", "name")
      .populate("state", "name code")
      .sort({ pincode: 1 })
      .limit(50);
    res.json({ success: true, count: areas.length, data: areas });
  } catch (error) {
    next(error);
  }
};
