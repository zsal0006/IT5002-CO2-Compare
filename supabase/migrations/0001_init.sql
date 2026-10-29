-- CO2 Compare — initial schema
-- Apply in the Supabase SQL editor, or: supabase db push
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- data_sources
create table if not exists public.data_sources (
  source_id    text primary key,
  title        text not null,
  publisher    text not null,
  url          text not null,
  licence      text not null,
  retrieved_on date not null default current_date
);

-- ------------------------------------------------------------ emission_factors
-- Unit is grams CO2e per PASSENGER-kilometre. Not per vehicle-kilometre.
create table if not exists public.emission_factors (
  mode_key         text primary key,
  mode_label       text    not null,
  category         text    not null
                   check (category in ('car','public_transport','active','other')),
  factor_g_per_pkm numeric(8,2) not null check (factor_g_per_pkm >= 0),
  is_baseline      boolean not null default false,
  display_order    smallint not null default 100,
  is_active        boolean not null default true,
  source_id        text references public.data_sources(source_id),
  notes            text
);

-- exactly one baseline mode may exist
create unique index if not exists emission_factors_one_baseline
  on public.emission_factors (is_baseline) where is_baseline;

-- ------------------------------------------- country_transport_emissions (GIZ)
create table if not exists public.country_transport_emissions (
  country_code        char(3) not null,
  country_name        text    not null,
  year                smallint not null check (year between 1970 and 2100),
  transport_mt_co2e   numeric(12,3),
  total_mt_co2e       numeric(12,3),
  transport_share_pct numeric(5,2)
    generated always as (
      case when total_mt_co2e is null or total_mt_co2e = 0 then null
           else round((transport_mt_co2e / total_mt_co2e) * 100, 2)
      end
    ) stored,
  source_id           text references public.data_sources(source_id),
  primary key (country_code, year)
);

create index if not exists cte_country_idx on public.country_transport_emissions (country_code);
create index if not exists cte_year_idx    on public.country_transport_emissions (year);

-- -------------------------------------------------------------------- trip_logs
-- Append-only and deliberately non-identifying: distance, mode, country and
-- sub-national region only (E6.2). No coordinates, no addresses, no IP, no user
-- agent, no session id. A state or province holds millions of people, so it
-- cannot re-identify a traveller; a city or a coordinate pair could, which is
-- why neither is stored.
create table if not exists public.trip_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  distance_km  numeric(8,2) not null check (distance_km > 0 and distance_km <= 20000),
  mode_key     text not null references public.emission_factors(mode_key),
  country_code char(2) not null default 'ZZ',
  region_name  text,                      -- state / province, null when unknown
  emitted_g    numeric(12,2) not null check (emitted_g >= 0),
  saved_g      numeric(12,2) not null check (saved_g >= 0)
);

create index if not exists trip_logs_country_idx on public.trip_logs (country_code);
create index if not exists trip_logs_region_idx  on public.trip_logs (country_code, region_name);
create index if not exists trip_logs_created_idx on public.trip_logs (created_at desc);

-- ------------------------------------------------------------------------ views
create or replace view public.v_savings_by_country as
select
  t.country_code,
  count(*)                               as trips,
  round(sum(t.saved_g)    / 1000.0, 2)   as total_saved_kg,
  round(sum(t.emitted_g)  / 1000.0, 2)   as total_emitted_kg,
  round(sum(t.distance_km), 2)           as total_distance_km
from public.trip_logs t
group by t.country_code;

-- E4.1: "total CO2 saved in my region".
create or replace view public.v_savings_by_region as
select
  t.country_code,
  coalesce(t.region_name, 'Unknown region') as region_name,
  count(*)                               as trips,
  round(sum(t.saved_g)   / 1000.0, 2)    as total_saved_kg,
  round(sum(t.emitted_g) / 1000.0, 2)    as total_emitted_kg,
  round(sum(t.distance_km), 2)           as total_distance_km
from public.trip_logs t
group by t.country_code, coalesce(t.region_name, 'Unknown region');

create or replace view public.v_savings_global as
select
  count(*)                                        as trips,
  round(coalesce(sum(t.saved_g),0)   / 1000.0, 2) as total_saved_kg,
  round(coalesce(sum(t.emitted_g),0) / 1000.0, 2) as total_emitted_kg,
  round(coalesce(sum(t.distance_km),0), 2)        as total_distance_km,
  count(distinct t.country_code)                  as countries
from public.trip_logs t;

