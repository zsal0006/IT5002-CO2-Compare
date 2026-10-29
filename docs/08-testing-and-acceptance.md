# 8. Testing and Acceptance

## 8.1 Approach

Three layers, weighted towards the part where a mistake is both likely and invisible.

| Layer | Covers | Tool |
|-------|--------|------|
| Unit | `lib/emissions.js`, `lib/routing.js` (haversine), `lib/iso.js` | Vitest |
| Integration | SQL functions, RLS, views | SQL queries in the Supabase editor |
| Manual acceptance | Every FR in `01-requirements.md` | The script below |

The arithmetic gets unit tests because a wrong factor or a unit mix-up produces a
plausible-looking number that no one notices. UI composition gets manual testing
because a broken layout is obvious on sight.

To add Vitest when Sprint 2 starts:

```bash
npm i -D vitest
npm pkg set scripts.test=vitest
```

## 8.2 Unit tests to write

`src/lib/emissions.test.js`

| # | Test |
|---|------|
| U-1 | `emissionsKg(100, 170)` is `17` kg. |
| U-2 | `emissionsKg(d, 0)` is `0` for d = 0, 1, 1000. |
| U-3 | `emissionsKg(-5, 170)` is `0`; `emissionsKg(NaN, 170)` is `0`. |
| U-4 | `savedKg(100, 35, 170)` is `13.5`. |
| U-5 | `savedKg(100, 250, 170)` is `0` — never negative. |
| U-6 | `compare()` returns results ascending by `kg`. |
| U-7 | `compare()` marks exactly one result `isBaseline`. |
| U-8 | Doubling distance doubles every `kg` (return-trip invariant). |
| U-9 | `compare(d, factors, { modeKeys })` returns exactly those keys, skipping unknown ones. |

`src/lib/routing.test.js`

| # | Test |
|---|------|
| U-10 | `haversineKm` Edinburgh→Glasgow is 66 km ± 3. |
| U-11 | `haversineKm(p, p)` is `0`. |
| U-12 | `haversineKm` is symmetric. |

`src/lib/iso.test.js`

| # | Test |
|---|------|
| U-13 | `toAlpha2('AUT')` is `'AT'`, not `'AU'` — the truncation bug this table exists to prevent. |
| U-14 | `toAlpha2('WORLD')` is `'ZZ'`. |
| U-15 | Every value in the table is two uppercase letters, and values are unique. |
| U-16 | Every country code in the GIZ dataset resolves to a boundary feature, or is on a known-unmatched list. |

## 8.3 Database integration checks

Run after every schema change.

| # | Check | Expected |
|---|-------|----------|
| D-1 | `select count(*) filter (where is_baseline) from emission_factors` | `1` |
| D-2 | Insert a second baseline row | fails on the unique index |
| D-3 | `select log_trip(10, 'cycling', 'GB')` | `saved_kg` ≈ 1.7 |
| D-4 | `select log_trip(10, 'car_average', 'GB')` | `saved_kg` = 0, `emitted_kg` ≈ 1.7 |
| D-5 | `select log_trip(-1, 'cycling', 'GB')` | raises `22003` |
| D-6 | `select log_trip(10, 'teleport', 'GB')` | raises `23503` |
| D-7 | `select log_trip(10, 'cycling', 'not-a-code')` | stored as `ZZ` |
| D-8 | Direct `insert into trip_logs` as anon | policy violation |
| D-9 | Direct `select from trip_logs` as anon | no rows and an error |
| D-10 | `select * from v_savings_global` as anon | succeeds |
| D-11 | Car factor above 400 g/p-km in the seed | seed raises the unit-mix-up guard |
| D-12 | `select log_trip(10, 'cycling', 'GB', 'Scotland')` | row stored with `region_name = 'Scotland'`; `region_total_kg` returned |
| D-13 | `select log_trip(10, 'cycling', 'GB', null)` | row stored with `region_name` null; appears under "Unknown region" in `v_savings_by_region` |
| D-14 | `select log_trip(10, 'cycling', 'GB', repeat('x', 500))` | region truncated to 80 characters, no error |
| D-15 | `select * from v_savings_by_mode` with zero trips logged | every active mode present with zeroes, no nulls, no division-by-zero |

D-8 and D-9 must be run from the **browser console on the deployed site**, not the
SQL editor — the editor runs as a privileged role and will happily let you through.

## 8.4 Acceptance tests

One row per functional requirement. Record pass/fail per sprint review.

