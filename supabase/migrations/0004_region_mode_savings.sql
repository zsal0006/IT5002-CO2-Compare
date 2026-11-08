-- CO2 Compare — mode split within a region, for the Impact page (E4.1 + E4.2).
-- Apply after 0003_compare_journey.sql. Idempotent: safe to re-run.
--
-- WHY THIS VIEW EXISTS
--
-- `v_savings_by_mode` aggregates across everyone, and `v_savings_by_region`
-- across every mode. Neither answers "how do people in Victoria travel?",
-- which is what the Impact page asks the moment the reader narrows the scope
-- to one region.
--
-- It has to be a view rather than something the client works out, for the same
-- reason the other four are: `trip_logs` has RLS enabled with no policy, so the
-- anon key cannot read the rows to aggregate them. The database aggregates, the
-- client only draws. That is also what stops the totals being forged.
--
-- Unlike `v_savings_by_mode` this inner-joins the factors, so a mode nobody has
-- used in a region simply does not appear rather than appearing as a zero. A
-- leaderboard of unused modes is noise.

create or replace view public.v_savings_by_region_mode as
select
  t.country_code,
  coalesce(t.region_name, 'Unknown region')          as region_name,
  f.mode_key,
  f.mode_label,
  f.category,
  count(*)                                           as trips,
  round(sum(t.saved_g)   / 1000.0, 2)                as total_saved_kg,
  round(sum(t.emitted_g) / 1000.0, 2)                as total_emitted_kg,
  round(sum(t.distance_km), 2)                       as total_distance_km
from public.trip_logs t
join public.emission_factors f on f.mode_key = t.mode_key
group by
  t.country_code,
  coalesce(t.region_name, 'Unknown region'),
  f.mode_key,
  f.mode_label,
  f.category;

comment on view public.v_savings_by_region_mode is
  'Mode split within each region. Aggregate only — it exposes no individual '
  'trip, no coordinates and no timestamps, which is why anon may read it while '
  'trip_logs itself stays unreadable.';

grant select on public.v_savings_by_region_mode to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The dashboard's country list.
--
-- `country_transport_emissions` holds one row per country PER YEAR — about
-- 12,200 of them. The dashboard only wants the ~222 distinct countries for a
-- dropdown, and PostgREST cannot express SELECT DISTINCT, so without this view
-- the client downloads every row of the table and de-duplicates them in the
-- browser: a megabyte-plus of JSON to populate a <select>, and silently
-- truncated to whatever row limit the project happens to have set.
--
-- The name comes from the most recent year that has one, so a country whose
-- name changed in the record reads by its current name.
-- ---------------------------------------------------------------------------
create or replace view public.v_countries as
select distinct on (country_code)
  country_code,
  country_name,
  year as latest_year
from public.country_transport_emissions
where transport_mt_co2e is not null
order by country_code, year desc;

comment on view public.v_countries is
  'One row per country in the emissions dataset, for the dashboard selector.';

grant select on public.v_countries to anon, authenticated;

-- Verify: the first must return rows, a direct read of trip_logs must not.
-- select * from public.v_savings_by_region_mode order by total_saved_kg desc;
-- select count(*) from public.v_countries;   -- expect ~222
