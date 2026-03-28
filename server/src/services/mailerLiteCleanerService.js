const MailerLiteContact = require("../models/MailerLiteContact");
const Institution = require("../models/Institution");
const Area = require("../models/Area");
const District = require("../models/District");
const State = require("../models/State");

// ─── Email Validation ───────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const GENERIC_PREFIXES = [
  "info",
  "admin",
  "noreply",
  "no-reply",
  "support",
  "contact",
  "hello",
  "help",
  "sales",
  "marketing",
  "webmaster",
  "postmaster",
  "office",
  "enquiry",
  "enquiries",
  "feedback",
  "general",
  "mail",
  "reception",
];

const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "dispostable.com",
  "trashmail.com",
];

const INVALID_PATTERNS = [
  "example.com",
  "test.com",
  "sample.com",
  "abc.com",
  "xyz.com",
  "123.com",
  "email.com",
  "domain.com",
  ".png",
  ".jpg",
  ".gif",
  ".jpeg",
  ".svg",
];

function validateEmail(email) {
  if (!email || typeof email !== "string") return { valid: false, generic: false };

  const cleaned = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleaned)) return { valid: false, generic: false };

  // Check for invalid/test domains
  const isInvalid = INVALID_PATTERNS.some((p) => cleaned.includes(p));
  if (isInvalid) return { valid: false, generic: false };

  // Check for disposable domains
  const domain = cleaned.split("@")[1];
  if (DISPOSABLE_DOMAINS.includes(domain)) return { valid: false, generic: false };

  // Check if generic prefix
  const prefix = cleaned.split("@")[0];
  const isGeneric = GENERIC_PREFIXES.includes(prefix);

  return { valid: true, generic: isGeneric, cleaned };
}

// ─── Phone Validation & Normalization ───────────────────────────────
function cleanPhone(phone) {
  if (!phone || typeof phone !== "string") return { valid: false, cleaned: "" };

  // Strip all non-digit characters except leading +
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.substring(1);

  // Toll-free: 1800
  if (digits.startsWith("1800") && digits.length >= 10 && digits.length <= 13) {
    return { valid: true, cleaned: digits };
  }

  // Remove leading 0 for Indian landline
  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 12) {
    return { valid: true, cleaned: "0" + digits.substring(1) };
  }

  // Remove leading 91 country code
  if (digits.startsWith("91") && digits.length >= 12) {
    digits = digits.substring(2);
  }

  // 10-digit mobile starting with 6-9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return { valid: true, cleaned: "+91" + digits };
  }

  return { valid: false, cleaned: phone.trim() };
}

// ─── Contact Name Parsing ───────────────────────────────────────────
const DESIGNATION_KEYWORDS = [
  "principal",
  "director",
  "manager",
  "coordinator",
  "hod",
  "head",
  "dean",
  "chairman",
  "chairperson",
  "secretary",
  "registrar",
  "administrator",
  "superintendent",
  "officer",
  "teacher",
  "professor",
  "lecturer",
  "correspondent",
  "trustee",
  "founder",
  "president",
  "vice",
  "sir",
  "madam",
];

function parseContact(contactStr) {
  if (!contactStr || typeof contactStr !== "string")
    return { name: "", designation: "" };

  const cleaned = contactStr.trim();
  if (!cleaned) return { name: "", designation: "" };

  // Try splitting by common separators: -, –, :, |, /
  const separators = [" - ", " – ", ": ", " | ", " / ", ","];
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const parts = cleaned.split(sep).map((p) => p.trim());
      if (parts.length === 2) {
        const part0Lower = parts[0].toLowerCase();
        const part1Lower = parts[1].toLowerCase();
        const part0IsDesig = DESIGNATION_KEYWORDS.some((k) => part0Lower.includes(k));
        const part1IsDesig = DESIGNATION_KEYWORDS.some((k) => part1Lower.includes(k));

        if (part1IsDesig && !part0IsDesig) {
          return { name: parts[0], designation: parts[1] };
        }
        if (part0IsDesig && !part1IsDesig) {
          return { name: parts[1], designation: parts[0] };
        }
        // Default: first part = name, second = designation
        return { name: parts[0], designation: parts[1] };
      }
    }
  }

  // No separator — check if entire string is a designation
  const lower = cleaned.toLowerCase();
  const isDesig = DESIGNATION_KEYWORDS.some((k) => lower.includes(k));
  if (isDesig) {
    return { name: "", designation: cleaned };
  }

  return { name: cleaned, designation: "" };
}

