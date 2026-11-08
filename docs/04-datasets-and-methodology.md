# 4. Datasets and Methodology

## 4.1 Datasets used

The brief requires a minimum of two. We use four, in two groups.

### Group A — emission factors (drive the calculator)

**A1. UK DESNZ/DEFRA GHG Conversion Factors for Company Reporting**
Publisher: UK Department for Energy Security and Net Zero.
Why: the most widely cited open, peer-reviewed set of *passenger-kilometre* factors,
updated annually, with documented occupancy and scope assumptions (WTT + TTW).
Licence: Open Government Licence v3.0.
Role: the primary `factor_g_per_pkm` values.

**A2. Climate Council — Transport Emissions fact sheet**
`https://www.climatecouncil.org.au/wp-content/uploads/2017/09/FactSheet-Transport.pdf`
Role: cross-check for the public-transport comparisons, and the source of the
plain-language framing on the Learn page.

**A3. Kaggle — Vehicle CO₂ Emissions dataset**
`https://www.kaggle.com/datasets/brsahan/vehicle-co2-emissions-dataset`
Role: vehicle-level g/km by fuel type and engine size. Used to derive the
petrol / diesel / electric car split and to sanity-check A1's car figures.

> ⚠️ **Important conversion.** The Kaggle dataset is **grams per vehicle-kilometre**.
> Our model is **grams per passenger-kilometre**. Divide by the assumed occupancy
> (we use 1.6 for private cars, per A1) before loading. Mixing the two units is the
> single most likely correctness bug in this project — the unit is in the column name
> for that reason.

### Group B — national and global context (drives the dashboard)

**B1. GIZ — "Country-Level Yearly GHG Emissions + Transport Sector (1970-2024)"**
`https://portal.transport-data.org/@giz/country-level-yearly-ghg-emissions-transport-sector-1970-2024`
Published by GIZ, constructed from **EDGAR** data (European Commission); an
extended version of the data behind the EDGAR 2025 official report.
Role: the country time series, the transport-vs-total share, and the world map.

Delivered as a single XLSX in **wide** form — one row per country, ten columns per
year from 1970 to 2024 (~552 columns), keyed on an EDGAR ISO3 country code. Figures
are MtCO₂e. There is no CSV and the CKAN datastore is empty, so it is converted and
unpivoted locally by `scripts/prepare-country-emissions.mjs`; see docs/06 §6.4.

Beyond what we load, each year also carries population, per-capita totals, the
transport share of global emissions, and the top three emitting sectors. None is
used yet — an obvious source of further dashboard material.

> **Licence not yet confirmed.** `license_title` is null on the CKAN package.
> Establish the licence and the required attribution before submission (T-1.10);
> until then the Learn page credits GIZ and EDGAR without asserting a licence.

## 4.2 Baseline emission factors

These are the seed values in `data/emission_factors.csv`, in **g CO₂e per
passenger-km**. They are deliberate placeholders-with-provenance: Sprint 1 task
`T-1.3` replaces each one with the figure read from the actual downloaded dataset
and updates `source_id` and `retrieved_on` accordingly.

| mode_key | Label | Category | g/p-km | Occupancy assumption |
|---|---|---|---|---|
| `car_petrol` | Petrol car | car | 170 | 1.6 occupants |
| `car_diesel` | Diesel car | car | 171 | 1.6 occupants |
| `car_electric` | Electric car | car | 47 | 1.6 occupants, grid average |
| `car_average` | Car (average) | car | 170 | **baseline** |
| `motorbike` | Motorbike | other | 103 | 1.0 |
| `bus_city` | City bus | public_transport | 97 | average load factor |
| `coach` | Coach | public_transport | 27 | average load factor |
| `train_national` | National rail | public_transport | 35 | average load factor |
| `train_metro` | Metro / underground | public_transport | 28 | average load factor |
| `tram` | Tram / light rail | public_transport | 29 | average load factor |
| `ferry` | Ferry (foot passenger) | other | 113 | — |
| `e_scooter` | E-scooter | other | 20 | lifecycle estimate |
| `cycling` | Cycling | active | 0 | by definition |
| `walking` | Walking | active | 0 | by definition |

**Why cycling and walking are 0.** The brief specifies it, and it is the standard
convention for transport accounting: no fuel is combusted and no vehicle operates.
A full lifecycle view would assign a small non-zero figure for bicycle manufacture
and additional food intake. The Learn page states this explicitly rather than
pretending zero is the whole truth.

## 4.3 The calculation

```
emissions_kg(mode) = distance_km × factor_g_per_pkm(mode) ÷ 1000
```

With a return trip, `distance_km` is doubled before the multiplication.

### Distance

Primary: OSRM road distance for the driving profile.
Fallback: haversine great-circle distance × 1.25.

