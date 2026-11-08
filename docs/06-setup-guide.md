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
VITE_APP_CONTACT=your-team-email@example.ac.uk
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

From https://portal.transport-data.org/@giz/country-level-yearly-ghg-emissions-transport-sector-1970-2024
Save the CSV anywhere under `data/raw/` — that folder is git-ignored, so the raw
download never reaches the repository.

### 2. Normalise

```bash
node scripts/prepare-country-emissions.mjs
```

The script finds the one CSV in `data/raw/`, works out which source column feeds
each of ours, and writes `data/country_transport_emissions.csv` with exactly the
five columns `staging_country_emissions` expects.

**Read what it prints.** It reports the column mapping it chose and how many rows
it skipped and why. A wrong guess is visible here, before anything reaches the
database. If a column shows `*** NOT FOUND ***`, add the real header name to the
`MAPPING` object at the top of the script and run it again.

```bash
node scripts/prepare-country-emissions.mjs --inspect   # headers only, writes nothing
node scripts/prepare-country-emissions.mjs --in data/raw/other.csv
```

Expect roughly 190 countries across 1970–2024. Rows skipped for lacking a
three-letter ISO code are usually aggregates such as `WORLD` or `EU27`.

### 3. Import into staging

Supabase Studio → **Table editor** → `staging_country_emissions` → **Import data
from CSV** → upload `data/country_transport_emissions.csv`.

The columns already match by name, so there is nothing to map by hand. Loading
into staging rather than the real table means a bad file cannot corrupt
`country_transport_emissions`, and the generated `transport_share_pct` column
stays out of the way.

### 4. Move it across

Run `supabase/seed/0101_load_country_emissions.sql` and work through its numbered
comment blocks: check what arrived, insert with `on conflict do update`, verify a
few countries against the portal, then clear staging.

### 5. Reconcile the map

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
   | `VITE_APP_CONTACT` | your team email | Production, Preview, Development |

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
