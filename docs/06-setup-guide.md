# 6. Setup Guide

From a clean clone to a running app. Target: under ten minutes.

## 6.1 Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20 or newer | `node -v` |
| npm | 10 or newer | `npm -v` |
| Git | any recent | `git --version` |

A Supabase account (free tier) is needed for the dashboard and trip logging. The
calculator runs without one, using the bundled fallback factors.

## 6.2 Run the app locally

```bash
git clone <your-team-remote> co2-compare
cd co2-compare
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
npm run dev
```

Open http://localhost:5173.

Without Supabase credentials you will see a notice that bundled factors are in use —
that is the designed fallback, not a failure.

## 6.3 Set up Supabase

1. Create a project at https://supabase.com (region: closest to the team).
2. **Project settings → API**: copy the Project URL and the `anon` `public` key.
3. Put them in `.env.local`:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

4. **SQL Editor → New query**: paste and run, in this order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/seed/0100_seed_sources_and_factors.sql`
5. Restart `npm run dev` — Vite only reads `.env.local` at startup.

> The `anon` key is designed to be public and ships in the client bundle. It is safe
> because row-level security restricts what it can do. The **service role** key is
> not safe and must never appear in this repository or in any `VITE_`-prefixed
> variable, which Vite inlines into the bundle.

## 6.4 Load the country emissions dataset

Sprint 1, T-1.1. Until this is done the Dashboard and the world map have nothing
to show.

### 1. Download

Dataset: **"Country-Level Yearly GHG Emissions + Transport Sector (1970-2024)"**,
published by **GIZ**, built from **EDGAR** data (European Commission).

- Package: `https://ckan.tdc.prod.datopian.com/api/action/package_show?id=d16b0c80-35d4-428b-9453-e4e4626e7365`
- The one resource is `GHG_01072026.xlsx`, about 1.4 MB.

There is **no CSV version** and the CKAN datastore for this resource returns no
rows, so neither `datastore_search` nor a direct CSV link is an option.

### 2. Convert and normalise

> **Already done.** `data/country_transport_emissions.csv` is committed —
> 12,305 rows across 224 countries, 1970–2024. Skip to step 3 unless you are
> refreshing it from a newer download.

The download is XLSX and our loader reads CSV, so convert it first. No Excel
needed:

```bash
python -I scripts/xlsx-to-csv.py <the-download>.xlsx data/raw/ghg-giz.csv
node scripts/prepare-country-emissions.mjs
```

`data/raw/` is git-ignored; the generated CSV in `data/` is committed so
teammates need neither the spreadsheet nor a converter.

**The source is wide; our table is long.** GIZ ships one row per country with
ten columns per year repeating from 1970 to 2024 — roughly 552 columns:

```
EDGAR Country Code | Global_Emissions_1970 [MtCO2e] | Transport_Emissions_1970 [MtCO2e] | …
AUS                | 311.2                          | 55.7                              | …
```

The script unpivots that into one row per country-year. There is no `year`
column to find — the year is inside each column name. There is also no country
**name** column, only an ISO3 code, so names are derived via `src/lib/iso.js`
and `Intl.DisplayNames`.

What it reads, and what it ignores:

| Source measure | Our column |
|---|---|
| `Transport_Emissions_YYYY [MtCO2e]` | `transport_mt_co2e` |
| `Global_Emissions_YYYY [MtCO2e]` | `total_mt_co2e` |
| `Share_Transport_National_YYYY [fraction]` | used to verify, not loaded |
| Share global, population, per-capita, Rank1–3 sector | ignored for now |

Units are megatonnes CO₂e, which is what the schema expects.

#### Read the sanity check before loading

`Global_Emissions` is an ambiguous name, so the script does not take our reading
of it on trust. It recomputes `transport ÷ total` and compares that against the
file's own `Share_Transport_National`:

```
Sanity check — is Global_Emissions really the national total?
  OK — 12214 of 12214 agree within 2 points.
  Global_Emissions reads as the national all-sector total, as assumed.
```

