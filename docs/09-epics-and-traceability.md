# 9. Epics, User Stories and Traceability

The team's six epics and eighteen user stories are the agreed statement of scope.
This document maps each story to the requirement it satisfies, the sprint task that
builds it, and the code that implements it — so that at any point we can answer "is
this story done, and where is it?"

Where this document and `01-requirements.md` disagree, **the user stories win**;
`01-requirements.md` has been updated to match.

---

## 9.1 Epics

| ID | Epic | Covered by |
|----|------|-----------|
| E1 | Route input | `CompareView` form, `lib/geocode.js`, `lib/routing.js` |
| E2 | Emissions comparison | `lib/emissions.js`, `ComparisonChart`, `ComparisonTable`, `LearnView` |
| E3 | Savings tracking | `ModeSelector`, `log_trip()` |
| E4 | Community impact | `ImpactView`, `v_savings_by_region`, `v_savings_by_mode` |
| E5 | Emissions dashboard | `DashboardView`, `EmissionsTimeSeries`, `WorldEmissionsMap` |
| E6 | Data, privacy and platform | Schema + RLS, `theme.css`, responsive layouts |

## 9.2 Story traceability

MoSCoW is the team's; FR is the matching requirement in `01-requirements.md`;
Task is the sprint task in `05-implementation-plan.md`.

| Story | MoSCoW | FR | Task | Implemented in | Status |
|-------|--------|----|----|----------------|--------|
| 1.1 Start and end point, distance shown | M | FR-1, FR-2, FR-3 | T-2.1, T-2.2, T-2.3 | `LocationInput.vue`, `lib/geocode.js`, `lib/routing.js` | Scaffolded |
| 1.2 Use my current location | C | FR-21 | T-2.10 | `lib/geocode.js` → `currentLocation()`, `LocationInput` | Scaffolded |
| 2.1 Five modes side by side | M | FR-4, FR-5 | T-2.4, T-2.5, T-2.6 | `lib/emissions.js` → `compare()`, `ComparisonChart.vue` | Scaffolded |
| 2.2 Saving versus driving | M | FR-22 | T-2.11 | `lib/emissions.js` → `savedKg()`, `trip.headlineSwap` | Scaffolded |
| 2.3 Choose vehicle type | C | FR-6 | T-2.8 | `CompareView` vehicle select, `trip.carMode` | Scaffolded |
| 2.4 Where the numbers come from | S | FR-20 | T-5.1 | "How we calculate this" → `LearnView.vue` | Scaffolded |
| 3.1 Pick the way I travelled | M | FR-9, FR-10, FR-11 | T-3.1, T-3.2 | `ModeSelector.vue`, `log_trip()` | Scaffolded |
| 4.1 Region and global totals | M | FR-14, FR-15, FR-23 | T-3.3, T-3.4, T-4.8 | `ImpactView.vue`, `v_savings_by_region` | Scaffolded |
| 4.2 Savings by transport mode | S | FR-24 | T-4.5 | `v_savings_by_mode`, `BarList.vue` | Scaffolded |
| 5.1 Country transport emissions and share | M | FR-16, FR-18 | T-4.1, T-4.3 | `DashboardView` tiles, `country_series()` | Scaffolded |
| 5.2 Trend over time | S | FR-17 | T-4.2 | `EmissionsTimeSeries.vue` | Scaffolded |
| **5.3 Emissions by region map** | **M** | FR-25 | T-4.9 | `WorldEmissionsMap.vue` | Scaffolded |
| 6.1 Factors stored in the database | M | FR-26 | T-1.3, T-1.6 | `emission_factors` table, `factors` store | Scaffolded |
| 6.2 Addresses not saved | M | FR-12 | T-1.5, T-3.3 | `trip_logs` schema, `log_trip()` | Scaffolded |
| 6.3 Works on my phone | S | NFR-3 | T-5.2 | Responsive grids in every view | Scaffolded |

"Scaffolded" means the structure, the component and the contract exist and the
project builds; it does **not** mean the story is accepted. A story is Done when its
acceptance criterion passes the matching test in `08-testing-and-acceptance.md`.

## 9.3 Story 5.3 — a story the epics did not have

The wireframes show an "Emissions by region" world map on the dashboard, which no
written story covered. It has been accepted as a **Must**, so it needs a story:

> **5.3 (M):** As a user, I want to see transport emissions shaded on a world map so
> that I can compare countries at a glance without selecting them one by one.
>
> *Acceptance criteria:* Countries are shaded by their transport emissions for the
> most recent year in the dataset, a legend states what the shading means, hovering a
> country shows its name and figure, and selecting one loads its trend below.

Two consequences the team should be aware of:

- It needs **country boundary data**, which the emissions datasets do not contain.
  `public/geo/countries.geo.json` (Natural Earth derived, public domain, 180
  countries keyed by ISO alpha-3) is vendored into the repository. Three features in
  that file carry no valid alpha-3 code — disputed territories — and simply render
  unshaded.
