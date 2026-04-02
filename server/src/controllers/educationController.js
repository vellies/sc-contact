const { findEducationInstitutions } = require("../services/educationService");
const { scrapeWebsite } = require("../services/scraperService");
const Area = require("../models/Area");
const District = require("../models/District");
const State = require("../models/State");
const Institution = require("../models/Institution");

// @desc    Dashboard stats
// @route   GET /api/education/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const { state, district, area } = req.query;

    // Build institution filter — convert string IDs to ObjectId for aggregation
    const instFilter = {};
    if (state) instFilter.state = new mongoose.Types.ObjectId(state);
    if (district) instFilter.district = new mongoose.Types.ObjectId(district);
    if (area) instFilter.area = new mongoose.Types.ObjectId(area);
    const hasFilter = Object.keys(instFilter).length > 0;

    // Total counts (location counts adjust based on filter)
    const [totalInstitutions, totalStates, totalDistricts, totalAreas] =
      await Promise.all([
        Institution.countDocuments(instFilter),
        hasFilter ? (state ? 1 : Institution.distinct("state", instFilter).then(r => r.length)) : State.countDocuments(),
        hasFilter
          ? (district ? 1 : Institution.distinct("district", instFilter).then(r => r.length))
          : District.countDocuments(),
        hasFilter
          ? (area ? 1 : Institution.distinct("area", instFilter).then(r => r.length))
          : Area.countDocuments(),
      ]);

    // Count by type
    const typeStats = await Institution.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $unwind: "$types" },
      { $group: { _id: "$types", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Data coverage: has phone / email / contact / website
    const [withPhone, withEmail, withContact, withWebsite] = await Promise.all([
      Institution.countDocuments({ ...instFilter, phones: { $exists: true, $ne: [] } }),
      Institution.countDocuments({ ...instFilter, emails: { $exists: true, $ne: [] } }),
      Institution.countDocuments({ ...instFilter, contacts: { $exists: true, $ne: [] } }),
      Institution.countDocuments({ ...instFilter, website: { $exists: true, $ne: "" } }),
    ]);

    // Top 10 states by institution count
    const topStates = await Institution.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $group: { _id: "$state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "states",
          localField: "_id",
          foreignField: "_id",
          as: "stateInfo",
        },
      },
      { $unwind: "$stateInfo" },
      {
        $project: {
          _id: 1,
          count: 1,
          name: "$stateInfo.name",
        },
      },
    ]);

    // Top 10 districts by institution count
    const topDistricts = await Institution.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $group: { _id: "$district", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "districts",
          localField: "_id",
          foreignField: "_id",
          as: "districtInfo",
        },
      },
      { $unwind: "$districtInfo" },
      {
        $project: {
          _id: 1,
          count: 1,
          name: "$districtInfo.name",
        },
      },
    ]);

    // Top 10 areas by institution count (useful when filtering by district/state)
    const topAreas = await Institution.aggregate([
      ...(hasFilter ? [{ $match: instFilter }] : []),
      { $group: { _id: "$area", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
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
          name: "$areaInfo.area",
          pincode: "$areaInfo.pincode",
        },
      },
    ]);

    // Recent 7 days activity (institutions added per day)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivity = await Institution.aggregate([
      { $match: { ...instFilter, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          institutions: totalInstitutions,
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
          total: totalInstitutions,
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

// @desc    Search education institutions by pincode/area/city
// @route   POST /api/education/search
exports.searchEducation = async (req, res, next) => {
  try {
    const { pincode, city, area } = req.body;

    if (!pincode || !area) {
      return res.status(400).json({
        success: false,
        message: "pincode and area are required",
      });
    }

    const results = await findEducationInstitutions({ pincode, city, area });

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search education by area ID (auto-fills pincode/area/city from DB)
// @route   POST /api/education/search-by-area
exports.searchByArea = async (req, res, next) => {
  try {
    const { areaId } = req.body;

    if (!areaId) {
      return res.status(400).json({
        success: false,
        message: "areaId is required",
      });
    }

    const areaDoc = await Area.findById(areaId)
      .populate("district", "name")
      .populate("state", "name");

    if (!areaDoc) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    const results = await findEducationInstitutions({
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

// @desc    Batch search: find education for multiple areas of a district
// @route   POST /api/education/search-by-district
exports.searchByDistrict = async (req, res, next) => {
  try {
    const { districtId, limit } = req.body;

    if (!districtId) {
      return res.status(400).json({
        success: false,
        message: "districtId is required",
      });
    }

    const areas = await Area.find({ district: districtId })
      .sort({ pincode: 1 })
      .limit(limit || 5);

    if (areas.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No areas found for this district",
      });
    }

    const allResults = [];

    for (const areaDoc of areas) {
      try {
        const results = await findEducationInstitutions({
          pincode: areaDoc.pincode,
          city: areaDoc.city,
          area: areaDoc.area,
        });

        allResults.push({
          area: areaDoc.area,
          pincode: areaDoc.pincode,
          city: areaDoc.city,
          count: results.length,
          institutions: results,
        });
      } catch (err) {
        allResults.push({
          area: areaDoc.area,
          pincode: areaDoc.pincode,
          city: areaDoc.city,
          count: 0,
          institutions: [],
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

// @desc    Get ALL institutions with pagination, search, filters
// @route   GET /api/education/all
exports.getAllInstitutions = async (req, res, next) => {
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

    // Build query
    const query = {};
    if (state) query.state = state;
    if (district) query.district = district;
    if (area) query.area = area;
    if (type) query.types = type;

    // "Has data" / "No data" checkbox filters
    if (hasPhone === "true") query.phones = { $exists: true, $ne: [] };
    if (hasPhone === "false") query.$and = [...(query.$and || []), { $or: [{ phones: { $exists: false } }, { phones: [] }] }];
    if (hasEmail === "true") query.emails = { $exists: true, $ne: [] };
    if (hasEmail === "false") query.$and = [...(query.$and || []), { $or: [{ emails: { $exists: false } }, { emails: [] }] }];
    if (hasContact === "true") query.contacts = { $exists: true, $ne: [] };
    if (hasContact === "false") query.$and = [...(query.$and || []), { $or: [{ contacts: { $exists: false } }, { contacts: [] }] }];
    if (hasWebsite === "true") query.website = { $exists: true, $ne: "" };
    if (hasWebsite === "false") query.$and = [...(query.$and || []), { $or: [{ website: { $exists: false } }, { website: "" }] }];
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { phones: { $regex: search, $options: "i" } },
        { emails: { $regex: search, $options: "i" } },
        { contacts: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort
    const sortObj = {};
    const sortField = ["name", "createdAt", "updatedAt"].includes(sort) ? sort : "name";
    sortObj[sortField] = order === "desc" ? -1 : 1;

    const [institutions, totalCount] = await Promise.all([
      Institution.find(query)
        .populate("area", "pincode area city")
        .populate("district", "name")
        .populate("state", "name")
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Institution.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      count: institutions.length,
      totalCount,
      page: pageNum,
      totalPages,
      limit: limitNum,
      data: institutions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lookup institution + mailerlite data by email
// @route   GET /api/education/lookup-by-email
exports.lookupByEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "email query param is required" });
    }

    const emailLower = email.toLowerCase().trim();

    // Find institution(s) that have this email
    const institutions = await Institution.find({ emails: emailLower })
      .populate("area", "pincode area city")
      .populate("district", "name")
      .populate("state", "name code")
      .lean();

    // Find mailerlite contact with this email
    const MailerLiteContact = require("../models/MailerLiteContact");
    const mailerLiteContact = await MailerLiteContact.findOne({ email: emailLower }).lean();

    res.json({
      success: true,
      data: {
        email: emailLower,
        institutions,
        mailerLiteContact,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== SAVE / GET FROM DB ====================

// @desc    Save search results to DB for an area
// @route   POST /api/education/save
exports.saveInstitutions = async (req, res, next) => {
  try {
    const { areaId, institutions } = req.body;

    if (!areaId || !institutions || !Array.isArray(institutions)) {
      return res.status(400).json({
        success: false,
        message: "areaId and institutions array are required",
      });
    }

    const areaDoc = await Area.findById(areaId);
    if (!areaDoc) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    let savedCount = 0;
    let skippedCount = 0;

    for (const inst of institutions) {
      try {
        // Build phones array: merge legacy "contact" field into phones
        const phones = [...(inst.phones || [])];
        if (inst.contact && !phones.includes(inst.contact)) {
          phones.push(inst.contact);
        }

        await Institution.findOneAndUpdate(
          { name: inst.name, area: areaId },
          {
            name: inst.name,
            address: inst.address || "",
            phones: phones,
            emails: inst.emails || [],
            contacts: inst.contacts || [],
            website: inst.website || "",
            types: inst.types || ["school"],
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
      message: `Saved ${savedCount} institutions, skipped ${skippedCount} duplicates`,
      savedCount,
      skippedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved institutions for an area
// @route   GET /api/education/area/:areaId
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

    const institutions = await Institution.find(query)
      .populate("area", "pincode area city")
      .sort({ name: 1 });

    res.json({
      success: true,
      count: institutions.length,
      data: institutions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved institutions for a district
// @route   GET /api/education/district/:districtId
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

    const institutions = await Institution.find(query)
      .populate("area", "pincode area city")
      .sort({ name: 1 });

    res.json({
      success: true,
      count: institutions.length,
      data: institutions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved institutions count per area for a district
// @route   GET /api/education/district/:districtId/summary
exports.getDistrictSummary = async (req, res, next) => {
  try {
    const { districtId } = req.params;

    const summary = await Institution.aggregate([
      { $match: { district: require("mongoose").Types.ObjectId.createFromHexString(districtId) } },
      {
        $group: {
          _id: "$area",
          count: { $sum: 1 },
          schools: { $sum: { $cond: [{ $in: ["school", "$types"] }, 1, 0] } },
          colleges: { $sum: { $cond: [{ $in: ["college", "$types"] }, 1, 0] } },
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
          schools: 1,
          colleges: 1,
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

// @desc    Delete a saved institution
// @route   DELETE /api/education/:id
exports.deleteInstitution = async (req, res, next) => {
  try {
    const inst = await Institution.findByIdAndDelete(req.params.id);
    if (!inst) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }
    res.json({ success: true, message: "Institution deleted" });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete all saved institutions for an area
// @route   DELETE /api/education/area/:areaId/all
exports.deleteByArea = async (req, res, next) => {
  try {
    const result = await Institution.deleteMany({ area: req.params.areaId });
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} institutions`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a saved institution
// @route   PUT /api/education/:id
exports.updateInstitution = async (req, res, next) => {
  try {
    const { name, address, phones, emails, contacts, website, types } = req.body;
    const inst = await Institution.findByIdAndUpdate(
      req.params.id,
      { name, address, phones, emails, contacts, website, types },
      { new: true, runValidators: true }
    ).populate("area", "pincode area city");

    if (!inst) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }
    res.json({ success: true, data: inst });
  } catch (error) {
    next(error);
  }
};

// ==================== SCRAPER ====================

// @desc    Scrape a single institution's website for phones & emails
// @route   POST /api/education/:id/scrape
exports.scrapeInstitution = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }

    if (!inst.website) {
      return res.status(400).json({ success: false, message: "No website URL to scrape" });
    }

    const result = await scrapeWebsite(inst.website);

    if (result.error) {
      return res.json({
        success: true,
        scraped: false,
        message: `Scrape failed: ${result.error}`,
        data: { contacts: [], emails: [] },
      });
    }

    // Scraped phones → contacts[], scraped emails → emails[]
    const mergedContacts = Array.from(new Set([...inst.contacts, ...result.phones]));
    const mergedEmails = Array.from(new Set([...inst.emails, ...result.emails]));

    const updated = await Institution.findByIdAndUpdate(
      inst._id,
      { contacts: mergedContacts, emails: mergedEmails },
      { new: true }
    ).populate("area", "pincode area city");

    const newContacts = result.phones.filter((p) => !inst.contacts.includes(p));
    const newEmails = result.emails.filter((e) => !inst.emails.includes(e));

    res.json({
      success: true,
      scraped: true,
      message: `Found ${result.phones.length} contact(s) and ${result.emails.length} email(s) from website`,
      newContacts,
      newEmails,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Scrape all institutions for an area (batch)
// @route   POST /api/education/area/:areaId/scrape-all
exports.scrapeByArea = async (req, res, next) => {
  try {
    const institutions = await Institution.find({
      area: req.params.areaId,
      website: { $ne: "" },
    });

    if (institutions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No institutions with websites found for this area",
      });
    }

    let successCount = 0;
    let failCount = 0;
    let totalNewContacts = 0;
    let totalNewEmails = 0;

    for (const inst of institutions) {
      try {
        const result = await scrapeWebsite(inst.website);

        if (!result.error) {
          // Scraped phones → contacts[], scraped emails → emails[]
          const mergedContacts = Array.from(new Set([...inst.contacts, ...result.phones]));
          const mergedEmails = Array.from(new Set([...inst.emails, ...result.emails]));

          const newContacts = result.phones.filter((p) => !inst.contacts.includes(p)).length;
          const newEmails = result.emails.filter((e) => !inst.emails.includes(e)).length;

          await Institution.findByIdAndUpdate(inst._id, {
            contacts: mergedContacts,
            emails: mergedEmails,
          });

          totalNewContacts += newContacts;
          totalNewEmails += newEmails;
          successCount++;
        } else {
          failCount++;
        }

        // Rate limit: 500ms between scrapes
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Scraped ${successCount}/${institutions.length} websites. Found ${totalNewContacts} new contact(s), ${totalNewEmails} new email(s).`,
      total: institutions.length,
      successCount,
      failCount,
      totalNewContacts,
      totalNewEmails,
    });
  } catch (error) {
    next(error);
  }
};