-- E4.2: "savings broken down by transport mode". Carries kg saved, not just a
-- trip count -- a mode chosen rarely for long journeys can out-save a mode
-- chosen often for short ones.
create or replace view public.v_savings_by_mode as
select
  f.mode_key,
  f.mode_label,
  f.category,
  count(t.id)                                       as trips,
  round(coalesce(sum(t.saved_g), 0)   / 1000.0, 2)  as total_saved_kg,
  round(coalesce(sum(t.emitted_g), 0) / 1000.0, 2)  as total_emitted_kg,
  round(coalesce(sum(t.distance_km), 0), 2)         as total_distance_km,
  round(100.0 * count(t.id) / nullif((select count(*) from public.trip_logs), 0), 1) as share_of_trips_pct
from public.emission_factors f
left join public.trip_logs t on t.mode_key = f.mode_key
where f.is_active
group by f.mode_key, f.mode_label, f.category;

-- -------------------------------------------------------------------- functions

-- The only write path exposed to the browser. Recomputes the saving from stored
-- factors so a client cannot inflate the leaderboard.
create or replace function public.log_trip(
  p_distance_km  numeric,
  p_mode_key     text,
  p_country_code text default 'ZZ',
  p_region_name  text default null
) returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_factor   numeric;
  v_baseline numeric;
  v_country  char(2);
  v_region   text;
  v_emitted  numeric;
  v_saved    numeric;
  v_id       uuid;
begin
  if p_distance_km is null or p_distance_km <= 0 or p_distance_km > 20000 then
    raise exception 'distance_km must be between 0 and 20000, got %', p_distance_km
      using errcode = '22003';
  end if;

  select factor_g_per_pkm into v_factor
    from emission_factors where mode_key = p_mode_key and is_active;
  if v_factor is null then
    raise exception 'unknown or inactive mode_key: %', p_mode_key using errcode = '23503';
  end if;

  select factor_g_per_pkm into v_baseline
    from emission_factors where is_baseline;

  v_country := upper(coalesce(nullif(trim(p_country_code), ''), 'ZZ'));
  if v_country !~ '^[A-Z]{2}$' then
    v_country := 'ZZ';
  end if;

  -- Trim and cap the region label. It is free text from the geocoder, so it is
  -- length-limited and never interpolated anywhere it could be executed.
  v_region := nullif(left(trim(coalesce(p_region_name, '')), 80), '');

  v_emitted := round(p_distance_km * v_factor, 2);
  v_saved   := round(greatest(0, p_distance_km * (v_baseline - v_factor)), 2);

  insert into trip_logs (distance_km, mode_key, country_code, region_name, emitted_g, saved_g)
  values (round(p_distance_km, 2), p_mode_key, v_country, v_region, v_emitted, v_saved)
  returning id into v_id;

  return json_build_object(
    'trip_id',          v_id,
    'emitted_kg',       round(v_emitted / 1000.0, 3),
    'saved_kg',         round(v_saved   / 1000.0, 3),
    'country_code',     v_country,
    'region_name',      v_region,
    'country_total_kg', (select total_saved_kg from v_savings_by_country where country_code = v_country),
    'region_total_kg',  (select total_saved_kg from v_savings_by_region
                          where country_code = v_country
                            and region_name = coalesce(v_region, 'Unknown region')),
    'global_total_kg',  (select total_saved_kg from v_savings_global)
  );
end;
$fn$;

-- Convenience read for the dashboard time series.
create or replace function public.country_series(p_country_code text)
returns table (
  year smallint,
  transport_mt_co2e numeric,
  total_mt_co2e numeric,
  transport_share_pct numeric
)
language sql
stable
set search_path = public
as $fn$
  select year, transport_mt_co2e, total_mt_co2e, transport_share_pct
  from country_transport_emissions
  where country_code = upper(p_country_code)
  order by year;
$fn$;

-- ------------------------------------------------------------------------- RLS
alter table public.data_sources                enable row level security;
alter table public.emission_factors            enable row level security;
alter table public.country_transport_emissions enable row level security;
alter table public.trip_logs                   enable row level security;

drop policy if exists read_sources on public.data_sources;
create policy read_sources on public.data_sources
  for select to anon, authenticated using (true);

drop policy if exists read_active_factors on public.emission_factors;
create policy read_active_factors on public.emission_factors
  for select to anon, authenticated using (is_active);

drop policy if exists read_country_emissions on public.country_transport_emissions;
create policy read_country_emissions on public.country_transport_emissions
  for select to anon, authenticated using (true);

-- No policy on trip_logs: with RLS enabled and no policy, anon can neither read
-- nor write it directly. log_trip() is SECURITY DEFINER and bypasses this.

grant select on public.v_savings_by_country, public.v_savings_by_region,
                public.v_savings_global,     public.v_savings_by_mode
             to anon, authenticated;
grant execute on function public.log_trip(numeric, text, text, text) to anon, authenticated;
grant execute on function public.country_series(text)            to anon, authenticated;
