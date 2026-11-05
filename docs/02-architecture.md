# 2. System Architecture

## 2.1 Overview

CO2 Compare is a **client-heavy SPA with a thin managed backend**. There is no
custom server process to build, deploy or pay for: Supabase provides Postgres, an
auto-generated REST API over it, and row-level security. The only server-side code
we write is SQL (tables, views, and two functions).

```
┌──────────────────────────────────────────────────────────────┐
│  Browser — Vue 3 SPA                                         │
│                                                              │
│  Views          Calculator · Dashboard · Learn               │
│  Stores (Pinia) factors · trip · stats · countries           │
│  Services       geocode.js · routing.js · emissions.js       │
└───────┬──────────────────────┬───────────────────────────────┘
        │                      │
        │ HTTPS                │ HTTPS (supabase-js)
        ▼                      ▼
┌───────────────────┐   ┌──────────────────────────────────────┐
│ OSM public APIs   │   │ Supabase                             │
│                   │   │                                      │
│ Nominatim         │   │  Postgres                            │
│   → geocoding     │   │   emission_factors                   │
│                   │   │   country_transport_emissions        │
│ OSRM              │   │   trip_logs                          │
│   → road distance │   │   v_savings_by_country / _global     │
│     + geometry    │   │   rpc: log_trip() · rpc: country_…() │
└───────────────────┘   │  PostgREST + RLS (anon key)          │
                        └──────────────────────────────────────┘
```

### Default market

Australia. `src/lib/locale.js` holds the country codes, locale and currency that
everything falls back to when a trip's own location cannot supply them — the
dashboard's opening country, number and date formatting, and the fuel price used
for the money co-benefit. Switching market is a one-file change; nothing else
hard-codes a country.

## 2.2 Technology choices and rationale

| Layer | Choice | Why |
|-------|--------|-----|
| UI framework | Vue 3 (Composition API) + Vite | Required by the brief; Vite gives sub-second HMR. |
| State | Pinia | Caches emission factors and country data so we hit the network once per session. No PII is held. |
| Routing | vue-router | Three views; hash-free history mode. |
| Charts | Chart.js via vue-chartjs | Declarative, small, good accessibility story when paired with a table. |
| Map (stretch) | Leaflet + OSM tiles | No API key, no billing. |
| Database | Supabase (Postgres) | Free tier, instant REST API, RLS, SQL views do the aggregation for us. |
| Geocoding | Nominatim | Free, no key. Rate-limited to 1 req/s — we debounce and cache. |
| Distance | OSRM demo server | Free, no key, real road distance rather than straight-line. |
| Hosting | Vercel | Deploys a Vite SPA from git with no build configuration; free tier covers coursework traffic; preview deployments per pull request. |

### Why no custom backend

"Backend" here means Supabase: Postgres, the REST API generated over it, row-level
security, and three functions. There is no Node or Express tier to write or deploy.

The business logic the brief describes — multiplying a distance by the emission
factors — runs in the database:

| Function | Does | Why it is server-side |
|---|---|---|
| `compare_journey(km, modes)` | kg CO₂e per mode for a journey | The brief's business logic. Factors never leave the database to be multiplied. |
| `log_trip(km, mode, country, region)` | Records a trip and its saving | `SECURITY DEFINER`. The saving must not be computed by a client that could forge it. |
| `country_series(code)` | A country's emissions by year | Keeps the dashboard query in one place. |

Distance still comes from OSRM via the browser, because routing is an external
service and proxying it through the database would add a hop without adding trust.

`src/lib/emissions.js` holds a pure client implementation of the same arithmetic.
It is the documented degraded mode for when `compare_journey` cannot be reached
(NFR-7), and it covers the instant between toggling a return trip and the refetch
landing — not a second source of truth. When Supabase answers, its figures are the
ones displayed, and `trip.usingServerCompare` records which path produced them.

## 2.3 Request flows

### Flow A — calculate a comparison

1. User submits start and end text.
2. `geocode.js` calls Nominatim for each (debounced, results cached in Pinia).
3. `routing.js` calls OSRM `/route/v1/driving/{lon,lat};{lon,lat}`.
   - On failure or timeout (3s), falls back to the haversine great-circle distance
     × 1.25 detour factor, and sets `estimateIsApproximate = true`.
4. `emissions.js` multiplies distance (km) by each factor (g CO₂e / passenger-km)
   from the `factors` store and returns an array sorted ascending.
5. The view renders the bar chart, the data table, and the per-mode cards.

### Flow B — log a trip

1. User picks the mode they actually used and presses **Log this trip**.
2. The client calls `rpc('log_trip', { distance_km, mode_key, country_code })`.
3. The function looks up the factor and the baseline factor itself, computes
   `emitted_g` and `saved_g`, inserts the row, and returns the new row id plus the
   updated country and global totals.
4. The `stats` store refreshes.

Nothing in the request identifies the user. There is no IP logging, no cookie, no
device id, no session id persisted beyond the tab.

### Flow C — dashboard

1. `countries` store fetches the distinct country list once.
2. On country selection, fetch `country_transport_emissions` rows for that ISO3
   code (1970–2024) and the savings rows from the two views.
3. Render the time series, the share-of-total tile, and the savings tiles.

## 2.4 Failure handling

| Failure | Behaviour |
|---------|-----------|
| Geocoding returns no match | Inline field error: "We couldn't find that place. Try adding a city or country." |
| Geocoding returns several matches | Show the top 5 as a pick-list; user confirms. |
| OSRM unavailable / >3s | Fall back to haversine × 1.25; show an "approximate distance" notice. |
| Supabase unreachable | Calculator still works from a bundled fallback factor table; dashboard shows an error state with a retry. |
| Country cannot be determined | Trip is logged with country code `ZZ` (unknown) and still counts towards the global total. |

## 2.5 Security and privacy posture

- The Supabase **anon** key is public by design; it is restricted by RLS.
- `trip_logs` grants anon `INSERT` only through the `log_trip` function, and `SELECT`
  is denied entirely — the client reads aggregates from views, never raw rows.
- Reference tables (`emission_factors`, `country_transport_emissions`) are
  `SELECT`-only for anon.
- No PII is collected, so there is no data-subject surface to manage.
- Environment variables live in `.env.local`, which is git-ignored. `.env.example`
  documents the names only.
