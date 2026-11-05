-- CO2 Compare — fuel prices, for the "money saved" co-benefit.
-- Apply after 0001_init.sql. Idempotent: safe to re-run.
--
-- Pump prices move constantly and vary enormously between countries — a litre
-- costs roughly ten times more in the UK than in Kuwait. A single hard-coded
-- figure would be wrong almost everywhere, so prices live here, keyed by
-- country, each stamped with the date it was recorded.

create table if not exists public.fuel_prices (
  country_code    char(2) primary key,
  currency_code   char(3) not null,
  price_per_litre numeric(10,4) not null check (price_per_litre > 0),
  fuel_label      text not null default 'Petrol (95)',
  updated_on      date not null default current_date,
  source_id       text references public.data_sources(source_id)
);

comment on table public.fuel_prices is
  'Pump price per litre by country. ZZ is the global fallback. Prices are '
  'indicative and stamped with updated_on; the UI shows that date rather than '
  'implying the figure is live.';

alter table public.fuel_prices enable row level security;

drop policy if exists read_fuel_prices on public.fuel_prices;
create policy read_fuel_prices on public.fuel_prices
  for select to anon, authenticated using (true);

insert into public.data_sources (source_id, title, publisher, url, licence, retrieved_on)
values (
  'pump-prices',
  'Indicative retail petrol prices by country',
  'Team-compiled from national regulators and GlobalPetrolPrices',
  'https://www.globalpetrolprices.com/gasoline_prices/',
  'Indicative, for comparison only',
  current_date
)
on conflict (source_id) do update set retrieved_on = excluded.retrieved_on;

-- INDICATIVE VALUES — Sprint 1 task T-1.9 replaces each with a checked figure
-- from the national regulator and sets updated_on accordingly.
insert into public.fuel_prices (country_code, currency_code, price_per_litre, fuel_label, source_id) values
  ('BH', 'BHD', 0.2000, 'Petrol (Special 95)', 'pump-prices'),
  ('SA', 'SAR', 2.3300, 'Petrol (95)',          'pump-prices'),
  ('AE', 'AED', 2.9000, 'Petrol (Special 95)',  'pump-prices'),
  ('KW', 'KWD', 0.1050, 'Petrol (Premium 95)',  'pump-prices'),
  ('QA', 'QAR', 2.1000, 'Petrol (Premium)',     'pump-prices'),
  ('OM', 'OMR', 0.2300, 'Petrol (M95)',         'pump-prices'),
  ('GB', 'GBP', 1.3500, 'Petrol (unleaded)',    'pump-prices'),
  ('US', 'USD', 0.8500, 'Gasoline (regular)',   'pump-prices'),
  ('AU', 'AUD', 1.9500, 'Petrol (unleaded 91)', 'pump-prices'),
  ('DE', 'EUR', 1.7500, 'Petrol (E10)',         'pump-prices'),
  ('FR', 'EUR', 1.7500, 'Petrol (SP95)',        'pump-prices'),
  ('IN', 'INR', 105.0000, 'Petrol',             'pump-prices'),
  -- Global fallback, used when the start country has no row of its own.
  ('ZZ', 'USD', 1.2000, 'Petrol (95)',          'pump-prices')
on conflict (country_code) do update set
  currency_code   = excluded.currency_code,
  price_per_litre = excluded.price_per_litre,
  fuel_label      = excluded.fuel_label,
  updated_on      = excluded.updated_on,
  source_id       = excluded.source_id;

-- A global fallback must always exist, or the money card silently disappears
-- for every country not listed above.
do $guard$
begin
  if not exists (select 1 from public.fuel_prices where country_code = 'ZZ') then
    raise exception 'No ZZ fallback row in fuel_prices; the money co-benefit would vanish outside the listed countries.';
  end if;
end;
$guard$;

grant select on public.fuel_prices to anon, authenticated;
