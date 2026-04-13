const { findCoachingInstitutes, scrapeWebsite } = require("../services/coachingService");
const Area = require("../models/Area");
const District = require("../models/District");
const State = require("../models/State");
const CoachingInstitute = require("../models/CoachingInstitute");

// @desc    Dashboard stats
// @route   GET /api/coaching/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const { state, district, area } = req.query;

    const instFilter = {};
    if (state) instFilter.state = new mongoose.Types.ObjectId(state);
    if (district) instFilter.district = new mongoose.Types.ObjectId(district);
    if (area) instFilter.area = new mongoose.Types.ObjectId(area);
    const hasFilter = Object.keys(instFilter).length > 0;

    const [totalInstitutes, totalStates, totalDistricts, totalAreas] =
      await Promise.all([
        CoachingInstitute.countDocuments(instFilter),
        hasFilter
          ? state
            ? 1
            : CoachingInstitute.distinct("state", instFilter).then((r) => r.length)
          : State.countDocuments(),
        hasFilter
          ? district
            ? 1
            : CoachingInstitute.distinct("district", instFilter).then((r) => r.length)
          : District.countDocuments(),
        hasFilter
          ? area
            ? 1
            : CoachingInstitute.distinct("area", instFilter).then((r) => r.length)
          : Area.countDocuments(),
      ]);

    const typeStats = await CoachingInstitute.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $unwind: "$types" },
      { $group: { _id: "$types", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const [withPhone, withEmail, withContact, withWebsite] = await Promise.all([
      CoachingInstitute.countDocuments({ ...instFilter, phones: { $exists: true, $ne: [] } }),
      CoachingInstitute.countDocuments({ ...instFilter, emails: { $exists: true, $ne: [] } }),
      CoachingInstitute.countDocuments({ ...instFilter, contacts: { $exists: true, $ne: [] } }),
      CoachingInstitute.countDocuments({ ...instFilter, website: { $exists: true, $ne: "" } }),
    ]);

    const topStates = await CoachingInstitute.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $group: { _id: "$state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: "states", localField: "_id", foreignField: "_id", as: "stateInfo" } },
      { $unwind: "$stateInfo" },
      { $project: { _id: 1, count: 1, name: "$stateInfo.name" } },
    ]);

    const topDistricts = await CoachingInstitute.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $group: { _id: "$district", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: "districts", localField: "_id", foreignField: "_id", as: "districtInfo" } },
      { $unwind: "$districtInfo" },
      { $project: { _id: 1, count: 1, name: "$districtInfo.name" } },
    ]);

    const topAreas = await CoachingInstitute.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $group: { _id: "$area", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: "areas", localField: "_id", foreignField: "_id", as: "areaInfo" } },
      { $unwind: "$areaInfo" },
      { $project: { _id: 1, count: 1, name: "$areaInfo.area", pincode: "$areaInfo.pincode" } },
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivity = await CoachingInstitute.aggregate([
      { $match: { ...instFilter, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          institutes: totalInstitutes,
          states: totalStates,
          districts: totalDistricts,
          areas: totalAreas,
        },
        typeStats,
        coverage: {
          withPhone,
          withEmail,
          withContact,
          withWebsite,
          total: totalInstitutes,
        },
        topStates,
        topDistricts,
        topAreas,
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search coaching institutes by pincode/area/city
// @route   POST /api/coaching/search
exports.searchCoaching = async (req, res, next) => {
  try {
    const { pincode, city, area } = req.body;

    if (!pincode || !area) {
      return res.status(400).json({
        success: false,
        message: "pincode and area are required",
      });
    }

    const results = await findCoachingInstitutes({ pincode, city, area });

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search coaching by area ID
// @route   POST /api/coaching/search-by-area
exports.searchByArea = async (req, res, next) => {
  try {
    const { areaId } = req.body;

    if (!areaId) {
      return res.status(400).json({ success: false, message: "areaId is required" });
    }

    const areaDoc = await Area.findById(areaId)
      .populate("district", "name")
      .populate("state", "name");

    if (!areaDoc) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }

    const results = await findCoachingInstitutes({
      pincode: areaDoc.pincode,
      city: areaDoc.city,
      area: areaDoc.area,
    });

    res.json({
      success: true,
      count: results.length,
      query: {
        pincode: areaDoc.pincode,
        area: areaDoc.area,
        city: areaDoc.city,
        district: areaDoc.district?.name,
        state: areaDoc.state?.name,
      },
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch search: find coaching for multiple areas of a district
// @route   POST /api/coaching/search-by-district
exports.searchByDistrict = async (req, res, next) => {
  try {
    const { districtId, limit } = req.body;

    if (!districtId) {
      return res.status(400).json({ success: false, message: "districtId is required" });
    }

    const areas = await Area.find({ district: districtId })
      .sort({ pincode: 1 })
      .limit(limit || 5);

    if (areas.length === 0) {
      return res.status(404).json({ success: false, message: "No areas found for this district" });
    }

    const allResults = [];

    for (const areaDoc of areas) {
      try {
        const results = await findCoachingInstitutes({
          pincode: areaDoc.pincode,
          city: areaDoc.city,
          area: areaDoc.area,
        });
        allResults.push({
          area: areaDoc.area,
          pincode: areaDoc.pincode,
          city: areaDoc.city,
          count: results.length,
          institutes: results,
        });
      } catch (err) {
        allResults.push({
          area: areaDoc.area,
          pincode: areaDoc.pincode,
          city: areaDoc.city,
          count: 0,
          institutes: [],
          error: err.message,
        });
      }
    }

    const totalCount = allResults.reduce((sum, r) => sum + r.count, 0);

    res.json({
      success: true,
      totalCount,
      areasSearched: allResults.length,
      data: allResults,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ALL institutes with pagination, search, filters
// @route   GET /api/coaching/all
exports.getAllInstitutes = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      state,
      district,
      area,
      sort = "name",
      order = "asc",
      hasPhone,
      hasEmail,
      hasContact,
      hasWebsite,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (state) query.state = state;
    if (district) query.district = district;
    if (area) query.area = area;
    if (type) query.types = type;

    if (hasPhone === "true") query.phones = { $exists: true, $ne: [] };
    if (hasPhone === "false")
      query.$and = [...(query.$and || []), { $or: [{ phones: { $exists: false } }, { phones: [] }] }];
    if (hasEmail === "true") query.emails = { $exists: true, $ne: [] };
    if (hasEmail === "false")
      query.$and = [...(query.$and || []), { $or: [{ emails: { $exists: false } }, { emails: [] }] }];
    if (hasContact === "true") query.contacts = { $exists: true, $ne: [] };
    if (hasContact === "false")
      query.$and = [...(query.$and || []), { $or: [{ contacts: { $exists: false } }, { contacts: [] }] }];
    if (hasWebsite === "true") query.website = { $exists: true, $ne: "" };
    if (hasWebsite === "false")
      query.$and = [...(query.$and || []), { $or: [{ website: { $exists: false } }, { website: "" }] }];

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { phones: { $regex: search, $options: "i" } },
        { emails: { $regex: search, $options: "i" } },
        { contacts: { $regex: search, $options: "i" } },
      ];
    }

    const sortObj = {};
    const sortField = ["name", "createdAt", "updatedAt"].includes(sort) ? sort : "name";
    sortObj[sortField] = order === "desc" ? -1 : 1;

    const [institutes, totalCount] = await Promise.all([
      CoachingInstitute.find(query)
        .populate("area", "pincode area city")
        .populate("district", "name")
        .populate("state", "name")
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      CoachingInstitute.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      count: institutes.length,
      totalCount,
      page: pageNum,
      totalPages,
      limit: limitNum,
      data: institutes,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save search results to DB for an area
// @route   POST /api/coaching/save
exports.saveInstitutes = async (req, res, next) => {
  try {
    const { areaId, institutes } = req.body;

    if (!areaId || !institutes || !Array.isArray(institutes)) {
      return res.status(400).json({
        success: false,
        message: "areaId and institutes array are required",
      });
    }

    const areaDoc = await Area.findById(areaId);
    if (!areaDoc) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }

    let savedCount = 0;
    let skippedCount = 0;

    for (const inst of institutes) {
      try {
        await CoachingInstitute.findOneAndUpdate(
          { name: inst.name, area: areaId },
          {
            name: inst.name,
            address: inst.address || "",
            phones: inst.phones || [],
            emails: inst.emails || [],
            contacts: inst.contacts || [],
            website: inst.website || "",
            types: inst.types || ["coaching"],
            area: areaId,
            district: areaDoc.district,
            state: areaDoc.state,
          },
          { upsert: true, new: true }
        );
        savedCount++;
      } catch (err) {
        skippedCount++;
      }
    }

    res.json({
      success: true,
      message: `Saved ${savedCount} institutes, skipped ${skippedCount} duplicates`,
      savedCount,
      skippedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved institutes for an area
// @route   GET /api/coaching/area/:areaId
exports.getByArea = async (req, res, next) => {
  try {
    const { areaId } = req.params;
    const { search, type } = req.query;

    const query = { area: areaId };
    if (type) query.types = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { phones: { $regex: search, $options: "i" } },
        { emails: { $regex: search, $options: "i" } },
      ];
    }

    const institutes = await CoachingInstitute.find(query)
      .populate("area", "pincode area city")
      .sort({ name: 1 });

    res.json({ success: true, count: institutes.length, data: institutes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved institutes for a district
// @route   GET /api/coaching/district/:districtId
exports.getByDistrict = async (req, res, next) => {
  try {
    const { districtId } = req.params;
    const { search, type } = req.query;

    const query = { district: districtId };
    if (type) query.types = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { phones: { $regex: search, $options: "i" } },
        { emails: { $regex: search, $options: "i" } },
      ];
    }

    const institutes = await CoachingInstitute.find(query)
      .populate("area", "pincode area city")
      .sort({ name: 1 });

    res.json({ success: true, count: institutes.length, data: institutes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get institutes count per area for a district
// @route   GET /api/coaching/district/:districtId/summary
exports.getDistrictSummary = async (req, res, next) => {
  try {
    const { districtId } = req.params;

    const summary = await CoachingInstitute.aggregate([
      {
        $match: {
          district: require("mongoose").Types.ObjectId.createFromHexString(districtId),
        },
      },
      {
        $group: {
          _id: "$area",
          count: { $sum: 1 },
          coaching: { $sum: { $cond: [{ $in: ["coaching", "$types"] }, 1, 0] } },
          test_prep: { $sum: { $cond: [{ $in: ["test_prep", "$types"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "areas",
          localField: "_id",
          foreignField: "_id",
          as: "areaInfo",
        },
      },
      { $unwind: "$areaInfo" },
      {
        $project: {
          _id: 1,
          count: 1,
          coaching: 1,
          test_prep: 1,
          pincode: "$areaInfo.pincode",
          area: "$areaInfo.area",
          city: "$areaInfo.city",
        },
      },
      { $sort: { pincode: 1 } },
    ]);

    const totalCount = summary.reduce((sum, r) => sum + r.count, 0);

    res.json({
      success: true,
      totalCount,
      areasWithData: summary.length,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a saved institute
// @route   DELETE /api/coaching/:id
exports.deleteInstitute = async (req, res, next) => {
  try {
    const inst = await CoachingInstitute.findByIdAndDelete(req.params.id);
    if (!inst) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }
    res.json({ success: true, message: "Institute deleted" });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete all saved institutes for an area
// @route   DELETE /api/coaching/area/:areaId/all
exports.deleteByArea = async (req, res, next) => {
  try {
    const result = await CoachingInstitute.deleteMany({ area: req.params.areaId });
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} institutes`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Scrape website of a saved institute and update emails/phones
// @route   POST /api/coaching/:id/scrape
exports.scrapeInstitute = async (req, res, next) => {
  try {
    const inst = await CoachingInstitute.findById(req.params.id);
    if (!inst) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }
    if (!inst.website) {
      return res.status(400).json({ success: false, message: "No website to scrape" });
    }

    const scraped = await scrapeWebsite(inst.website);

    const mergedPhones = [...new Set([...inst.phones, ...scraped.phones])];
    const mergedEmails = [...new Set([...inst.emails, ...scraped.emails])];

    const updated = await CoachingInstitute.findByIdAndUpdate(
      req.params.id,
      { phones: mergedPhones, emails: mergedEmails },
      { new: true }
    ).populate("area", "pincode area city");

    res.json({
      success: true,
      found: { emails: scraped.emails.length, phones: scraped.phones.length },
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a saved institute
// @route   PUT /api/coaching/:id
exports.updateInstitute = async (req, res, next) => {
  try {
    const { name, address, phones, emails, contacts, website, types } = req.body;
    const inst = await CoachingInstitute.findByIdAndUpdate(
      req.params.id,
      { name, address, phones, emails, contacts, website, types },
      { new: true, runValidators: true }
    ).populate("area", "pincode area city");

    if (!inst) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }
    res.json({ success: true, data: inst });
  } catch (error) {
    next(error);
  }
};