If instead it prints `*** MISMATCH ***`, stop. Either `Global_Emissions` is
something other than the country's all-sector total — the world total, most
likely — or the numbers are being parsed wrongly. Loading it anyway would make
the dashboard's share-of-total figure silently wrong.

> **This check has already earned its keep.** The first run reported a mismatch
> on 11,134 of 12,214 rows with "stated" shares like `4927269082996931`. The
> cause was ours: the file writes most decimals with a **comma**
> (`14230,22955`) and the rest with a dot, and the loader was stripping commas,
> turning `0,0492…` into an integer. A source that mixes separators must be
> re-checked the same way — `CHN` has five digits before its comma, and no cell
> in the file carries both separators, which is what proves the comma is a
> decimal point and not thousands grouping.

Expect 224 countries across 1970–2024 and about 12,300 rows. Rows without a
three-letter ISO code are aggregates such as `EU27` and are skipped.

### 3. Create the staging table

SQL Editor → run `supabase/seed/0101_staging_country_emissions.sql`.

This only creates the empty table. It is a separate file from the loader
because a human has to upload a file between the two — and when both lived in
one script, running it straight through created the table and read zero rows
from it, succeeding silently.

### 4. Import into staging

Supabase Studio → **Table editor** → `staging_country_emissions` → **Import data
from CSV** → upload `data/country_transport_emissions.csv`.

The columns already match by name, so there is nothing to map by hand. Loading
into staging rather than the real table means a bad file cannot corrupt
`country_transport_emissions`, and the generated `transport_share_pct` column
stays out of the way.

### 5. Move it across

Run `supabase/seed/0102_load_country_emissions.sql`. It refuses to run against
an empty or wrongly-mapped staging table, upserts on `(country_code, year)` so
it is safe to re-run, then prints row counts and three countries to check:

```
AUS  Australia   92.2  579.5  15.9%
AUT  Austria     21.9   77.0  28.5%
BHR  Bahrain      3.3   63.2   5.3%
```

Australia and Austria must be distinct — they share the first two letters of
their ISO3 codes, which is the mix-up `src/lib/iso.js` exists to prevent on the
client. Clear staging with the `truncate` at the foot of the file once those
figures look right.

### 6. Reconcile the map

```sql
select distinct country_code from country_transport_emissions order by 1;
```

Anything with no matching boundary feature renders unshaded (task T-4.10).

## 6.4b Country boundaries (already vendored)

`public/geo/countries.geo.json` is committed to the repository — the world map (story
5.3) needs it and the emissions datasets do not contain geometry. It is Natural Earth
derived, public domain, 180 features keyed by ISO alpha-3.

Nothing to do unless you want to refresh it. If you do, keep `feature.id` as the
alpha-3 code: `WorldEmissionsMap.vue` joins on it.

After loading the GIZ data, reconcile the two lists (task T-4.10):

```sql
select distinct country_code from country_transport_emissions order by 1;
```

Anything in that list with no matching boundary feature simply renders unshaded. Note
the unmatched codes on the Learn page rather than leaving them unexplained.

## 6.5 Verify the install

Run these in the SQL editor. All four should pass.

```sql
-- 1. Factors loaded, exactly one baseline
select count(*) as factors,
       count(*) filter (where is_baseline) as baselines
from emission_factors;                       -- expect 14, 1

-- 2. Country data loaded
select count(*) as rows, count(distinct country_code) as countries
from country_transport_emissions;            -- expect thousands, ~190

-- 3. Logging works and computes the saving itself
select log_trip(10, 'cycling', 'GB', 'Scotland');   -- expect saved_kg ≈ 1.7

-- 4. Direct writes are refused
insert into trip_logs (distance_km, mode_key, country_code, region_name, emitted_g, saved_g)
values (1, 'cycling', 'GB', 'Scotland', 0, 999999);  -- expect a policy violation
```

Check 4 must fail. If it succeeds, RLS has not been applied and the leaderboard can
be forged — fix it before going further.

In the browser, confirm the same from the console on the deployed site: a direct
`supabase.from('trip_logs').select()` should return no rows and an error.

## 6.6 Deploy to Vercel

