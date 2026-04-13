# Coaching Institute Finder — Implementation Plan

## Overview

A module to find and manage **Coaching Institutes** using the Google Places API.
Mirrors the Education Finder in structure but is tailored to coaching/tutoring centers.

> **Data source**: Google Places API only (Text Search + Place Details). No web scraper.

---

## Key Differences from Education Finder

| Feature | Education Finder | Coaching Finder |
|---|---|---|
| Search queries | schools, colleges, polytechnic, ITI | 15 targeted coaching keywords (see below) |
| Institute types | school, college, polytechnic, iti | coaching, tutoring, test_prep, skill_training |
| Government filter | Yes (blacklist govt/municipal) | **Yes** — same blacklist as education |
| Scraper | Yes | **No** — Google API only |
| Model name | `Institution` | `CoachingInstitute` |

---

## Google API Search Queries

For each (pincode, city, area) combination the service fires **15 queries** — one per keyword:

```js
const SEARCH_KEYWORDS = [
  "coaching institute",
  "training institute",
  "coaching center",
  "tuition center",
  "NEET coaching",
  "IIT JEE coaching",
  "spoken english institute",
  "computer training center",
  "skill development center",
  "MBA coaching",
  "CA coaching",
  "bank exam coaching",
  "digital marketing training",
  "software training institute"
];
```

Each query is built as: `"{keyword} in {area} {city} {pincode}"`
Each query paginates with `next_page_token` (up to 3 pages / 60 results per query).
Results from all 15 queries are merged and deduplicated by `name + address`.

## Government Filter

Same blacklist as Education Finder — removes results whose name contains:

```
government, govt, municipal, corporation, panchayat, ghss, ghs
```

---

## Type Detection

Inferred from the place name:

| Keyword in name | Type assigned |
|---|---|
| jee / iit / neet / medical | `test_prep` |
| skill / vocational / training | `skill_training` |
| tutor / tution / tuition | `tutoring` |
| (default) | `coaching` |

---

## Data Model — `CoachingInstitute`

**File:** `server/src/models/CoachingInstitute.js`

```js
{
  name:     String (required, unique per area)
  address:  String
  phones:   [String]
  emails:   [String]
  contacts: [String]   // contact person names / designations
  website:  String
  types:    [enum: "coaching" | "tutoring" | "test_prep" | "skill_training"]
  area:     ObjectId → Area
  district: ObjectId → District
  state:    ObjectId → State
  timestamps: true
}

Indexes:
  { name: 1, area: 1 } unique
  { area: 1 }, { district: 1 }, { state: 1 }, { types: 1 }
```

---

## Backend Files to Create

```
server/src/
├── models/
│   └── CoachingInstitute.js          ← Mongoose model
├── services/
│   └── coachingService.js            ← Google API logic
├── controllers/
│   └── coachingController.js         ← Route handlers
├── validators/
│   └── coachingValidator.js          ← Zod validation
└── routes/
    └── coachingRoutes.js             ← Express router
```

Register in `server/src/app.js` (or index):
```js
app.use("/api/coaching", require("./routes/coachingRoutes"));
```

---

## API Endpoints

### Search (Google Places — no DB write)

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/coaching/search` | `{ pincode, area, city? }` | Direct Google search |
| POST | `/api/coaching/search-by-area` | `{ areaId }` | Auto-fill from Area doc |
| POST | `/api/coaching/search-by-district` | `{ districtId, limit? }` | Batch search all areas |

### Save / CRUD (MongoDB)

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/coaching/save` | `{ areaId, institutes[] }` | Upsert results to DB |
| GET | `/api/coaching/all` | query params | Paginated list with filters |
| GET | `/api/coaching/area/:areaId` | — | Institutes for an area |
| GET | `/api/coaching/district/:districtId` | — | Institutes for a district |
| GET | `/api/coaching/district/:districtId/summary` | — | Count per area in district |
| PUT | `/api/coaching/:id` | partial fields | Update one institute |
| DELETE | `/api/coaching/:id` | — | Delete one institute |
| DELETE | `/api/coaching/area/:areaId/all` | — | Delete all for area |

### Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/api/coaching/dashboard` | Stats: totals, type breakdown, coverage, top states/districts |

---

## Frontend Files to Create

```
client/src/
├── services/
│   └── coachingService.ts            ← API calls (mirrors educationService.ts)
└── app/(pages)/
    └── coaching/
        └── page.tsx                  ← Main page (mirrors education/page.tsx)
```

Add nav link in the sidebar/navigation pointing to `/coaching`.

---

## Frontend Page — `coaching/page.tsx`

### View Modes
1. **Search** — fire Google search, display results, save selected/all to DB
2. **Saved** — browse saved institutes with filters

### Search Panel
- State → District → Area dropdowns (same location service as education)
- "Search Google" button → calls `/api/coaching/search-by-area`
- Results table with: Name, Address, Phones, Website, Type badges
- "Save All" / individual save checkboxes

### Saved Panel
- Filters: search text, type, state, district, area, has-phone, has-website
- Paginated table
- Inline edit modal (same form as education but with coaching types)
- Delete single / delete all for area

### Type Badges (colour-coded)
| Type | Color |
|---|---|
| coaching | Blue |
| tutoring | Purple |
| test_prep | Orange |
| skill_training | Green |

---

## `coachingService.js` — Core Logic

```
Step 1  fetchPlaces(pincode, city, area)
          → iterate SEARCH_KEYWORDS (15 queries), paginate each with next_page_token
Step 2  isPrivate(name)
          → blacklist: government, govt, municipal, corporation, panchayat, ghss, ghs
Step 3  isStrictArea(place, {area, pincode})
          → keep only results whose formatted_address contains area or pincode
Step 4  getPlaceDetails(place_id)
          → name, website, formatted_phone_number, international_phone_number
Step 5  inferType(name)
          → coaching | tutoring | test_prep | skill_training
Step 6  formatPlace(place) → { name, address, phones, emails, contacts, website, types }
Step 7  dedupe by name+address
```

---

## `coachingValidator.js` — Zod Schemas

Same shape as `educationValidator.js` but with coaching enum values:
- `types` enum: `["coaching", "tutoring", "test_prep", "skill_training"]`

---

## `coachingService.ts` (Client)

Interfaces:
```ts
CoachingInstitute       { name, address, phones, emails, contacts, website, types }
SavedCoachingInstitute  extends CoachingInstitute + { _id, area, district, state, ... }
PaginatedCoachingResult { count, totalCount, page, totalPages, limit, data }
```

Methods mirror `educationService.ts`:
- `search`, `searchByArea`, `searchByDistrict`
- `saveInstitutes`, `getAll`, `getByArea`, `getByDistrict`, `getDistrictSummary`
- `updateInstitute`, `deleteInstitute`, `deleteAllByArea`
- `getDashboard`

---

## Implementation Order

1. `server/src/models/CoachingInstitute.js`
2. `server/src/services/coachingService.js`
3. `server/src/validators/coachingValidator.js`
4. `server/src/controllers/coachingController.js`
5. `server/src/routes/coachingRoutes.js`
6. Register route in `server/src/app.js`
7. `client/src/services/coachingService.ts`
8. `client/src/app/(pages)/coaching/page.tsx`
9. Add navigation link

---

## Notes

- **No scraper**: emails and contacts fields start empty; users fill them manually via the edit modal.
- **Cost guard**: `limited = filtered.slice(0, 40)` — max 40 Place Details API calls per search.
- **Rate limiting**: 2 s delay between paginated requests; 200 ms delay between detail fetches.
- Shares existing `Area`, `District`, `State` models — no new location infrastructure needed.
