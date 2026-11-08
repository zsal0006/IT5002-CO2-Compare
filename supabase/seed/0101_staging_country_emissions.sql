-- CO2 Compare — staging table for the GIZ country emissions dataset.
-- Sprint 1, task T-1.1. Run this FIRST, before importing the CSV.
--
-- WHY THIS IS A SEPARATE FILE
--
-- The load is three steps with a manual one in the middle:
--
--   1. this file          -> create the empty staging table
--   2. Supabase Studio    -> Table editor -> staging_country_emissions
--                            -> Import data from CSV
--   3. 0102_load_country_emissions.sql -> normalise and move across
--
-- Creating the table and reading from it cannot live in one script, because
-- between them a human has to upload a file. They used to, and running that
-- script straight through created an empty table and inserted nothing from it,
-- silently and successfully.
--
-- WHY STAGE AT ALL
--
-- Every column here is TEXT. The real table has a char(3) country code, a
-- smallint year and numeric measures, plus a generated transport_share_pct. If
-- the CSV arrives with a bad column mapping or a stray header row, we want it
-- to land somewhere harmless and be caught by the checks in 0102 — not to be
-- rejected halfway through a partial write into the table the dashboard reads.

create table if not exists public.staging_country_emissions (
  country_code      text,
  country_name      text,
  year              text,
  transport_mt_co2e text,
  total_mt_co2e     text
);

comment on table public.staging_country_emissions is
  'Scratch landing area for the GIZ CSV. Everything is text until 0102 casts '
  'it. Safe to truncate at any time; nothing reads from it but the loader.';

-- Staging holds no personal data and nothing the app reads, but RLS is enabled
-- with no policy so the anon key cannot see or write it either way.
alter table public.staging_country_emissions enable row level security;

select 'Staging table ready. Now import data/country_transport_emissions.csv '
       'into staging_country_emissions, then run 0102.' as next_step;