Hosting is Vercel (decided in Sprint 0). `vercel.json` in the repository root holds the
build settings, the SPA rewrite and the asset cache headers, so the dashboard needs
almost nothing configured by hand.

### First-time setup

1. Push the repository to GitHub (or GitLab / Bitbucket).
2. At https://vercel.com → **Add New → Project**, import the repository.
3. Vercel detects the Vite preset. Leave the build settings alone — `vercel.json`
   already specifies `npm run build` and `dist`.
4. Under **Environment Variables**, add both variables **before** the first deploy —
   Vite inlines them at build time, so a deploy that ran without them will serve a
   bundle with no Supabase connection until you redeploy:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `VITE_SUPABASE_URL` | your project URL | Production, Preview, Development |
   | `VITE_SUPABASE_ANON_KEY` | your `anon` `public` key | Production, Preview, Development |

5. Deploy. Subsequent pushes to `main` deploy to production automatically; every pull
   request gets its own preview URL, which is what the sprint reviews should demo.

> Only ever put the **anon** key here. Anything prefixed `VITE_` is compiled into the
> JavaScript bundle and is readable by anyone who opens devtools. The service-role key
> must never appear in a `VITE_` variable, in `vercel.json`, or in this repository.

### What `vercel.json` does

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

Vue Router runs in history mode, so `/dashboard` is a client-side path with no file
behind it. Without this rewrite, loading or refreshing that URL directly returns a 404.
Vercel checks the filesystem before applying rewrites, so real assets are still served
normally; only unmatched paths fall through to `index.html`.

The `headers` block marks `/assets/*` immutable for a year. Vite content-hashes those
filenames, so a changed file gets a new name and the stale cache can never be served.

### Changing the environment later

Environment variables are read at **build** time, not run time. After editing one in
the Vercel dashboard you must redeploy (Deployments → ⋯ → Redeploy) for the change to
reach the bundle. Editing the variable alone changes nothing on the live site.

### Verifying a deploy

1. Open the production URL, run a calculation — confirms the build and the OSM services.
2. Navigate to `/dashboard`, then **refresh the page** — confirms the SPA rewrite.
3. Open devtools → Console and run
   `await (await fetch('/')).status` — sanity check, expect `200`.
4. From that console, confirm RLS holds in production: a direct
   `supabase.from('trip_logs').select()` must return an error and no rows
   (checks D-8 and D-9 in `08-testing-and-acceptance.md`).

## 6.7 Project layout

```
.
├── vercel.json                deploy settings: SPA rewrite + asset cache headers
├── docs/                      specification and plan (this folder)
├── supabase/
│   ├── migrations/            schema — apply in order
│   └── seed/                  reference data
├── public/geo/                vendored country boundaries for the world map
├── data/                      human-editable CSVs; raw downloads git-ignored
├── public/
└── src/
    ├── lib/                   pure logic and API wrappers (unit-testable)
    │   ├── emissions.js       THE calculation — one place, no side effects
    │   ├── geocode.js         Nominatim, throttled and cached
    │   ├── routing.js         OSRM with haversine fallback
    │   ├── iso.js             alpha-3 ↔ alpha-2 country codes
    │   └── supabase.js        client, degrades when unconfigured
    ├── stores/                Pinia: factors · trip · stats · countries
    ├── components/            presentational, no data fetching
    ├── views/                 Compare · Impact · Dashboard · Learn
    └── assets/theme.css       design tokens incl. the validated chart palette
```

## 6.8 Conventions

- **Branches:** `feature/T-2.3-osrm-routing`, referencing the task id from the plan.
- **Pull requests:** one approval before merge to `main`. No direct pushes.
- **Commits:** imperative mood, task id in the body — `Add OSRM routing with fallback`.
- **Components** take props and emit events; they do not call stores or the network.
  Views wire stores to components. This keeps components trivially reviewable.
- **Never** put a secret in a `VITE_`-prefixed variable other than the anon key.
- **Chart colours** come from `theme.css` custom properties. If you change one, re-run
  the palette validation described in the comment at the top of that file — the
  current values are checked for colour-blind separation in both light and dark mode.
