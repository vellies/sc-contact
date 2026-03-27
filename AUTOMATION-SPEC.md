# Automation Pipeline - Spec Document

## Current Database Status

| Entity | Count | Coverage |
|--------|-------|----------|
| States | 35 | All 28 states + 7 UTs |
| Districts | 37 | Only Tamil Nadu (1/35 states) |
| Areas | 268 | Only Tamil Nadu |
| Institutions | 111 | Only few areas in Coimbatore district |

**Goal**: Full India coverage - all districts, all areas, all institutions with scraped contact data.

---

## Phase 1: Populate Districts & Areas

### 1.1 Data Source: India Post Pincode API

Use **India Post public API** to fetch real pincodes for every district:

```
GET https://api.postalpincode.in/pincode/{pincode}
GET https://api.postalpincode.in/postoffice/{district_name}
```

- Free, no API key needed
- Returns: pincode, office name (area), district, state, region
- Rate limit: ~100 req/min (add 600ms delay)

**Alternative**: Pre-built India pincode CSV datasets from `data.gov.in` (offline, faster, no rate limit).

### 1.2 Pipeline: Districts

```
For each State in DB (34 remaining, Tamil Nadu already done):
  1. Fetch district list from pincode API (search by state)
     OR use master district list from data.gov.in
  2. Create District documents in DB
  3. Log: "Created X districts for {State}"
```

**Estimated**: ~750 districts across India

### 1.3 Pipeline: Areas (Pincodes)

```
For each District:
  1. Query pincode API: GET /postoffice/{district_name}
  2. Returns all post offices with pincodes in that district
  3. Group by pincode → create Area documents
     { pincode, area: office_name, city: division/region, district, state }
  4. Upsert to avoid duplicates (compound index: pincode + area + district)
  5. Log: "Created X areas for {District}, {State}"
  6. Delay 600ms between API calls
```

**Estimated**: ~19,000 unique pincodes across India (~25,000 areas with sub-areas)

### 1.4 Cost & Time

| Item | Value |
|------|-------|
| API calls | ~750 (one per district) |
| Cost | Free |
| Time | ~750 x 0.6s = ~8 minutes |
| Rate limit handling | 600ms delay + retry on 429 |

### 1.5 Endpoint

```
POST /api/locations/auto-generate-all
Body: { stateId?: string }  // optional: do one state at a time

Response (streaming / progress):
{ phase: "districts", state: "Karnataka", created: 31 }
{ phase: "areas", district: "Bangalore Urban", created: 45 }
...
{ done: true, totalDistricts: 750, totalAreas: 25000 }
```

### 1.6 UI

- Button on Locations page: "Auto-Generate All India Data"
- Confirm dialog: "This will create districts and areas for all 34 remaining states using India Post API. Continue?"
- Progress bar / live log showing current state → district → areas count
- Option to run per-state: dropdown + "Generate for this state" button

---

## Phase 2: Institution Discovery (Google Places API)

### 2.1 Pipeline

```
For each Area in DB (that has 0 institutions):
  1. Call existing searchByArea logic:
     - 4 Google Text Search queries (school, college, polytechnic, ITI)
     - Filter: private only, strict area match
     - Limit: 40 per area
  2. Fetch Place Details for each result (phone, website)
  3. Upsert to Institution collection
  4. Log: "Found X institutions for {Area} ({Pincode})"
  5. Delay 1s between areas (Google rate limit)
```

### 2.2 Cost & Time Estimate

| Item | Per Area | For 25,000 Areas |
|------|----------|-------------------|
| Text Search calls | 4 | 100,000 |
| Place Details calls | 0-40 | ~250,000 (avg 10/area) |
| Text Search cost | $0.128 | $3,200 |
| Place Details cost | $0.17-0.68 | $4,250 |
| **Total Google API cost** | | **~$7,450** |
| Time per area | ~15-30s | ~175-520 hours |

### 2.3 Cost Optimization Strategies

1. **Skip empty areas**: Many rural pincodes have 0 private institutions. After first Text Search returns 0, skip Place Details. Cost drops significantly.

2. **Batch by district**: Run one district at a time. Review results before continuing.

3. **Priority queue**: Start with urban/populated districts first:
   - Tier 1: State capitals, major cities (Chennai, Mumbai, Delhi, Bangalore...)
   - Tier 2: District headquarters
   - Tier 3: Remaining areas

4. **Daily budget cap**: Stop after $X/day to avoid surprise bills.

5. **Cache duplicates**: Same institution appears in overlapping area searches. Upsert handles this.

6. **Reduced queries**: For small/rural areas, only search "schools" (skip college/polytechnic/ITI). Switch from 4 queries to 1. Cost drops 75%.

### 2.4 Realistic Phased Approach