// ─── Process Single Institution → MailerLiteContact rows ────────────
async function processInstitution(institution, locationCache = {}) {
  // Populate location names
  let areaName = "",
    pincode = "",
    districtName = "",
    stateName = "";

  try {
    if (institution.area) {
      const cacheKey = `area_${institution.area}`;
      if (locationCache[cacheKey]) {
        ({ areaName, pincode } = locationCache[cacheKey]);
      } else {
        const area = await Area.findById(institution.area).lean();
        if (area) {
          areaName = area.area || "";
          pincode = area.pincode || "";
          locationCache[cacheKey] = { areaName, pincode };
        }
      }
    }
    if (institution.district) {
      const cacheKey = `dist_${institution.district}`;
      if (locationCache[cacheKey]) {
        districtName = locationCache[cacheKey];
      } else {
        const dist = await District.findById(institution.district).lean();
        if (dist) {
          districtName = dist.name || "";
          locationCache[cacheKey] = districtName;
        }
      }
    }
    if (institution.state) {
      const cacheKey = `state_${institution.state}`;
      if (locationCache[cacheKey]) {
        stateName = locationCache[cacheKey];
      } else {
        const st = await State.findById(institution.state).lean();
        if (st) {
          stateName = st.name || "";
          locationCache[cacheKey] = stateName;
        }
      }
    }
  } catch {
    // Location lookup failed — continue with empty strings
  }

  // Parse first contact
  const { name: contactName, designation } = parseContact(
    institution.contacts && institution.contacts.length > 0
      ? institution.contacts[0]
      : ""
  );

  // Get primary phone
  let primaryPhone = { valid: false, cleaned: "" };
  if (institution.phones && institution.phones.length > 0) {
    for (const ph of institution.phones) {
      const result = cleanPhone(ph);
      if (result.valid) {
        primaryPhone = result;
        break;
      }
    }
    // If none valid, use first one cleaned
    if (!primaryPhone.valid && institution.phones[0]) {
      primaryPhone = cleanPhone(institution.phones[0]);
    }
  }

  // Pick the BEST single email: prefer valid non-generic, then valid generic, then first
  if (!institution.emails || institution.emails.length === 0) return null;

  let bestEmail = null;
  let bestValid = false;
  let bestGeneric = true;

  for (const rawEmail of institution.emails) {
    const { valid, generic, cleaned } = validateEmail(rawEmail);
    if (!cleaned) continue;

    // Priority: valid + non-generic > valid + generic > invalid
    if (!bestEmail) {
      bestEmail = { cleaned, valid, generic };
      bestValid = valid;
      bestGeneric = generic;
    } else if (valid && !generic && (bestGeneric || !bestValid)) {
      // Found a valid non-generic — best possible
      bestEmail = { cleaned, valid, generic };
      bestValid = valid;
      bestGeneric = generic;
    } else if (valid && !bestValid) {
      // Found a valid one, current is invalid
      bestEmail = { cleaned, valid, generic };
      bestValid = valid;
      bestGeneric = generic;
    }
  }

  if (!bestEmail) return null;

  return {
    institution: institution._id,
    email: bestEmail.cleaned,
    phone: primaryPhone.cleaned,
    contactName,
    designation,
    institutionName: institution.name || "",
    institutionType: (institution.types && institution.types[0]) || "school",
    website: institution.website || "",
    address: institution.address || "",
    areaName,
    pincode,
    districtName,
    stateName,
    emailValid: bestEmail.valid,
    phoneValid: primaryPhone.valid,
    isGenericEmail: bestEmail.generic,
    status: "pending",
  };
}

