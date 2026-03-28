const MailerLiteContact = require("../models/MailerLiteContact");
const {
  bulkGenerate,
  syncInstitution,
} = require("../services/mailerLiteCleanerService");

// @desc    Get all MailerLite contacts with filters & pagination
// @route   GET /api/mailerlite/contacts
exports.getContacts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      institutionType,
      state,
      district,
      area,
      emailValid,
      isGenericEmail,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};

    if (status) filter.status = status;

    if (institutionType) filter.institutionType = institutionType;
    if (state) filter.stateName = { $regex: state, $options: "i" };
    if (district) filter.districtName = { $regex: district, $options: "i" };
    if (area) filter.areaName = { $regex: area, $options: "i" };
    if (emailValid !== undefined) filter.emailValid = emailValid === "true";
    if (isGenericEmail !== undefined) filter.isGenericEmail = isGenericEmail === "true";

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { institutionName: { $regex: search, $options: "i" } },
        { contactName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sort]: order === "asc" ? 1 : -1 };

    const [data, totalCount] = await Promise.all([
      MailerLiteContact.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MailerLiteContact.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        contacts: data,
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Dashboard stats for MailerLite contacts
// @route   GET /api/mailerlite/stats
exports.getStats = async (req, res, next) => {
  try {
    const [
      total,
      validEmails,
      invalidEmails,
      genericEmails,
      withPhone,
      pending,
      added,
    ] = await Promise.all([
      MailerLiteContact.countDocuments(),
      MailerLiteContact.countDocuments({ emailValid: true }),
      MailerLiteContact.countDocuments({ emailValid: false }),
      MailerLiteContact.countDocuments({ isGenericEmail: true }),
      MailerLiteContact.countDocuments({ phoneValid: true }),
      MailerLiteContact.countDocuments({ status: "pending" }),
      MailerLiteContact.countDocuments({ status: "added" }),
    ]);

    // By institution type
    const byType = await MailerLiteContact.aggregate([
      { $group: { _id: "$institutionType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // By state (top 10)
    const byState = await MailerLiteContact.aggregate([
      { $match: { stateName: { $ne: "" } } },
      { $group: { _id: "$stateName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // By district (top 10)
    const byDistrict = await MailerLiteContact.aggregate([
      { $match: { districtName: { $ne: "" } } },
      { $group: { _id: "$districtName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Sendable count (valid, not generic)
    const sendable = await MailerLiteContact.countDocuments({
      emailValid: true,
      isGenericEmail: false,
    });

    res.json({
      success: true,
      data: {
        total,
        validEmails,
        invalidEmails,
        genericEmails,
        withPhone,
        sendable,
        statusBreakdown: { pending, added },
        byType,
        byState,
        byDistrict,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Bulk generate MailerLite contacts from institutions
// @route   POST /api/mailerlite/generate
exports.generate = async (req, res, next) => {
  try {
    const { state, district, area } = req.body;
    const filter = {};
    if (state) filter.state = state;
    if (district) filter.district = district;
    if (area) filter.area = area;

    const result = await bulkGenerate(filter);

    res.json({
      success: true,
      message: "MailerLite contacts generated successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Re-sync a single institution
// @route   POST /api/mailerlite/sync/:institutionId
exports.syncOne = async (req, res, next) => {
  try {
    const result = await syncInstitution(req.params.institutionId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a MailerLite contact
// @route   DELETE /api/mailerlite/contacts/:id
exports.deleteContact = async (req, res, next) => {
  try {
    const contact = await MailerLiteContact.findByIdAndUpdate(
      req.params.id,
      { status: "removed" },
      { new: true }
    );
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }
    res.json({ success: true, message: "Contact removed" });
  } catch (err) {
    next(err);
  }
};

// @desc    Bulk update status of contacts
// @route   POST /api/mailerlite/bulk-update-status
exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body;

    const validStatuses = ["pending", "added"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (!ids || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No contacts selected" });
    }

    const result = await MailerLiteContact.updateMany(
      { _id: { $in: ids } },
      { status }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} contacts updated to "${status}"`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Export contacts as JSON (for MailerLite CSV import)
// @route   GET /api/mailerlite/export
exports.exportContacts = async (req, res, next) => {
  try {
    const { onlyValid = "true", excludeGeneric = "true" } = req.query;

    const filter = {};
    if (onlyValid === "true") filter.emailValid = true;
    if (excludeGeneric === "true") filter.isGenericEmail = false;

    const contacts = await MailerLiteContact.find(filter)
      .select(
        "email phone contactName designation institutionName institutionType website address areaName pincode districtName stateName"
      )
      .lean();

    res.json({ success: true, data: contacts, count: contacts.length });
  } catch (err) {
    next(err);
  }
};
