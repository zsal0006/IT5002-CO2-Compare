# 3. Data Model

All tables live in the `public` schema of a Supabase Postgres database.
The authoritative DDL is `supabase/migrations/0001_init.sql`; this document explains it.

## 3.1 Entity relationship

```
  emission_factors                 country_transport_emissions
  ────────────────                 ───────────────────────────
  mode_key (PK)  ◄──┐              country_code (PK, part)        region_name
  mode_label        │              year         (PK, part)
  category          │              transport_mt_co2e
  factor_g_per_pkm  │              total_mt_co2e
  is_baseline       │              transport_share_pct  (generated)
  source_id ──┐     │
              │     │
              │     │  trip_logs
              │     │  ─────────
              │     └─ mode_key (FK)
              │        id (PK, uuid)
              │        created_at
              │        distance_km
              │        country_code
              │        emitted_g
              │        saved_g
              │
         data_sources
         ────────────
         source_id (PK)
         title · publisher · url · licence · retrieved_on
```

Views: `v_savings_by_country`, `v_savings_by_region`, `v_savings_global`,
`v_savings_by_mode`.

## 3.2 Tables

### `data_sources`

Every number the app displays is traceable to a row here (NFR-8).

| Column | Type | Notes |
|--------|------|-------|
| `source_id` | `text` PK | e.g. `defra-2024` |
| `title` | `text` | |
| `publisher` | `text` | |
| `url` | `text` | |
| `licence` | `text` | e.g. `OGL v3.0`, `CC BY 4.0` |
| `retrieved_on` | `date` | |

### `emission_factors`

One row per transport mode. The unit is **grams CO₂-equivalent per passenger-kilometre**.
Using grams (integer-friendly) rather than kg avoids float rounding noise at short distances;
the UI converts to kg for display.

| Column | Type | Notes |
|--------|------|-------|
| `mode_key` | `text` PK | snake_case, e.g. `car_petrol` |
| `mode_label` | `text` | display name |
| `category` | `text` | `car` / `public_transport` / `active` / `other` |
| `factor_g_per_pkm` | `numeric(8,2)` | `>= 0`; 0 for cycling and walking |
| `is_baseline` | `boolean` | exactly one row is `true` — the savings baseline |
| `display_order` | `smallint` | stable chart ordering |
| `is_active` | `boolean` | lets us retire a factor without deleting history |
| `source_id` | `text` FK → `data_sources` | |
| `notes` | `text` | occupancy assumption, scope |

A partial unique index enforces "exactly one baseline":
`create unique index on emission_factors (is_baseline) where is_baseline;`

### `country_transport_emissions`

Derived from the GIZ / transport-data.org country-level yearly GHG dataset.

| Column | Type | Notes |
|--------|------|-------|
| `country_code` | `char(3)` | ISO 3166-1 alpha-3 |
| `country_name` | `text` | |
| `year` | `smallint` | 1970–2024 |
| `transport_mt_co2e` | `numeric(12,3)` | megatonnes CO₂e from the transport sector |
| `total_mt_co2e` | `numeric(12,3)` | nullable — total national emissions |
| `transport_share_pct` | `numeric(5,2)` | **generated**: `transport / total * 100` |
| `source_id` | `text` FK | |

Primary key `(country_code, year)`. Index on `country_code`.

### `trip_logs`

Append-only. Deliberately contains nothing that identifies a person: no IP, no user
agent, no session token, no coordinates — only the distance, the mode, and a country code.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `created_at` | `timestamptz` | `now()` |
| `distance_km` | `numeric(8,2)` | `> 0 and <= 20000` |
| `mode_key` | `text` FK → `emission_factors` | |
| `country_code` | `char(2)` | ISO 3166-1 alpha-2, or `ZZ` if unknown |
| `region_name` | `text` | State or province from the start point's geocode. Nullable — a trip with no determinable region still counts globally. |
| `emitted_g` | `numeric(12,2)` | computed server-side |
| `saved_g` | `numeric(12,2)` | computed server-side, `>= 0` |

> **Why coordinates are not stored.** A start/end coordinate pair is a strong
> re-identifier — home-to-work pairs are close to unique. Storing distance, country
> and province keeps the aggregate useful while making re-identification impossible:
> a province holds millions of people, so no combination of the stored columns
> narrows to a person. A city would be a different matter, which is why story 6.2's
> boundary is drawn at province level and no finer.

## 3.3 Views

### `v_savings_by_country`
```
country_code, trips, total_saved_kg, total_emitted_kg, total_distance_km
```
Grouped from `trip_logs`. Exposed to anon with `SELECT`.

### `v_savings_by_region`  *(story 4.1)*
```
country_code, region_name, trips, total_saved_kg, total_emitted_kg, total_distance_km
```
A null `region_name` groups under `'Unknown region'` rather than disappearing.

### `v_savings_global`
Single row: the same measures across all countries.

### `v_savings_by_mode`  *(story 4.2)*
```
mode_key, mode_label, category, trips,
total_saved_kg, total_emitted_kg, total_distance_km, share_of_trips_pct
```
Left-joined from `emission_factors`, so a mode nobody has chosen still appears with
zeroes. The headline measure is **kilograms saved**, not trips: a mode picked rarely
for long journeys can out-save one picked often for short hops, and ranking by trip
count would state the opposite.

## 3.4 Functions

### `log_trip(p_distance_km, p_mode_key, p_country_code, p_region_name) returns json`

`SECURITY DEFINER`. The only write path available to the client.

1. Validates `p_distance_km` is in `(0, 20000]`.
2. Validates `p_mode_key` exists and `is_active`.
3. Reads `factor_g_per_pkm` for the mode and for the baseline mode.
4. `emitted_g := distance * factor`; `saved_g := greatest(0, distance * (baseline - factor))`.
5. Trims `p_region_name` and caps it at 80 characters — it is free text from the
   geocoder, so it is length-limited and never interpolated anywhere executable.
6. Inserts and returns `{ trip_id, emitted_kg, saved_kg, country_code, region_name,
   country_total_kg, region_total_kg, global_total_kg }`.

The client cannot inflate the leaderboard: it supplies only distance, mode and country,
and the arithmetic happens in the database against the stored factors.

### `country_series(p_country_code)` *(convenience)*
Returns the year/transport/total/share series for one country, ordered by year.

## 3.5 Row-level security

| Table | anon SELECT | anon INSERT | anon UPDATE/DELETE |
|-------|-------------|-------------|--------------------|
| `data_sources` | ✅ | ❌ | ❌ |
| `emission_factors` | ✅ (`is_active`) | ❌ | ❌ |
| `country_transport_emissions` | ✅ | ❌ | ❌ |
| `trip_logs` | ❌ | ❌ (only via `log_trip`) | ❌ |
| views | ✅ | — | — |

## 3.6 Seeding

| File | Contents |
|------|----------|
| `supabase/seed/0002_seed_sources_and_factors.sql` | `data_sources` + ~15 `emission_factors` rows |
| `supabase/seed/0003_seed_country_emissions.sql` | loader for `data/country_transport_emissions.csv` |
| `data/emission_factors.csv` | human-editable source of truth for the factors |

Re-seeding is idempotent (`on conflict do update`), so the team can pull a refreshed
dataset and re-run without dropping the database.
