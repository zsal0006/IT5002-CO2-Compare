# 5. Implementation Plan

Five sprints. Each has a definition of done and a demonstrable outcome. Tasks are
sized so one person can finish one in a sitting.

Legend: **M** = must-have, **S** = should-have, **X** = stretch.

---

## Sprint 0 — Foundations

**Goal:** everyone can run the app locally and deploy it.
**Demo:** the shell app, with routing between three empty views, live on a public URL.

| # | Task | Pri |
|---|------|-----|
| T-0.1 | Initialise the git repository; push to the team remote; set branch protection on `main`. | M |
| T-0.2 | Confirm the Vite + Vue + Pinia + Router scaffold runs (`npm run dev`). | M |
| T-0.3 | Create the Supabase project; record the URL and anon key in each member's `.env.local`. | M |
| T-0.4 | Connect the repository to Vercel and confirm deploy-on-push to `main` plus preview deployments on pull requests. | M |
| T-0.5 | Agree branch naming, PR review rule (one approval), and commit message style. | M |
| T-0.6 | Apply `0001_init.sql` to Supabase; verify the tables exist. | M |

**Done when:** every member has the app running locally against the shared Supabase project, and a push to `main` deploys.

---

## Sprint 1 — Data layer

**Goal:** the database holds real, cited data and the app can read it.
**Demo:** a page that lists every emission factor with its source, read live from Supabase.

| # | Task | Pri |
|---|------|-----|
| T-1.1 | Download the GIZ country dataset; inspect columns; write the CSV → `country_transport_emissions` loader. | M |
| T-1.2 | Download the Kaggle vehicle dataset; derive per-passenger-km car factors by fuel type (divide by 1.6 occupancy). | M |
| T-1.3 | Replace every placeholder in `data/emission_factors.csv` with a sourced value; fill `source_id` and `retrieved_on`. | M |
| T-1.4 | Run the seed scripts; verify row counts and spot-check five countries against the source portal. | M |
| T-1.5 | Apply RLS policies; prove from the browser console that a direct `insert` into `trip_logs` is rejected. | M |
| T-1.6 | Build the `factors` Pinia store with a bundled fallback table for offline/Supabase-down. | M |
| T-1.7 | Write `log_trip()` and `country_series()`; unit-test them in the SQL editor. | M |

**Done when:** `select count(*) from country_transport_emissions` returns a plausible number, every factor row has a non-null `source_id`, and an unauthorised insert fails.

---

## Sprint 2 — Calculator (the core)

**Goal:** FR-1 to FR-6 complete.
**Demo:** type two place names, get a chart.

| # | Task | Pri |
|---|------|-----|
| T-2.1 | `lib/geocode.js` — Nominatim wrapper: debounce, 1 req/s throttle, in-memory cache, `User-Agent`/`Referer` compliance, top-5 candidates. | M |
| T-2.2 | `LocationInput.vue` — text field with a candidate pick-list and a confirmed-match chip. | M |
| T-2.3 | `lib/routing.js` — OSRM call with a 3s timeout and haversine fallback; returns `{ km, approximate, geometry }`. | M |
| T-2.4 | `lib/emissions.js` — pure function `compare(distanceKm, factors)`; no side effects, fully unit-testable. | M |
| T-2.5 | `ComparisonChart.vue` — horizontal bar, sorted ascending, value labels on bars. | M |
| T-2.6 | `ComparisonTable.vue` — the accessible mirror of the chart (NFR-4). | M |
| T-2.7 | `trip` store wiring: inputs → distance → comparison. | M |
| T-2.8 | Car sub-type selector and return-trip toggle. | S |
| T-2.9 | Loading, empty, and error states for every external call. | M |
| T-2.10 | Geolocation: `currentLocation()` + reverse geocode, wired to a "Use my current location" link on the start field. *(story 1.2)* | C |
| T-2.11 | Headline swap sentence — "switching from driving to train saves 3.4 kg". *(story 2.2)* | M |

**Done when:** "Edinburgh" → "Glasgow" produces ~67 km and a chart whose driving figure is within 10% of a hand calculation.

---

## Sprint 3 — Logging and the savings aggregate

**Goal:** FR-9 to FR-15 complete.
**Demo:** log a cycling trip; watch the global counter move.

| # | Task | Pri |
|---|------|-----|
| T-3.1 | `ModeSelector.vue` — pick the mode actually used. | M |
| T-3.2 | Call `log_trip` RPC; optimistic UI with rollback on error. | M |
| T-3.3 | Derive the ISO-2 country code **and the region** from the start geocode result (`address.country_code`, `address.state`). *(stories 4.1, 6.2)* | M |
| T-3.4 | `stats` store reading `v_savings_global` and `v_savings_by_country`. | M |
| T-3.5 | `StatTile.vue` — the KPI component (global saved, your country saved, trips logged). | M |
| T-3.6 | Session-only personal total held in Pinia, cleared on tab close. | S |
| T-3.7 | Duplicate-submission guard (disable while in flight; one log per calculated result). | M |