// ─── Sync single institution (for hooks) ────────────────────────────
async function syncInstitution(institutionId) {
  const institution = await Institution.findById(institutionId).lean();
  if (!institution) {
    // Institution deleted — remove contacts
    await MailerLiteContact.deleteMany({ institution: institutionId });
    return { removed: true };
  }

  const row = await processInstitution(institution);

  // No valid email — remove existing contact if any
  if (!row) {
    const removed = await MailerLiteContact.deleteMany({ institution: institutionId });
    return { created: 0, updated: 0, removed: removed.deletedCount };
  }

  // Check if existing contact for this institution
  const existing = await MailerLiteContact.findOne({ institution: institutionId }).lean();

  if (existing) {
    // Check if new email conflicts with another institution's email
    if (existing.email !== row.email) {
      const emailTaken = await MailerLiteContact.findOne({
        email: row.email,
        institution: { $ne: institutionId },
      }).lean();
      if (emailTaken) {
        // Email belongs to another institution — skip update
        return { created: 0, updated: 0, removed: 0, skipped: 1 };
      }
    }
    await MailerLiteContact.updateOne(
      { institution: institutionId },
      { $set: { ...row, status: existing.status } }
    );
    return { created: 0, updated: 1, removed: 0 };
  } else {
    // Check if email already exists globally
    const emailTaken = await MailerLiteContact.findOne({ email: row.email }).lean();
    if (emailTaken) {
      // Duplicate email — skip
      return { created: 0, updated: 0, removed: 0, skipped: 1 };
    }
    await MailerLiteContact.create(row);
    return { created: 1, updated: 0, removed: 0 };
  }
}

// ─── Bulk generate: process ALL institutions ────────────────────────
async function bulkGenerate(filter = {}) {
  const institutions = await Institution.find(filter).lean();
  const locationCache = {};
  let totalCreated = 0,
    totalUpdated = 0,
    totalSkipped = 0;

  // Collect one row per institution (best email), sorted by createdAt (oldest first wins email)
  const sortedInstitutions = await Institution.find(filter)
    .sort({ createdAt: 1 })
    .lean();

  const allRows = [];
  const seenEmails = new Set();
  let duplicates = 0;

  for (const inst of sortedInstitutions) {
    const row = await processInstitution(inst, locationCache);
    if (!row) continue;

    if (seenEmails.has(row.email)) {
      // Duplicate email — skip (first institution keeps it)
      duplicates++;
      continue;
    }
    seenEmails.add(row.email);
    allRows.push(row);
  }

  // Clear old contacts for full regenerate
  if (Object.keys(filter).length === 0) {
    await MailerLiteContact.deleteMany({});
  }

  // Bulk upsert — one per institution, unique email enforced
  const bulkOps = allRows.map((row) => ({
    updateOne: {
      filter: { institution: row.institution },
      update: { $set: row },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < bulkOps.length; i += batchSize) {
      const batch = bulkOps.slice(i, i + batchSize);
      const result = await MailerLiteContact.bulkWrite(batch, { ordered: false });
      totalCreated += result.upsertedCount || 0;
      totalUpdated += result.modifiedCount || 0;
    }
  }

  totalSkipped = sortedInstitutions.length - allRows.length;

  return {
    institutionsProcessed: sortedInstitutions.length,
    contactsCreated: totalCreated,
    contactsUpdated: totalUpdated,
    institutionsSkipped: totalSkipped,
    totalContacts: allRows.length,
    uniqueEmails: seenEmails.size,
    duplicates,
  };
}

// ─── Remove institution contacts (for delete hook) ──────────────────
async function removeInstitutionContacts(institutionId) {
  const result = await MailerLiteContact.deleteMany({ institution: institutionId });
  return result.deletedCount;
}

module.exports = {
  validateEmail,
  cleanPhone,
  parseContact,
  processInstitution,
  syncInstitution,
  bulkGenerate,
  removeInstitutionContacts,
};
