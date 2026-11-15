-- CO2 Compare — seed: data sources and emission factors
-- Idempotent. Re-run after editing data/emission_factors.csv.
--
-- UNIT: grams CO2e per PASSENGER-kilometre.
-- The Kaggle vehicle dataset is per VEHICLE-kilometre — divide by occupancy
-- (1.6 for private cars) before putting a value here.

insert into public.data_sources (source_id, title, publisher, url, licence, retrieved_on) values
  ('desnz-2024',
   'UK Government GHG Conversion Factors for Company Reporting',
   'UK Department for Energy Security and Net Zero',
   'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
   'Open Government Licence v3.0', current_date),
  ('kaggle-vehicle-co2',
   'Vehicle CO2 Emissions Dataset',
   'brsahan (Kaggle)',
   'https://www.kaggle.com/datasets/brsahan/vehicle-co2-emissions-dataset',
   'See dataset page', current_date),
  ('giz-transport-2024',
   'Country-level yearly GHG emissions, transport sector, 1970-2024',
   'GIZ / transport-data.org',
   'https://portal.transport-data.org/@giz/country-level-yearly-ghg-emissions-transport-sector-1970-2024',
   'CC BY 4.0', current_date)
on conflict (source_id) do update set
  title = excluded.title, publisher = excluded.publisher, url = excluded.url,
  licence = excluded.licence, retrieved_on = excluded.retrieved_on;

-- Clear the baseline flag first so the partial unique index cannot collide
-- while the new values are being written.
update public.emission_factors set is_baseline = false where is_baseline;

insert into public.emission_factors
  (mode_key, mode_label, category, factor_g_per_pkm, is_baseline, display_order, source_id, notes) values
  ('cycling',        'Cycling', 'active',           0,   false, 1, 'desnz-2024',         'Zero on an operational basis. Bicycle manufacture is out of scope.'),
  ('walking',        'Walking', 'active',           0,   false, 2, 'desnz-2024',         'Zero on an operational basis. Lifecycle food-energy effects are out of scope.'),
  ('bus_city',       'Bus',     'public_transport', 97,  false, 3, 'desnz-2024',         'Average load factor; varies widely by time of day.'),
  ('train_national', 'Train',   'public_transport', 35,  false, 4, 'desnz-2024',         'Average load factor.'),
  ('car_average',    'Car',     'car',              170, true,  5, 'kaggle-vehicle-co2', 'Savings baseline. Fleet average, 1.6 occupants.')
on conflict (mode_key) do update set
  mode_label       = excluded.mode_label,
  category         = excluded.category,
  factor_g_per_pkm = excluded.factor_g_per_pkm,
  is_baseline      = excluded.is_baseline,
  display_order    = excluded.display_order,
  source_id        = excluded.source_id,
  notes            = excluded.notes,
  is_active        = true;

-- Retain historical factor rows referenced by trip logs, but stop offering
-- modes outside the supported five to calculations and community summaries.
update public.emission_factors
set is_active = mode_key in ('cycling', 'walking', 'bus_city', 'train_national', 'car_average');

-- Guard rail against loading per-vehicle values as per-passenger values.
do $guard$
begin
  if exists (select 1 from public.emission_factors
             where category = 'car' and factor_g_per_pkm > 400) then
    raise exception
      'A car factor exceeds 400 g/passenger-km. Did you load per-VEHICLE-km values without dividing by occupancy?';
  end if;
  if not exists (select 1 from public.emission_factors where is_baseline) then
    raise exception 'No baseline mode is flagged; savings cannot be computed.';
  end if;
end;
$guard$;
