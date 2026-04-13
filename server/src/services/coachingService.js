const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// const SEARCH_KEYWORDS = [
//   "coaching institute",
//   "training institute",
//   "coaching center",
//   "tuition center",
//   "NEET coaching",
//   "IIT JEE coaching",
//   "spoken english institute",
//   "computer training center",
//   "skill development center",
//   "MBA coaching",
//   "CA coaching",
//   "bank exam coaching",
//   "government exam coaching",
//   "digital marketing training",
//   "software training institute",
// ];

// const SEARCH_KEYWORDS =  [

//   // Direct targets - these NEED enrollment management
//   "coaching institute",
//   "training institute",
//   "coaching center",
//   "training center",
//   "coaching academy",
//   "training academy",
//   "tuition center",
//   "coaching class",

//   // High value targets - large institutes
//   "NEET coaching",
//   "IIT coaching",
//   "JEE coaching",
//   "UPSC coaching",
//   "IAS coaching",
//   "TNPSC coaching",
//   "bank exam coaching",
//   "SSC coaching",
//   "gate coaching",
//   "CAT coaching",

//   // IT Training - definitely need enrollment system
//   "software training institute",
//   "computer training institute",
//   "IT training center",
//   "python training",
//   "java training",
//   "digital marketing training",
//   "data science training",
//   "web development training",

//   // Skill training
//   "skill development center",
//   "vocational training center",
//   "spoken english institute",
//   "IELTS coaching",
//   "personality development",

//   // Professional training
//   "professional training institute",
//   "corporate training center",
//   "management training institute"
// ];


const SEARCH_KEYWORDS = [
  "coaching center",      // Catches most coaching institutes
  "coaching institute",   // Catches institutes not using "center"
  "training institute",   // Catches all training types
  "academy",              // Catches "XYZ Academy" brand names
];

// ==================== STEP 1: TEXT SEARCH ====================
// Pagination enabled — up to 3 pages (60 results) per keyword.
// 4 keywords × 60 = up to 240 raw results.
// 4 keywords × 2 extra pages × 2s delay = ~16s extra — well within timeout.
async function fetchPlaces(pincode, city, area) {
  let allResults = [];

  for (const keyword of SEARCH_KEYWORDS) {
    const query = `${keyword} in ${area} ${city} ${pincode}`;
    let nextPageToken = null;

    do {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        query
      )}&key=${GOOGLE_API_KEY}${nextPageToken ? `&pagetoken=${nextPageToken}` : ""}`;

      try {
        const res = await axios.get(url);
        allResults.push(...(res.data.results || []));
        nextPageToken = res.data.next_page_token || null;
        if (nextPageToken) await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.log(`[Coaching] Keyword skip: "${keyword}" — ${err.message}`);
        nextPageToken = null;
      }
    } while (nextPageToken);
  }

  return allResults;
}

// ==================== STEP 2: GOVERNMENT FILTER ====================
function isPrivate(name) {
  const blacklist = [
    "government",
    "govt",
    "municipal",
    "corporation",
    "panchayat",
    "ghss",
    "ghs",
  ];
  const lower = name.toLowerCase();
  return !blacklist.some((k) => lower.includes(k));
}


// ==================== STEP 4: PLACE DETAILS ====================
async function getPlaceDetails(place_id) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,website,formatted_phone_number,international_phone_number,url&key=${GOOGLE_API_KEY}`;
  const res = await axios.get(url);
  const result = res.data.result || {};

  const phones = [];
  if (result.formatted_phone_number) {
    phones.push(result.formatted_phone_number.trim());
  }
  if (
    result.international_phone_number &&
    result.international_phone_number !== result.formatted_phone_number
  ) {
    phones.push(result.international_phone_number.trim());
  }

  return {
    website: result.website || "",
    phones,
  };
}

// ==================== STEP 4B: WEB SCRAPER ====================
async function scrapeWebsite(url) {
  if (!url) return { emails: [], phones: [] };

  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      },
      maxRedirects: 3,
    });

    const html = String(res.data);

    // Extract emails — filter out false positives (image files, known noise domains)
    const rawEmails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g) || [];
    const emails = [
      ...new Set(
        rawEmails.filter(
          (e) =>
            !e.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf|eot)$/i) &&
            !e.includes("example.com") &&
            !e.includes("sentry.io") &&
            !e.includes("schema.org") &&
            !e.includes("w3.org") &&
            !e.includes("googleapis.com")
        )
      ),
    ].slice(0, 5);

    // Extract Indian mobile numbers
    const rawPhones = html.match(/(?:\+91[\s-]?)?[6-9]\d{9}/g) || [];
    const phones = [...new Set(rawPhones.map((p) => p.trim()))].slice(0, 5);

    return { emails, phones };
  } catch {
    return { emails: [], phones: [] };
  }
}

// ==================== STEP 5: TYPE DETECTION ====================
function inferType(name) {
  const n = name.toLowerCase();
  if (
    n.includes("jee") ||
    n.includes("iit") ||
    n.includes("neet") ||
    n.includes("medical") ||
    n.includes("mba") ||
    n.includes("ca ") ||
    n.includes("bank exam") ||
    n.includes("government exam") ||
    n.includes("competitive")
  ) {
    return ["test_prep"];
  }
  if (
    n.includes("skill") ||
    n.includes("digital marketing") ||
    n.includes("software") ||
    n.includes("computer") ||
    n.includes("vocational") ||
    n.includes("training")
  ) {
    return ["skill_training"];
  }
  if (
    n.includes("tutor") ||
    n.includes("tuition") ||
    n.includes("tution") ||
    n.includes("spoken english")
  ) {
    return ["tutoring"];
  }
  return ["coaching"];
}

// ==================== STEP 6: FORMAT ====================
async function formatPlace(place) {
  const details = await getPlaceDetails(place.place_id);
  const scraped = await scrapeWebsite(details.website);

  // Merge phones: Google first, then scraped extras
  const allPhones = [...new Set([...details.phones, ...scraped.phones])];

  return {
    name: place.name,
    address: place.formatted_address || "",
    phones: allPhones,
    emails: scraped.emails,
    contacts: [],
    website: details.website,
    types: inferType(place.name),
  };
}

// ==================== STEP 7: DEDUPE ====================
function dedupe(data) {
  return Array.from(
    new Map(data.map((i) => [i.name + i.address, i])).values()
  );
}

// ==================== MAIN FUNCTION ====================
async function findCoachingInstitutes({ pincode, city, area }) {
  // 1. Fetch places (15 keyword queries)
  const places = await fetchPlaces(pincode, city || "", area);
  console.log(`[Coaching] Raw results: ${places.length}`);

  // 2. Apply filters — govt blacklist + pincode match only
  const filtered = places
    .filter((p) => isPrivate(p.name))
    .filter((p) => (p.formatted_address || "").includes(pincode));
  console.log(`[Coaching] After filter: ${filtered.length}`);

  // 3. Dedupe before fetching details (saves API calls)
  const deduped = dedupe(filtered);
  console.log(`[Coaching] After pre-dedupe: ${deduped.length}`);

  // 4. Fetch details for all filtered results
  const results = [];
  for (const place of deduped) {
    try {
      const item = await formatPlace(place);
      results.push(item);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.log(`[Coaching] Skip: ${place.name} — ${err.message}`);
    }
  }

  // 5. Final dedupe on name+address (catches any remaining duplicates)
  const final = dedupe(results);
  console.log(`[Coaching] Final results: ${final.length}`);
  return final;
}

module.exports = {
  findCoachingInstitutes,
  scrapeWebsite,
};
