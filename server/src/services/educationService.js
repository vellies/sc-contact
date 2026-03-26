const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// ==================== STEP 1: TEXT SEARCH ====================
async function fetchPlaces(pincode, city, area) {
  const queries = [
    `schools in ${area} ${city} ${pincode}`,
    `colleges in ${area} ${city} ${pincode}`,
    `polytechnic in ${area} ${city} ${pincode}`,
    `ITI in ${area} ${city} ${pincode}`,
  ];

  let allResults = [];

  for (const query of queries) {
    let nextPageToken = null;

    do {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        query
      )}&key=${GOOGLE_API_KEY}${
        nextPageToken ? `&pagetoken=${nextPageToken}` : ""
      }`;

      const res = await axios.get(url);
      allResults.push(...res.data.results);

      nextPageToken = res.data.next_page_token;
      if (nextPageToken) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } while (nextPageToken);
  }

  return allResults;
}

// ==================== STEP 2: PRIVATE FILTER ====================
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

// ==================== STEP 3: STRICT AREA FILTER ====================
function isStrictArea(place, input) {
  const addr = (place.formatted_address || "").toLowerCase();
  return (
    addr.includes(input.area.toLowerCase()) ||
    addr.includes(input.pincode)
  );
}

// ==================== STEP 4: PLACE DETAILS (expanded fields) ====================
async function getPlaceDetails(place_id) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,website,formatted_phone_number,international_phone_number,url&key=${GOOGLE_API_KEY}`;

  const res = await axios.get(url);
  const result = res.data.result || {};

  // Collect all phone numbers (deduplicated)
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
    emails: [], // Google Places doesn't return emails; will be added manually
    contacts: [], // Contact persons — added manually
  };
}

// ==================== STEP 5: TYPE DETECTION ====================
function inferType(name) {
  const n = name.toLowerCase();
  if (n.includes("college")) return ["college"];
  if (n.includes("polytechnic")) return ["polytechnic"];
  if (n.includes("iti")) return ["iti"];
  return ["school"];
}

// ==================== STEP 6: FORMAT ====================
async function formatPlace(place) {
  const details = await getPlaceDetails(place.place_id);
  return {
    name: place.name,
    address: place.formatted_address || "",
    phones: details.phones,
    emails: details.emails,
    contacts: details.contacts,
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
async function findEducationInstitutions({ pincode, city, area }) {
  // 1. Fetch places
  const places = await fetchPlaces(pincode, city || "", area);
  console.log(`[Education] Raw results: ${places.length}`);

  // 2. Apply filters
  const filtered = places
    .filter((p) => isPrivate(p.name))
    .filter((p) => isStrictArea(p, { area, pincode }));
  console.log(`[Education] After strict filter: ${filtered.length}`);

  // 3. Limit for cost safety
  const limited = filtered.slice(0, 40);

  // 4. Fetch details
  const results = [];
  for (const place of limited) {
    try {
      const item = await formatPlace(place);
      results.push(item);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.log(`[Education] Skip: ${place.name}`);
    }
  }

  // 5. Deduplicate
  return dedupe(results);
}

module.exports = {
  findEducationInstitutions,
};