**Done when:** a logged trip increments both the country and the global totals, and the figures survive a page reload.

---

## Sprint 4 — Dashboard

**Goal:** E4 and E5 complete — the Impact page and the Dashboard.
**Demo:** select a region and see what it has avoided; then pick a country off the world map and watch its trend load.

| # | Task | Pri |
|---|------|-----|
| T-4.1 | `CountrySelect.vue` — searchable select over the distinct country list. | M |
| T-4.2 | `EmissionsTimeSeries.vue` — line chart, 1970–2024, Mt CO₂e. | M |
| T-4.3 | Transport-share-of-total stat tile for the selected year. | S |
| T-4.4 | Savings-by-country section: global tile, selected-country tile, ranked table. | M |
| T-4.5 | Savings-by-mode chart from `v_savings_by_mode`, ranked by kg avoided. *(story 4.2)* | S |
| T-4.6 | Multi-country compare, up to three series. | X |
| T-4.7 | Data table toggle beneath every chart. | M |
| T-4.8 | Impact page: region selector, session/region/global tiles, region leaderboard. *(story 4.1)* | M |
| T-4.9 | World choropleth: quantile breaks, legend with real ranges, hover detail, click-to-select. *(story 5.3)* | M |
| T-4.10 | Verify every country code in the GIZ dataset has a boundary feature; list the unmatched ones in the Learn page's limitations. | S |

**Done when:** the dashboard loads in under 2s with a country selected and every chart has a table equivalent.

---

## Sprint 5 — Polish, content, stretch

**Goal:** FR-20, the non-functionals, and whatever stretch goals fit.

| # | Task | Pri |
|---|------|-----|
| T-5.1 | Learn page: methodology, all four sources with links and licences, the limitations list from §4.4 verbatim. | M |
| T-5.2 | Responsive pass at 360 / 768 / 1280px. | M |
| T-5.3 | Accessibility pass: keyboard traversal, focus rings, contrast, chart tables, `prefers-reduced-motion`. | M |
| T-5.4 | Dark mode using the validated dark palette steps. | S |
| T-5.5 | `RouteMap.vue` — Leaflet map drawing the OSRM geometry on the Compare page. | X |
| T-5.6 | Per-mode routing profiles (cycling, walking) from OSRM. | X |
| T-5.7 | Share card: "I saved X kg on this trip". | X |
| T-5.8 | Final README, screenshots, and the demo script. | M |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Nominatim/OSRM rate-limit or block the demo | Medium | High | Debounce, cache, and set a proper `User-Agent`. Fallback to haversine is already built. If it persists, switch to an OpenRouteService free key (budget: half a day). |
| Kaggle dataset is per-vehicle-km, silently mixed with per-passenger-km | **High** | **High** | Unit is in the column name; T-1.2 makes the conversion an explicit task; a seed assertion fails if any car factor exceeds 400 g/p-km. |
| GIZ dataset shape differs from expectation | Medium | Medium | T-1.1 inspects before loading; the loader is CSV-driven, so a column rename is a one-line change. |
| Scope creep into routing per mode | Medium | Medium | FR-7 is explicitly stretch and gated behind all Must items. |
| Supabase free-tier project paused for inactivity | Low | Medium | Bundled fallback factors keep the calculator alive; a weekly ping keeps the project warm before the demo. |
| Choropleth is unreadable because a few countries dominate the scale | **High** | Medium | Quantile breaks rather than equal intervals, with the real range printed per legend bin. Already built; verify with real data at T-4.9. |
| GIZ country codes do not match the boundary file's alpha-3 ids | Medium | Medium | T-4.10 reconciles the two lists. Unmatched countries render unshaded rather than breaking the map. |
| Story 6.1 read strictly forbids the bundled fallback factors | Medium | Low | Raise at the Sprint 1 review and decide — see the note at the end of `09-epics-and-traceability.md`. |
| Team member unavailable near submission | Medium | High | One approval per PR, but no single owner per area — every file has a named second. |

## Definition of done (project)

- Every **Must** user story passes the acceptance criterion the team wrote for it,
  checked against `08-testing-and-acceptance.md` and traced in
  `09-epics-and-traceability.md`.
- The app is deployed and reachable on a public URL.
- Every displayed number traces to a `data_sources` row.
- No secret is committed; `.env.example` documents the variables.
- README explains setup from a clean clone in under ten minutes.