| FR | Test | Pass criteria |
|----|------|---------------|
| FR-1 | Type "Edinburgh" and "Glasgow". | Both fields accept the text. |
| FR-2 | Type "Springfield". | A pick-list of candidates appears; choosing one shows it as a confirmed chip. |
| FR-3 | Calculate Edinburgh → Glasgow. | Distance 60–80 km. |
| FR-4 | Same journey. | Five modes shown; cycling and walking both `0`. |
| FR-5 | Same journey. | Bar chart renders; "Show the data table" reveals a table with the same numbers. |
| FR-6 | Switch car type to Electric. | Car bar drops to roughly a quarter of its petrol value. |
| FR-7 | *(stretch)* | Route drawn on a map. |
| FR-8 | Tick "Return trip". | Every figure exactly doubles. |
| FR-9 | Select "Cycling", press Log. | Button enables only once a mode is picked. |
| FR-10 | After logging. | Confirmation states the kg avoided and the country. |
| FR-11 | Edit the RPC payload in devtools to claim 9999 km. | Server clamps or rejects; no inflated row appears. |
| FR-12 | Inspect the network tab during a log. | Payload contains only distance, mode key, country code. |
| FR-13 | Log two trips. | Session total is the sum; closing the tab clears it. |
| FR-14 | Open the dashboard. | Global avoided total shown and non-negative. |
| FR-15 | Open the dashboard. | Per-country table lists at least the countries with logged trips. |
| FR-16 | Select a country. | Transport emissions tile shows a figure with its year. |
| FR-17 | Select a country. | Line chart spans the dataset's year range. |
| FR-18 | Select a country with total emissions data. | Share-of-total percentage shown; blank where the source has no total. |
| FR-19 | *(stretch)* | Up to three countries on one chart, each with a legend entry. |
| FR-20 | Follow "How we calculate this" under the results. | Formula, factor table, all four sources with links and licences, and the full limitations list. |
| FR-21 | Click "Use my current location", allow the permission. | Start field fills with your location. Declining shows a message and leaves the form usable. |
| FR-22 | Calculate any journey over 5 km. | A sentence states the headline swap and its saving, e.g. "Switching from car to national rail saves 3.4 kg CO₂e". |
| FR-23 | Log a trip, open Impact. | Region selector lists your region; its total includes your trip. |
| FR-24 | Open Impact with several modes logged. | Modes ranked by kg avoided, descending, with trip counts alongside. |
| FR-25 | Open Dashboard. | Map shaded, legend shows real ranges in Mt CO₂e, hovering a country shows its name and figure, clicking one loads its trend below. |
| FR-26 | Change a factor in `emission_factors`, reload. | The comparison changes without a code edit or redeploy. |

### Story acceptance

`09-epics-and-traceability.md` §9.6 reproduces the team's own acceptance criteria
verbatim. At each sprint review, walk those sentences rather than this table — this
table is the engineering restatement, those are the agreed words.

## 8.5 Non-functional checks

| NFR | How to check | Pass criteria |
|-----|--------------|---------------|
| NFR-1 | Lighthouse on the deployed site | First Contentful Paint < 2s |
| NFR-2 | Stopwatch from submit to chart | < 3s on a normal connection |
| NFR-3 | Devtools at 360 / 768 / 1280 px | No horizontal scroll, no overlap, no clipped text |
| NFR-4 | Keyboard only, then axe DevTools | Every control reachable and visibly focused; no contrast or label violations; every chart has a table |
| NFR-5 | Chrome, Firefox, Edge, Safari | Calculator and dashboard both work |
| NFR-6 | `git log -p \| grep -i -E 'service_role\|secret\|password'` | No hits |
| NFR-7 | Block `router.project-osrm.org` in devtools, recalculate | Result still appears, with the approximate-distance notice |
| NFR-8 | Pick three numbers on screen at random | Each traces to a `data_sources` row shown on the Learn page |

## 8.6 Edge cases to try before the demo

- Identical start and end → distance 0, every mode 0, logging refused.
- Two points on different continents → very large number, still formatted sensibly (tonnes).
- A place name with an apostrophe or non-Latin script.
- Rapid repeated submissions → no duplicate logs, no rate-limit error from Nominatim.
- Offline → calculator falls back, dashboard shows an error state rather than a blank page.
- A country in the emissions dataset with no logged trips → tiles show 0, not `NaN` or `—`.
- A dataset row with a null total → share column blank, no division-by-zero.
- A country in the boundary file with no emissions row → renders unshaded, tooltip says "No data", clicking it does nothing.
- A geocode result with no `address.state` (small countries, city-states) → trip logs under "Unknown region" without error.
- Two different countries with a same-named region → kept distinct, because the region key is `country_code` + `region_name`.
- Geolocation permission previously denied at the browser level → message appears immediately, form still usable.

## 8.7 Demo script (5 minutes)

1. **The problem** — one line, with the national transport share from the dashboard.
2. **Calculate** Edinburgh → Glasgow. Point at the chart; name the driving figure.
3. **Switch** the car to electric; note what changes and what does not.
4. **Log** the trip as rail; show the global counter move.
5. **Impact** — show the global total move, then switch region and show the
   savings-by-mode chart.
6. **Dashboard** — start on the map, click a large emitter, let its trend load, then
   name its transport share.
7. **How we calculate this** — show the sources and read one limitation aloud. Finish
   on the privacy paragraph: this is why the trip log holds no coordinates.
