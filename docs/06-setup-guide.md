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
git clone <your-team-remote> carbonroute
cd carbonroute
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
   - `supabase/seed/0002_seed_sources_and_factors.sql`
5. Restart `npm run dev` — Vite only reads `.env.local` at startup.

> The `anon` key is designed to be public and ships in the client bundle. It is safe
> because row-level security restricts what it can do. The **service role** key is
> not safe and must never appear in this repository or in any `VITE_`-prefixed
> variable, which Vite inlines into the bundle.

## 6.4 Load the country emissions dataset

1. Download the GIZ dataset from
   https://portal.transport-data.org/@giz/country-level-yearly-ghg-emissions-transport-sector-1970-2024
2. Save it as `data/country_transport_emissions.csv` (git-ignored under `data/raw/`
   if it is large).
3. Inspect the header row. Rename columns to match the staging table:
   `country_code, country_name, year, transport_mt_co2e, total_mt_co2e`.
4. In Supabase: **Table editor → `staging_country_emissions` → Import data from CSV**.
5. Run `supabase/seed/0003_load_country_emissions.sql` and work through its numbered
   comment blocks — it checks what arrived before writing to the real table.
6. Run `missingAlpha2()` from `src/lib/iso.js` against the distinct country codes and
   add anything it reports.

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
select log_trip(10, 'cycling', 'GB');        -- expect saved_kg ≈ 1.7

-- 4. Direct writes are refused
insert into trip_logs (distance_km, mode_key, country_code, emitted_g, saved_g)
values (1, 'cycling', 'GB', 0, 999999);      -- expect a policy violation
```

Check 4 must fail. If it succeeds, RLS has not been applied and the leaderboard can
be forged — fix it before going further.

In the browser, confirm the same from the console on the deployed site: a direct
`supabase.from('trip_logs').select()` should return no rows and an error.

## 6.6 Deploy

Either host works; pick one in Sprint 0 and do not maintain both.

**Netlify**
- Build command `npm run build`, publish directory `dist`.
- Add both `VITE_` variables under Site configuration → Environment variables.
- Add `public/_redirects` containing `/*  /index.html  200` so deep links work with
  history-mode routing.

**Vercel**
- Framework preset: Vite. Build and output are detected.
- Add the environment variables under Settings → Environment Variables.
- SPA rewrites are handled automatically.

## 6.7 Project layout

```
.
├── docs/                      specification and plan (this folder)
├── supabase/
│   ├── migrations/            schema — apply in order
│   └── seed/                  reference data
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
    ├── views/                 one per route, orchestrate stores
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
