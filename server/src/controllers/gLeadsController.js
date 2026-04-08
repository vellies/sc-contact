const GLeads = require("../models/GLeads");
const fs     = require("fs");
const path   = require("path");

// ─── Resolve phoneNumbers from any Apollo source format ──────────────────────
// Priority: phone_numbers (direct) → userDetails.phone_numbers (nested old format) → phoneNumbers (already mapped)
function resolvePhoneNumbers(item) {
  const candidates = [
    item.phone_numbers,
    item.userDetails?.phone_numbers,
    item.phoneNumbers,
  ];
  for (const val of candidates) {
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return [];
}

// ─── Field mapper: Apollo JSON → GLeads schema ───────────────────────────────
function mapApolloRecord(item) {
  return {
    firstName:    item.first_name   || item.firstName   || "",
    lastName:     item.last_name    || item.lastName     || "",
    email:        (item.email || "").toLowerCase().trim(),
    phoneNumbers: resolvePhoneNumbers(item),
    linkedinUrl:  item.linkedin_url  || item.linkedinUrl  || "",
    title:        item.title    || "",
    headline:     item.headline || "",
    state:        item.state    || "",
    city:         item.city     || "",
    country:      item.country  || "",
  };
}

const BATCH_SIZE = 500;

async function batchInsert(records) {
  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const emails = chunk.map((r) => r.email);

    // Check existing in this chunk only
    const existing    = await GLeads.find({ email: { $in: emails } }).select("email").lean();
    const existingSet = new Set(existing.map((e) => e.email));
    const toInsert    = chunk.filter((r) => !existingSet.has(r.email));

    skipped += chunk.length - toInsert.length;

    if (toInsert.length === 0) continue;

    try {
      const result = await GLeads.insertMany(toInsert, { ordered: false });
      inserted += result.length;
    } catch (err) {
      if (err.code === 11000 || err.writeErrors) {
        // Count what actually got inserted despite duplicates
        inserted += err.result?.nInserted ?? 0;
        skipped  += err.writeErrors?.length ?? 0;
      } else {
        throw err;
      }
    }
  }

  return { inserted, skipped };
}

