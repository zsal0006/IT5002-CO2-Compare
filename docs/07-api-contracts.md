# 7. API Contracts

Everything the client talks to, and the exact shape of each exchange.

---

## 7.1 Nominatim — geocoding

`GET https://nominatim.openstreetmap.org/search`

| Parameter | Value |
|-----------|-------|
| `q` | the user's free text |
| `format` | `jsonv2` |
| `addressdetails` | `1` |
| `limit` | `5` |

**Usage policy** (https://operations.osmfoundation.org/policies/nominatim/): maximum
one request per second, identify the application, cache results, no bulk use. We
comply via a module-level queue in `src/lib/geocode.js` holding requests at least
1100 ms apart, a 500 ms input debounce, and a per-tab result cache.

Response fields we use:

```json
[{
  "display_name": "Edinburgh, Scotland, United Kingdom",
  "lat": "55.9533", "lon": "-3.1883",
  "address": { "country_code": "gb" }
}]
```

Mapped to:

```js
{ label: string, lat: number, lon: number, countryCode: string /* uppercase */ }
```

Failure modes: `[]` for no match (shown as a field error); non-2xx throws and the
input shows "Location search is unavailable right now."

---

## 7.2 OSRM — route distance

`GET https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`

| Parameter | Value |
|-----------|-------|
| `overview` | `simplified` |
| `geometries` | `geojson` |

Response fields we use: `routes[0].distance` (metres), `routes[0].duration`
(seconds), `routes[0].geometry.coordinates` (`[lon, lat]` pairs — Leaflet wants
`[lat, lon]`, so we swap them).

Bounded by a 3000 ms `AbortController` timeout. On any failure:

```js
{ km: haversineKm(a, b) * 1.25, approximate: true, geometry: null, durationMin: null }
```

`approximate: true` drives a visible on-screen notice (NFR-7). The demo server offers
no availability guarantee; the fallback is the contract, not an afterthought.

---

## 7.3 Supabase — reads

All via `supabase-js` with the anon key. Row-level security permits `select` only.

### `emission_factors`
```js
supabase.from('emission_factors')
  .select('mode_key, mode_label, category, factor_g_per_pkm, is_baseline, display_order, source_id, notes')
  .eq('is_active', true)
  .order('display_order')
```

### `data_sources`
```js
supabase.from('data_sources').select('*')
```

### `v_savings_global` → single row
```js
supabase.from('v_savings_global').select('*').single()
// { trips, total_saved_kg, total_emitted_kg, total_distance_km, countries }
```

### `v_savings_by_country`
```js
supabase.from('v_savings_by_country').select('*').order('total_saved_kg', { ascending: false })
// [{ country_code, trips, total_saved_kg, total_emitted_kg, total_distance_km }]
```

### `v_mode_popularity`
```js
supabase.from('v_mode_popularity').select('*').order('trips', { ascending: false })
// [{ mode_key, mode_label, category, trips, share_pct }]
```

### `country_series(p_country_code)` — RPC
```js
supabase.rpc('country_series', { p_country_code: 'GBR' })
// [{ year, transport_mt_co2e, total_mt_co2e, transport_share_pct }]  ordered by year
```

---

## 7.4 Supabase — the one write

### `log_trip` — RPC

```js
const { data, error } = await supabase.rpc('log_trip', {
  p_distance_km: 12.4,      // numeric, (0, 20000]
  p_mode_key: 'cycling',    // must exist and be active
  p_country_code: 'GB'      // ISO alpha-2; anything else becomes 'ZZ'
})
```

Returns:

```json
{
  "trip_id": "9f1c…",
  "emitted_kg": 0.0,
  "saved_kg": 2.108,
  "country_code": "GB",
  "country_total_kg": 412.6,
  "global_total_kg": 1894.2
}
```

**The client never sends an emissions figure.** The function reads the factor and the
baseline factor from the database and does the arithmetic itself, so the leaderboard
cannot be forged by editing a request in the browser (FR-11).

Error codes:

| Condition | SQLSTATE | Message |
|-----------|----------|---------|
| Distance out of range | `22003` | `distance_km must be between 0 and 20000, got …` |
| Unknown or inactive mode | `23503` | `unknown or inactive mode_key: …` |

Both surface to the user as a non-blocking notice; the comparison stays on screen.

---

## 7.5 Internal contract — `lib/emissions.js`

Pure, no I/O, the single definition of the calculation.

```js
emissionsKg(distanceKm, factorGPerPkm)            // -> number, kg CO2e
savedKg(distanceKm, factorGPerPkm, baselineGPerPkm) // -> number, >= 0
compare(distanceKm, factors, { modeKeys })        // -> ModeResult[], cleanest first
```

```js
/** @typedef ModeResult
 *  { modeKey, label, category, factor, kg, savedVsBaselineKg, isBaseline } */
```

Invariants worth testing directly:

- `emissionsKg(d, 0) === 0` for every `d` — cycling and walking.
- `savedKg` is never negative.
- `compare` returns results sorted ascending by `kg`.
- Doubling the distance doubles every `kg`.
- Negative or non-finite inputs return `0` rather than throwing.
