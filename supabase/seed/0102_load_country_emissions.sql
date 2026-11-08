-- CO2 Compare — move the GIZ dataset from staging into the real table.
-- Sprint 1, task T-1.1. Run AFTER 0101 and after importing the CSV.
--
-- Safe to re-run: the insert upserts on (country_code, year), so a second run
-- refreshes rather than duplicates.
--
-- Expect about 12,195 rows across 222 countries, 1970–2024.

-- ---------------------------------------------------------------------------
-- 1. Refuse to run against an empty or obviously wrong staging table.
--
--    Without this, a forgotten CSV import makes the whole script succeed and
--    load nothing, which looks identical to success until the dashboard is
--    blank and nobody knows which step failed.
-- ---------------------------------------------------------------------------
do $guard$
declare
  n_rows      bigint;
  n_countries bigint;
  n_bad_year  bigint;
begin
  select count(*), count(distinct country_code)
    into n_rows, n_countries
  from public.staging_country_emissions;

  if n_rows = 0 then
    raise exception
      'staging_country_emissions is empty. Import data/country_transport_emissions.csv '
      'into it first (Table editor -> staging_country_emissions -> Import data from CSV).';
  end if;

  if n_countries < 50 then
    raise exception
      'Only % distinct country codes in staging — expected around 222. '
      'The column mapping is probably wrong; check that country_code really '
      'holds the ISO3 code.', n_countries;
  end if;

  select count(*) into n_bad_year
  from public.staging_country_emissions
  where trim(coalesce(year, '')) !~ '^[0-9]{4}$';

  if n_bad_year > n_rows / 10 then
    raise exception
      '% of % staging rows have no four-digit year. The columns are probably '
      'mapped in the wrong order.', n_bad_year, n_rows;
  end if;

  raise notice 'Staging looks sane: % rows, % countries.', n_rows, n_countries;
end;
$guard$;

-- ---------------------------------------------------------------------------
-- 2. Normalise and move across.
-- ---------------------------------------------------------------------------
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
  and trim(s.country_code) ~ '^[A-Za-z]{3}$'   -- drops aggregates like EU27
  and trim(s.year) ~ '^[0-9]{4}$'
  and trim(s.year)::int between 1970 and 2100
on conflict (country_code, year) do update set
  country_name      = excluded.country_name,
  transport_mt_co2e = excluded.transport_mt_co2e,
  total_mt_co2e     = excluded.total_mt_co2e,
  source_id         = excluded.source_id;

-- ---------------------------------------------------------------------------
-- 3. Remove rows that should never have been countries.
--
--    An upsert refreshes and inserts; it never DELETES. So a code that an
--    earlier version of the prepare script let through stays in the table for
--    good, no matter how many times this file is re-run against a corrected
--    CSV. That is exactly what happened with SEA and AIR.
--
--    These two are EDGAR's international shipping and aviation totals. They
--    pass the three-letter ISO test but belong to no country: on 2024 figures
--    SEA alone would rank third in the world, above India, on a page headed
--    "transport emissions by country". scripts/prepare-country-emissions.mjs
--    now excludes them at source; this clears any already loaded.
-- ---------------------------------------------------------------------------
delete from public.country_transport_emissions
where country_code in ('SEA', 'AIR');

-- ---------------------------------------------------------------------------
-- 4. Verify. Read these before clearing staging.
-- ---------------------------------------------------------------------------
select count(*) as rows,
       count(distinct country_code) as countries,
       min(year) as first_year,
       max(year) as last_year
from public.country_transport_emissions;

-- Australia and Austria must be different countries. They share the first two
-- letters of their ISO3 codes, which is exactly the mix-up lib/iso.js exists
-- to prevent on the client side.
select country_code, country_name, year,
       transport_mt_co2e, total_mt_co2e, transport_share_pct
from public.country_transport_emissions
where country_code in ('AUS', 'AUT', 'BHR')
  and year = 2020
order by country_code;
-- Expect roughly:
--   AUS  Australia   92.2  579.5  15.9%
--   AUT  Austria     21.9   77.0  28.5%
--   BHR  Bahrain      3.3   63.2   5.3%

-- ---------------------------------------------------------------------------
-- 5. Clear staging once the figures above look right.
-- ---------------------------------------------------------------------------
-- truncate public.staging_country_emissions;