| Phase | Scope | Areas | Est. Cost | Time |
|-------|-------|-------|-----------|------|
| 2a | Tamil Nadu (remaining) | ~230 | ~$70 | ~2 hours |
| 2b | Top 5 states (KA, MH, KL, TG, DL) | ~3,000 | ~$900 | ~25 hours |
| 2c | All remaining states | ~22,000 | ~$6,500 | ~170 hours |

### 2.5 Endpoint

```
POST /api/education/auto-discover
Body: {
  scope: "area" | "district" | "state" | "all",
  id?: string,          // areaId / districtId / stateId
  skipExisting: true,   // skip areas that already have institutions
  dailyBudget?: number, // stop after N Google API calls
  queriesPerArea?: 1|4, // 1 = schools only, 4 = all types
}

Response (streaming):
{ area: "Town Hall", pincode: "641001", found: 33, saved: 33 }
{ area: "RS Puram", pincode: "641002", found: 18, saved: 15 }
...
{ done: true, areasProcessed: 230, totalFound: 2840, totalSaved: 2650, apiCalls: 1420 }
```

### 2.6 UI

- New section on Education page OR dedicated "Automation" page
- Scope selector: State → District → Area (or "All")
- Options: skip existing, daily budget cap
- Start/Stop button
- Live progress: current area, found count, running total, API calls used
- Estimated cost display based on remaining areas

---

## Phase 3: Website Scraping

### 3.1 Pipeline

```
For each Institution with website (and empty contacts/emails):
  1. Call existing scrapeWebsite(url)
  2. Extract emails → merge into emails[]
  3. Extract phones → merge into contacts[]
  4. Delay 500ms between scrapes
  5. Log result
```

### 3.2 Cost & Time

| Item | Value |
|------|-------|
| API calls | 0 (free, direct HTTP) |
| Cost | $0 |
| Estimated institutions with website | ~40% of total |
| Time per scrape | ~2-5 seconds |
| For 10,000 with websites | ~8-14 hours |

### 3.3 Endpoint

```
POST /api/education/auto-scrape
Body: {
  scope: "area" | "district" | "state" | "all",
  id?: string,
  skipScraped: true,  // skip if already has contacts/emails
}
```

### 3.4 UI

- "Scrape All" button with scope selector
- Progress: current institution, success/fail count, new contacts/emails found

---

## Phase 4: Implementation Order

```
Step 1: Build Phase 1 (districts + areas from pincode API)
        → Free, fast, foundational data
        → Test with 1-2 states first

Step 2: Build Phase 2 automation endpoints + UI
        → Test with Tamil Nadu remaining areas ($70)
        → Review quality, tune filters
        → Expand to more states

Step 3: Build Phase 3 batch scraper
        → Run after each Phase 2 batch
        → Free, just takes time

Step 4: Scale to all India
        → Run Phase 2 state by state
        → Monitor costs via daily budget cap
```

---

## Technical Requirements

### New Server Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/locations/auto-generate-all` | Create districts + areas from pincode API |
| GET | `/api/locations/auto-generate-progress` | SSE stream for progress |
| POST | `/api/education/auto-discover` | Batch Google Places search |
| POST | `/api/education/auto-scrape` | Batch website scraping |
| GET | `/api/education/automation-progress` | SSE stream for progress |
| POST | `/api/education/automation-stop` | Stop running automation |

### New Client Pages/Components

| Component | Purpose |
|-----------|---------|
| `/automation` page | Central automation control panel |
| ProgressPanel | Real-time progress with SSE |
| CostEstimator | Shows estimated Google API cost before running |
| ScopeSelector | State → District → Area picker with "All" option |

### Infrastructure

- **Job queue**: In-memory flag (`isRunning`) with stop mechanism. No external queue needed for single-user app.
- **Resumable**: Track last processed area ID. On restart, continue from where stopped.
- **Logging**: Save automation run history to a `AutomationLog` collection (startTime, endTime, scope, counts, errors).
- **Error handling**: Skip failed areas/institutions, continue batch. Log errors for review.

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google API cost overrun | $$$  | Daily budget cap, per-area cost check |
| Google API rate limit (429) | Temporary block | Exponential backoff, 1s delay between areas |
| Pincode API downtime | Can't create areas | Fallback to CSV dataset |
| Bad/junk institutions | Pollutes DB | Private filter + strict area filter already in place |
| Scraper blocked by websites | No contact data | Already handled with error catch + skip |
| Long running time | Process killed | Resumable from last checkpoint |

---

## Summary

| Phase | What | Cost | Time | Dependency |
|-------|------|------|------|------------|
| 1 | Districts + Areas (all India) | Free | ~8 min | None |
| 2a | Institutions (Tamil Nadu) | ~$70 | ~2 hrs | Phase 1 |
| 2b | Institutions (Top 5 states) | ~$900 | ~25 hrs | Phase 1 |
| 2c | Institutions (All India) | ~$6,500 | ~170 hrs | Phase 1 |
| 3 | Scrape websites | Free | ~8-14 hrs | Phase 2 |
| **Total (All India)** | | **~$7,470** | **~200 hrs** | |
