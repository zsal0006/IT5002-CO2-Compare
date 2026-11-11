# CO2 Compare

Compare the carbon cost of a journey by car, bike, walking, train and bus — then
log what you actually took and watch the avoided emissions add up across your country
and the world.

IT5002 coursework project.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run dev                    # http://localhost:5173
```

The calculator works immediately using bundled emission factors. The dashboard,
methodology source list, and trip logging need a Supabase project configured in
`.env.local`.

## What it does

- **Compare** — enter two places, compare bike, walking, train and bus against a
  car baseline, and log the mode you actually took.
- **Impact** — what everyone has avoided, by region and globally, broken down by
  transport mode.
- **Dashboard** — a world map shaded by transport emissions, plus any country's
  emissions trend since 1970 and its share of that country's total.
- **How we calculate this** — the formula, every emission factor with its source, and
  an honest list of what the numbers do not tell you.

## Stack

Vue 3 (Composition API) · Vite · Pinia · Vue Router · Supabase (Postgres) ·
Nominatim and OSRM for geocoding and routing. Charts are rendered with SVG and CSS.

No custom backend: the one operation that cannot be trusted to the browser — computing
the CO₂ saved before it is written to a shared total — is a `SECURITY DEFINER` Postgres
function.

## Deployment

The repository includes Vercel build, SPA rewrite, and asset cache configuration in
`vercel.json`. Configure the two `VITE_` environment variables in the deployment
environment.

> `VITE_` variables are compiled into the client bundle. Only the Supabase **anon**
> key belongs there; it is safe because row-level security constrains it.

## Privacy

A logged trip stores a distance, a transport mode, a country code and a state or
province. No accounts, no cookies, no tracking, and deliberately no addresses and no
coordinates: a home-to-work coordinate pair is close to unique, so storing it would
undo the anonymity the rest of the design depends on. A province holds millions of
people and cannot narrow to a person, which is why the line is drawn there and no
finer.

## Project map

See [COMPONENT-MAP.md](COMPONENT-MAP.md) for the routes and component tree.
The Learn page (`/learn`) explains the calculation and its limitations.

## Repository layout

```
supabase/    migrations and seed SQL
data/        human-editable reference CSVs
public/geo/  vendored country boundaries for the world map
src/lib/     pure logic — the calculation, geocoding, routing, country codes
src/stores/  Pinia stores
src/views/   one per route
src/components/
```

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

## Attribution

Geocoding and routing © OpenStreetMap contributors (Nominatim, OSRM).
Emission factors and national emissions data are credited on the app's Learn page.
