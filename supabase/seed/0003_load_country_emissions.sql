-- CarbonRoute — loader for the GIZ country-level transport emissions dataset.
--
-- Sprint 1, task T-1.1. Two routes depending on how you got the file:
--
--   A) Supabase Studio  -> Table editor -> country_transport_emissions -> Import CSV
--      (easiest; map the columns in the UI, then run the normalisation block below)
--
--   B) psql with the local file:
--        \copy staging_country_emissions from 'data/country_transport_emissions.csv' csv header
--
-- Either way, land the raw file in the staging table first so a bad column
-- mapping cannot corrupt the real table.

create table if not exists public.staging_country_emissions (
  country_code      text,
  country_name      text,
  year              text,
  transport_mt_co2e text,
  total_mt_co2e     text
);

-- ---------------------------------------------------------------------------
-- After loading the staging table, run everything below.
-- ---------------------------------------------------------------------------

-- 1. Sanity-check what arrived before touching the real table.
--    Expect: ~190 countries x ~55 years. Investigate before continuing if not.
-- select count(*) as rows,
--        count(distinct country_code) as countries,
--        min(year::int) as first_year,
--        max(year::int) as last_year
-- from public.staging_country_emissions;

-- 2. Normalise and move across.
insert into public.country_transport_emissions
  (country_code, country_name, year, transport_mt_co2e, total_mt_co2e, source_id)
select
  upper(trim(s.country_code))::char(3),
  trim(s.country_name),
  trim(s.year)::smallint,
  nullif(trim(s.transport_mt_co2e), '')::numeric,
  nullif(trim(s.total_mt_co2e), '')::numeric,
  'giz-transport-2024'
from public.staging_country_emissions s
where s.country_code is not null
  and trim(s.country_code) <> ''
  and trim(s.year) ~ '^[0-9]{4}$'
  and trim(s.year)::int between 1970 and 2100
on conflict (country_code, year) do update set
  country_name      = excluded.country_name,
  transport_mt_co2e = excluded.transport_mt_co2e,
  total_mt_co2e     = excluded.total_mt_co2e,
  source_id         = excluded.source_id;

-- 3. Verify, then clear staging.
-- select country_name, year, transport_mt_co2e, total_mt_co2e, transport_share_pct
-- from public.country_transport_emissions
-- where country_code = 'GBR' and year in (1990, 2000, 2010, 2020, 2024)
-- order by year;

-- truncate public.staging_country_emissions;