The same distance is used for every mode. This is a simplification we state openly:
a cycle route and a motorway route between the same two points are not the same
length. Using one distance keeps the comparison on a like-for-like basis, which is
what the user is actually asking about ("for this journey, what does each option
cost?"). FR-7 (per-mode routing) is the stretch goal that would remove the
simplification.

### CO₂ saved

```
saved_kg = max(0, distance_km × (baseline_factor − chosen_factor) ÷ 1000)
```

The baseline is `car_average`. The number means: *"compared with making this
journey by average car."* It is **not** a claim that the user would otherwise have
driven. The UI labels it "CO₂ saved vs driving" and never just "CO₂ saved", and the
Learn page spells out the counterfactual.

`max(0, …)` means choosing a mode worse than the baseline (e.g. a lone motorbike on
a short hop, or a ferry) records a saving of zero rather than a negative — the
leaderboard measures avoided emissions, not a net ledger. `emitted_g` is always
recorded truthfully, so a net view can be added later without re-logging.

## 4.3b Co-benefits

A kilogram of CO₂ is not a unit anybody has intuition for. `src/lib/benefits.js`
converts a journey into things people can picture. These are **framing, not
measurement** — the Learn page says so, and each card can reveal its assumption.

| Co-benefit | Formula | Constant | Basis |
|---|---|---|---|
| Calories | `MET × body mass (kg) × hours` | walking 3.5 MET @ 4.8 km/h; cycling 7.5 MET @ 15 km/h; 70 kg adult | Compendium of Physical Activities (Ainsworth et al.) |
| Steps | `km × 1300` | 1,300 steps/km | Average adult stride ≈ 0.77 m |
| Tree-days | `kg ÷ (21.8 ÷ 365)` | 21.8 kg CO₂/tree/year | US EPA Greenhouse Gas Equivalencies Calculator |
| Petrol litres | `km × 6.8 ÷ 100` | 6.8 L/100 km; 2.31 kg CO₂/L | Typical medium petrol car |
| Phone charges | `kg ÷ 0.0083` | 8.3 g CO₂e per charge | US EPA Greenhouse Gas Equivalencies Calculator |
| Money | `litres × price per litre` | `fuel_prices` table, by country | National regulators / GlobalPetrolPrices |

### Why "money saved" is fuel only

The money card states **the fuel a car would have burned, that you did not buy**.
It is not a net saving, and it deliberately does not subtract the fare or ticket
you paid instead.

We have no fare data — fares vary by operator, time of day, ticket type and
railcard, and no open dataset covers them globally. A "net saving" built on a
guessed fare would frequently be *negative*: in the UK a rail fare routinely
exceeds the petrol cost for the same journey. Publishing a confident negative
number derived from an invented fare would be worse than publishing nothing.

What we state instead is narrow and defensible, and the card's basis line spells
out what is excluded: fares, parking, insurance, tax and wear.

**Australia is the default market.** Currency, number formatting and the
dashboard's opening country all default to Australia, and a trip starting
somewhere without its own price row falls back to the AU row rather than to a
global average — so a user who never leaves Australia never sees a foreign
currency. These are defaults, not restrictions: a trip starting elsewhere uses
that country's own row when one exists, and the defaults live in
`src/lib/locale.js` so switching market is a one-file change.

Pump prices live in the `fuel_prices` table rather than in code — a litre costs
roughly ten times more in the UK than in Kuwait, so a single constant would be
wrong almost everywhere. Each row carries `updated_on`, and the UI shows that
date rather than implying the price is live. A `ZZ` row is the global fallback.

### Rules these follow

1. Every constant is an average with a named basis. **None is a measurement of the
   person reading it** — calories in particular depend on body mass, pace, terrain
   and wind, and the card says so.
2. **"Tree-days" is a time-to-absorb comparison, not an offset.** Nothing in this
   app is sold, traded or claimed as a carbon credit, and the wording never implies
   a journey has been neutralised.
3. Figures round hard. Stating "254.7 kcal" would imply a precision the inputs do
   not support.
4. For a car, the cards state the cost of the trip rather than congratulating the
   user. Celebrating a saving that was not made would be dishonest framing.

> **Sprint 1, T-1.8.** These are well-known published figures but are not yet
> verified against their primary sources. Confirm each one, add rows to
> `data_sources`, and cite them on the Learn page — the same treatment the emission
> factors get in T-1.3. Until that is done they are placeholders-with-provenance.

### Why these live in code rather than the database

Story 6.1 requires *emission factors* to come from the database, and they do. These
are presentation-layer framing constants that do not vary by deployment and are
never used in an emissions calculation. If the team reads 6.1 broadly, they should
move to a `benefit_factors` table — raise it alongside the `fallbackFactors.js`
question at the Sprint 1 review.

## 4.4 Known limitations

To be reproduced verbatim on the Learn page:

1. One distance is used for all modes; real cycle and rail routes differ.
2. Factors are national/regional averages, not the specific vehicle or service used.
3. Electric vehicle figures depend on grid carbon intensity, which varies by country
   and by hour; we use a single average.
4. Public transport factors assume average occupancy; an empty late-night bus is far
   worse per passenger, a full one far better.
5. The savings baseline is a convention, not a measured counterfactual.
6. Walking and cycling are zero on an operational basis, not a lifecycle basis.
7. Trip logs are unverified and unauthenticated; the aggregate indicates engagement,
   not audited emissions reduction.
8. Co-benefit figures (calories, steps, tree-days, litres) are averages for an
   assumed body mass and an assumed vehicle, not measurements of you or your car.
9. "Tree-days" compares a quantity of CO₂ to a tree's absorption rate. It is not an
   offset and nothing here is a carbon credit.
10. Money shown is fuel cost only, in Australian dollars unless the trip starts in
    another listed country, at an indicative pump price stamped with the date
    it was recorded. It is not a net saving: any fare you paid instead is not
    subtracted, and parking, insurance, tax and wear are not included.

## 4.5 Data licensing

Each source's licence is recorded in the `data_sources` table and surfaced on the
Learn page. Attribution requirements: OGL v3.0 (A1) and CC BY (B1) both require
visible attribution; Nominatim and OSRM require "© OpenStreetMap contributors" on
any map or derived route display.