// @desc    Import Apollo JSON records (array in body OR file paths on disk)
// @route   POST /api/gleads/import
exports.importContacts = async (req, res, next) => {
  try {
    const { records, filePaths } = req.body;

    let raw = [];

    // Option A: array of records sent directly in request body
    if (Array.isArray(records) && records.length > 0) {
      raw = records;
    }

    // Option B: file paths on the server disk (legacy leads.js style)
    if (Array.isArray(filePaths) && filePaths.length > 0) {
      for (const fp of filePaths) {
        const resolved = path.resolve(fp);
        if (!fs.existsSync(resolved)) {
          return res.status(400).json({ success: false, message: `File not found: ${fp}` });
        }
        const content = JSON.parse(fs.readFileSync(resolved, "utf-8"));
        raw.push(...(Array.isArray(content) ? content : []));
      }
    }

    if (raw.length === 0) {
      return res.status(400).json({ success: false, message: "No records provided. Send `records` array or `filePaths` array." });
    }

    // Map fields
    const mapped = raw.map(mapApolloRecord).filter((r) => r.email);
    if (mapped.length === 0) {
      return res.status(400).json({ success: false, message: "No valid records (all missing email)." });
    }

    // Deduplicate within the incoming batch
    const seen   = new Set();
    const unique = mapped.filter((r) => { if (seen.has(r.email)) return false; seen.add(r.email); return true; });

    // Batch insert
    const { inserted, skipped } = await batchInsert(unique);

    res.json({
      success: true,
      message: `Import complete: ${inserted} inserted, ${skipped} skipped (duplicate)`,
      data: { total: raw.length, mapped: mapped.length, inserted, skipped },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Fix phoneNumbers from userDetails.phone_numbers for all existing records
// @route   POST /api/gleads/fix-phones
exports.fixPhoneNumbers = async (req, res, next) => {
  try {
    const result = await GLeads.updateMany(
      {},
      [
        {
          $set: {
            phoneNumbers: {
              $cond: {
                if: {
                  $and: [
                    { $isArray: "$userDetails.phone_numbers" },
                    { $gt: [{ $size: "$userDetails.phone_numbers" }, 0] },
                  ],
                },
                then: "$userDetails.phone_numbers",
                else: "$phoneNumbers",
              },
            },
          },
        },
      ]
    );
    res.json({
      success: true,
      message: `Phone numbers updated for ${result.modifiedCount} records`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    List JSON files in a given directory on the server
// @route   POST /api/gleads/list-files
exports.listFiles = async (req, res, next) => {
  try {
    const { dir } = req.body;
    if (!dir) {
      return res.status(400).json({ success: false, message: "Provide `dir` in request body" });
    }
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, message: `Directory not found: ${dir}` });
    }
    const files = fs.readdirSync(resolved).filter((f) => f.endsWith(".json"));
    const filePaths = files.map((f) => path.join(resolved, f));
    res.json({ success: true, data: { dir: resolved, files: filePaths, count: filePaths.length } });
  } catch (err) {
    next(err);
  }
};

// @desc    Find duplicate emails in the geto_leads collection
// @route   GET /api/gleads/duplicates
exports.getDuplicates = async (_req, res, next) => {
  try {
    const duplicates = await GLeads.aggregate([
      { $group: { _id: "$email", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $project: { _id: 0, email: "$_id", count: 1 } },
      { $sort: { count: -1 } },
    ]);
    res.json({
      success: true,
      data: { count: duplicates.length, duplicates },
      message: duplicates.length > 0 ? `${duplicates.length} duplicate email(s) found` : "No duplicates found",
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all gLeads with filters & pagination
// @route   GET /api/gleads/contacts
exports.getContacts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      state,
      city,
      country,
      title,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};

    if (status)  filter.status  = status;
    if (state)   filter.state   = { $regex: state,   $options: "i" };
    if (city)    filter.city    = { $regex: city,     $options: "i" };
    if (country) filter.country = { $regex: country,  $options: "i" };
    if (title)   filter.title   = { $regex: title,    $options: "i" };

    if (search) {
      filter.$or = [
        { email:     { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName:  { $regex: search, $options: "i" } },
        { title:     { $regex: search, $options: "i" } },
        { city:      { $regex: search, $options: "i" } },
      ];
    }

    const skip    = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sort]: order === "asc" ? 1 : -1 };

    const [data, totalCount] = await Promise.all([
      GLeads.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
      GLeads.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        contacts: data,
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Dashboard stats
// @route   GET /api/gleads/stats
exports.getStats = async (req, res, next) => {
  try {
    const [
      total,
      withLinkedin,
      pending,
      contacted,
      replied,
      demo,
      closed,
      invalid,
    ] = await Promise.all([
      GLeads.countDocuments(),
      GLeads.countDocuments({ linkedinUrl: { $ne: "" } }),
      GLeads.countDocuments({ status: "pending" }),
      GLeads.countDocuments({ status: "contacted" }),
      GLeads.countDocuments({ status: "replied" }),
      GLeads.countDocuments({ status: "demo" }),
      GLeads.countDocuments({ status: "closed" }),
      GLeads.countDocuments({ status: "invalid" }),
    ]);

    // phoneNumbers is stored as an array (Apollo format) — use $isArray + $size
    const withPhoneAgg = await GLeads.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              { $isArray: "$phoneNumbers" },
              { $gt: [{ $size: "$phoneNumbers" }, 0] },
            ],
          },
        },
      },
      { $count: "count" },
    ]);
    const withPhone = withPhoneAgg[0]?.count ?? 0;

    const byCountry = await GLeads.aggregate([
      { $match: { country: { $ne: "" } } },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const byState = await GLeads.aggregate([
      { $match: { state: { $ne: "" } } },
      { $group: { _id: "$state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const byCity = await GLeads.aggregate([
      { $match: { city: { $ne: "" } } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const byTitle = await GLeads.aggregate([
      { $match: { title: { $ne: "" } } },
      { $group: { _id: "$title", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        total,
        withPhone,
        withLinkedin,
        statusBreakdown: { pending, contacted, replied, demo, closed, invalid },
        byCountry,
        byState,
        byCity,
        byTitle,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single lead by email
// @route   GET /api/gleads/contact/:email
exports.getByEmail = async (req, res, next) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const contact = await GLeads.findOne({ email }).lean();
    if (!contact) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
};

// @desc    Update single lead status by email
// @route   PATCH /api/gleads/contact/:email
exports.updateByEmail = async (req, res, next) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const { status } = req.body;
    const validStatuses = ["pending", "contacted", "replied", "demo", "closed", "invalid"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const contact = await GLeads.findOneAndUpdate({ email }, { status }, { new: true }).lean();
    if (!contact) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
};

// @desc    Bulk update status
// @route   POST /api/gleads/bulk-update-status
exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    const validStatuses = ["pending", "contacted", "replied", "demo", "closed", "invalid"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (!ids || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No contacts selected" });
    }

    const result = await GLeads.updateMany({ _id: { $in: ids } }, { status });
    res.json({
      success: true,
      message: `${result.modifiedCount} contacts updated to "${status}"`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a lead
// @route   DELETE /api/gleads/contacts/:id
exports.deleteContact = async (req, res, next) => {
  try {
    const contact = await GLeads.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }
    res.json({ success: true, message: "Contact deleted" });
  } catch (err) {
    next(err);
  }
};

// @desc    Export contacts as JSON (paginated for large datasets)
// @route   GET /api/gleads/export?page=1&limit=2000&...filters
exports.exportContacts = async (req, res, next) => {
  try {
    const { search, status, state, city, country, title, page = 1, limit = 2000 } = req.query;

    const filter = {};
    if (status)  filter.status  = status;
    if (state)   filter.state   = { $regex: state,   $options: "i" };
    if (city)    filter.city    = { $regex: city,     $options: "i" };
    if (country) filter.country = { $regex: country,  $options: "i" };
    if (title)   filter.title   = { $regex: title,    $options: "i" };

    if (search) {
      filter.$or = [
        { email:     { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName:  { $regex: search, $options: "i" } },
        { title:     { $regex: search, $options: "i" } },
      ];
    }

    const pageNum   = parseInt(page);
    const limitNum  = Math.min(parseInt(limit), 5000); // hard cap at 5000 per page
    const skip      = (pageNum - 1) * limitNum;
    const totalCount = await GLeads.countDocuments(filter);

    const contacts = await GLeads.find(filter)
      .select("firstName lastName email phoneNumbers linkedinUrl title headline state city country status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      success:    true,
      data:       contacts,
      count:      contacts.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      page:       pageNum,
    });
  } catch (err) {
    next(err);
  }
};
