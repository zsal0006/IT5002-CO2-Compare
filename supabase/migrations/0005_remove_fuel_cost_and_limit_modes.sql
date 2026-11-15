-- Remove the fuel-price feature and restrict comparisons to the five supported modes.

drop table if exists public.fuel_prices;
delete from public.data_sources where source_id = 'pump-prices';

update public.emission_factors
set
  is_active = mode_key in ('cycling', 'walking', 'bus_city', 'train_national', 'car_average'),
  mode_label = case mode_key
    when 'cycling' then 'Cycling'
    when 'walking' then 'Walking'
    when 'bus_city' then 'Bus'
    when 'train_national' then 'Train'
    when 'car_average' then 'Car'
    else mode_label
  end,
  display_order = case mode_key
    when 'cycling' then 1
    when 'walking' then 2
    when 'bus_city' then 3
    when 'train_national' then 4
    when 'car_average' then 5
    else display_order
  end;

update public.emission_factors
set source_id = null
where source_id = 'climatecouncil-2017' and not is_active;

delete from public.data_sources
where source_id = 'climatecouncil-2017'
  and not exists (
    select 1 from public.emission_factors where source_id = 'climatecouncil-2017'
  )
  and not exists (
    select 1 from public.country_transport_emissions where source_id = 'climatecouncil-2017'
  );

drop function if exists public.compare_journey(numeric, text[]);

create or replace function public.compare_journey(p_distance_km numeric)
returns table (
  mode_key            text,
  mode_label          text,
  category            text,
  factor_g_per_pkm    numeric,
  kg                  numeric,
  saved_vs_baseline_kg numeric,
  is_baseline         boolean
)
language plpgsql
stable
set search_path = public
as $fn$
declare
  v_baseline numeric;
begin
  if p_distance_km is null or p_distance_km <= 0 or p_distance_km > 20000 then
    raise exception 'distance_km must be between 0 and 20000, got %', p_distance_km
      using errcode = '22003';
  end if;

  select f.factor_g_per_pkm into v_baseline
    from public.emission_factors f
    where f.mode_key = 'car_average' and f.is_active;

  if v_baseline is null then
    raise exception 'Car baseline factor is missing or inactive.';
  end if;

  return query
  select
    f.mode_key,
    f.mode_label,
    f.category,
    f.factor_g_per_pkm,
    round(p_distance_km * f.factor_g_per_pkm / 1000.0, 4) as kg,
    round(greatest(0, p_distance_km * (v_baseline - f.factor_g_per_pkm) / 1000.0), 4)
      as saved_vs_baseline_kg,
    f.is_baseline
  from public.emission_factors f
  where f.is_active
    and f.mode_key in ('cycling', 'walking', 'bus_city', 'train_national', 'car_average')
  order by kg asc, f.mode_label asc;
end;
$fn$;

comment on function public.compare_journey(numeric) is
  'Compare a journey against the car baseline using the five supported modes.';

grant execute on function public.compare_journey(numeric) to anon, authenticated;

create or replace view public.v_savings_by_region_mode as
select
  t.country_code,
  coalesce(t.region_name, 'Unknown region') as region_name,
  f.mode_key,
  f.mode_label,
  f.category,
  count(*) as trips,
  round(sum(t.saved_g) / 1000.0, 2) as total_saved_kg,
  round(sum(t.emitted_g) / 1000.0, 2) as total_emitted_kg,
  round(sum(t.distance_km), 2) as total_distance_km
from public.trip_logs t
join public.emission_factors f on f.mode_key = t.mode_key
where f.is_active
group by t.country_code, coalesce(t.region_name, 'Unknown region'), f.mode_key, f.mode_label, f.category;

comment on view public.v_savings_by_region_mode is
  'Mode totals within each region, for active transport modes only.';
