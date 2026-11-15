# CO2 Compare

Compare cycling, walking, bus, train and car emissions for the same journey, then
log what you actually took and see the community totals add up.

IT5002 coursework project.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run dev                    # http://localhost:5173
```

Configure Supabase and deploy the address-search and route-distance functions to
compare journeys. Bundled emission factors keep comparisons available when the
database is temporarily unavailable; the dashboard, source list, and trip logging
also need the Supabase project configured in `.env.local`.

## What it does

- **Compare** — enter two places and see the emissions for all five modes together.
  Values show trip grams, grams per passenger-kilometre, and equivalent car distance.
  The comparison also shows walking/cycling energy estimates, tree-absorption time
  equivalents, and a five-day commute plan.
- **Impact** — what everyone has avoided, by region and globally, broken down by
  transport mode.
- **Dashboard** — a world map shaded by transport emissions, plus any country's
  emissions trend since 1970 and its share of that country's total.
- **How we calculate this** — the formula, every emission factor with its source, and
  an honest list of what the numbers do not tell you.

## Stack

Vue 3 (Composition API) · Vite · Pinia · Vue Router · Supabase (Postgres) ·
Geoapify and OpenRouteService for Australian address search and routing.
Charts are rendered with SVG and CSS.

Supabase Edge Functions proxy geocoding and routing so provider keys stay server-side.
Trip totals are computed by a `SECURITY DEFINER` Postgres function.

## Deployment

The repository includes Vercel build, SPA rewrite, and asset cache configuration in
`vercel.json`. Configure the two `VITE_` environment variables in the deployment
environment.

> `VITE_` variables are compiled into the client bundle. Only the Supabase **anon**
> key belongs there; it is safe because row-level security constrains it.

### Install the Supabase CLI (Windows)

The CLI is a separate program; installing this project's npm dependencies does not
install a global `supabase` command. Install it once with [Scoop](https://scoop.sh):

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

Alternatively, install the CLI in this project with `npm install --save-dev supabase`
and prefix the commands below with `npx` (for example, `npx supabase login`).

### Deploy the provider functions

Log in and link the actual Supabase project before setting secrets or deploying:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set GEOAPIFY_API_KEY=your-key ORS_API_KEY=your-key
npx supabase functions deploy address-search
npx supabase functions deploy route-distance
```

Replace the project-ref and key placeholders with your own values. Do not put
provider keys in `.env.local` or any `VITE_` variable. Address search is Australia-only.
Geoapify geocodes addresses and returns WGS84 coordinates for OpenRouteService.
The address data-source attribution and Geoapify credit are shown with the addresses;
route attribution is shown with the comparison.

Forward geocoding runs as users type; Geoapify charges by request, so check its
current quotas and pricing before publishing. The functions accept the public
Supabase anon key, so protect the provider quota with appropriate rate limits.

## Privacy

A logged trip stores a distance, a transport mode, a country code and a state or
province. No accounts, no cookies, no tracking, and deliberately no addresses and no
coordinates: a home-to-work coordinate pair is close to unique, so storing it would
undo the anonymity the rest of the design depends on. A province holds millions of
people and cannot narrow to a person, which is why the line is drawn there and no
finer. Address queries and coordinates are sent to Geoapify and
OpenRouteService for lookup and routing, but are not saved by this app. Those providers
process requests under their own privacy policies.

## Project map

See [PROJECT-ARCHITECTURE.md](PROJECT-ARCHITECTURE.md) for the application,
provider, database, data-import and deployment architecture.
See [COMPONENT-MAP.md](COMPONENT-MAP.md) for the routes and feature-component layout.
The Learn page (`/learn`) explains the calculation and its limitations.

## Repository layout

```
supabase/    migrations, seed SQL, and provider Edge Functions
data/        human-editable reference CSVs
public/geo/  vendored country boundaries for the world map
src/lib/     pure logic — the calculation, geocoding, routing, country codes
src/stores/  Pinia stores
src/views/   one per route
src/components/compare/    journey input and emissions comparison
src/components/impact/     community impact views
src/components/dashboard/  country emissions visualisations
src/components/shared/     reusable controls
```

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Node.js unit tests |

## Attribution

Geoapify provides address search; OpenRouteService provides routes and returns
the route attribution displayed in the app. Emission factors and national emissions
data are credited on the app's Learn page.
