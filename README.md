# CarbonRoute

Compare the carbon cost of a journey by car, bus, train, bicycle and on foot — then
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

The calculator works immediately using bundled emission factors. For the dashboard and
trip logging you need a Supabase project — see
[docs/06-setup-guide.md](docs/06-setup-guide.md).

## What it does

- **Compare** — enter two places, get kg CO₂e for five transport modes over that route.
- **Log** — record the mode you actually used; the saving versus driving is computed
  in the database and added to your country's total.
- **Dashboard** — national transport-sector emissions from 1970 to 2024, the transport
  share of national totals, and what users have collectively avoided.
- **How it works** — the formula, every emission factor with its source, and an honest
  list of what the numbers do not tell you.

## Stack

Vue 3 (Composition API) · Vite · Pinia · Vue Router · Chart.js · Supabase (Postgres) ·
Nominatim and OSRM for geocoding and routing.

No custom backend: the one operation that cannot be trusted to the browser — computing
the CO₂ saved before it is written to a shared total — is a `SECURITY DEFINER` Postgres
function.

## Privacy

A logged trip stores a distance, a transport mode and a two-letter country code. No
accounts, no cookies, no tracking, and deliberately no coordinates: a home-to-work
coordinate pair is close to unique, so storing it would undo the anonymity the rest of
the design depends on.

## Documentation

| Document | What's in it |
|----------|--------------|
| [01 Requirements](docs/01-requirements.md) | Functional and non-functional requirements, scope, assumptions |
| [02 Architecture](docs/02-architecture.md) | System design, technology rationale, request flows, failure handling |
| [03 Data model](docs/03-data-model.md) | Tables, views, functions, row-level security |
| [04 Datasets and methodology](docs/04-datasets-and-methodology.md) | Sources, emission factors, the calculation, limitations |
| [05 Implementation plan](docs/05-implementation-plan.md) | Five sprints, task breakdown, risk register |
| [06 Setup guide](docs/06-setup-guide.md) | Local setup, Supabase, data loading, deployment, conventions |
| [07 API contracts](docs/07-api-contracts.md) | Every external and internal interface |
| [08 Testing and acceptance](docs/08-testing-and-acceptance.md) | Test plan, acceptance criteria per requirement, demo script |

## Repository layout

```
docs/        specification and plan
supabase/    migrations and seed SQL
data/        human-editable reference CSVs
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
Emission factors and national emissions data are credited in full on the app's
"How it works" page and in [docs/04](docs/04-datasets-and-methodology.md).