- A choropleth of transport emissions is dominated by the largest economies. The
  colour breaks are therefore **quantiles of the actual data**, not equal intervals,
  and the legend prints each bin's real range so the non-linearity is visible rather
  than concealed. Equal intervals would render every country except about six in the
  palest shade, which is a true but useless picture.

## 9.4 Decisions taken against the wireframes

### Region means country plus state or province

Story 4.1 says "my region" and the wireframe shows "Victoria, Australia". `trip_logs`
therefore stores `country_code` **and** `region_name`, taken from the start point's
geocode (`address.state`, falling back to `region` then `county`).

This is a deliberate relaxation of the original country-only design, and 6.2's
privacy claim has been tightened to match: a state or province contains millions of
people and cannot re-identify a traveller, whereas a city or a coordinate pair could.
Nothing finer than a province is recorded, and `region_name` is nullable — a trip
whose region cannot be determined still counts towards the global total under
"Unknown region".

### Savings by mode are measured in kilograms, not trip counts

Story 4.2 asks for savings "broken down by transport mode". `v_savings_by_mode`
carries `total_saved_kg` as its headline measure, with the trip count alongside. A
mode chosen rarely for long journeys can out-save one chosen often for short hops;
ranking by trip count would state the opposite.

### Navigation is Compare / Impact / Dashboard

Matching the wireframes. Community impact (E4) and national emissions (E5) are
separate pages, not two halves of one dashboard. "How we calculate this" (story 2.4)
is reached from a link under the results and from the footer rather than from a
fourth nav tab, as the wireframes show.

### The product is "CO2 Compare"

Taken from the wireframe header.

## 9.5 Gaps between the stories and the wireframes

Worth resolving before Sprint 2, none of them blocking:

| # | Observation | Suggested resolution |
|---|-------------|---------------------|
| G-1 | Wireframe 2 shows mode buttons in a single row of five; the stories don't constrain the control. | Current build uses a wrapping radio group so it degrades to one column on a phone (6.3). |
| G-2 | Wireframe 3 shows "XXX kg" placeholders for savings by mode, so the intended ordering is unstated. | Ranked by kg saved, descending. |
| G-3 | Wireframe 4 shows "XXX tonnes" for transport emissions; the GIZ dataset is in megatonnes. | Dashboard labels the unit explicitly as Mt CO₂e. Update the wireframe. |
| G-4 | No story covers the return-trip toggle, which the scaffold implements. | Either drop it, or add story 1.3 (C). Left in; it costs one checkbox and doubles one number. |
| G-5 | No story covers what happens when Nominatim or OSRM are unavailable. | Covered by NFR-7, not by a story. Add one if the team wants it demonstrated at review. |
| G-6 | Story 4.1 says totals update "after a new saving is logged", but the Impact page is a separate route. | Logging refreshes the stats store, so navigating to Impact shows current figures without a reload. |

## 9.6 Acceptance criteria as written by the team

Reproduced verbatim so the test plan can be checked against the source. These are the
wording the sprint review should use.

| Story | Acceptance criterion |
|-------|---------------------|
| 1.1 | The distance in km appears after both locations are entered, and a clear error message shows if a location can't be found. |
| 1.2 | The start field fills automatically once the user allows location access in their browser. |
| 2.1 | Every mode shows its estimated kg of CO2 for the trip, with cycling and walking showing 0. |
| 2.2 | Each alternative mode shows the kg of CO2 saved compared with driving the same trip. |
| 2.3 | Changing the vehicle type updates the driving figure, and an average car is used if nothing is chosen. |
| 2.4 | A "how we calculate this" link lists the datasets used for the emission figures. |
| 3.1 | Choosing a mode saves the CO2 saved against driving and shows a confirmation message. |
| 4.1 | Regional and global totals are shown and updated after a new saving is logged. |
| 4.2 | A chart shows the total CO2 saved for each mode. |
| 5.1 | Selecting a country shows its total transport emissions and their share of that country's total emissions. |
| 5.2 | A line chart shows the selected country's transport emissions by year. |
| 5.3 | Countries are shaded by transport emissions, with a legend, hover detail, and selection loading the trend. |
| 6.1 | All calculations read their emission factors from the database rather than values written into the code. |
| 6.2 | Only the mode, distance, CO2 saved, region and date are stored, never the addresses. |
| 6.3 | All screens display and work properly on a standard phone screen. |

> **Note on 6.1.** `src/lib/fallbackFactors.js` holds a bundled copy of the factors
> used only when the database is unreachable, so the calculator still works offline
> (NFR-7). This is not a second source of truth — it is never consulted when Supabase
> answers. If the team reads 6.1 strictly, the fallback must go and the calculator
> must show an error state instead. Flag this at the Sprint 1 review and decide; the
> current build keeps the fallback and discloses it on screen.
