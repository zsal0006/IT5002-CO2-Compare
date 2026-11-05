-- CO2 Compare — server-side journey comparison.
-- Apply after 0002_fuel_prices.sql. Idempotent: safe to re-run.
--
-- The brief states that the backend multiplies the distance by the emission
-- factors. This function is that step: the client sends a distance and gets
-- back kilograms per mode, computed in the database against the stored factors.
--
-- The client keeps an identical pure implementation in src/lib/emissions.js,
-- used only when this function cannot be reached (NFR-7). That is a documented
-- degraded mode, not a second source of truth: when Supabase answers, this
-- function's numbers are the ones shown.

create or replace function public.compare_journey(
  p_distance_km numeric,
  p_mode_keys   text[] default null
)
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
    from emission_factors f where f.is_baseline;

  if v_baseline is null then
    raise exception 'No baseline mode is flagged; savings cannot be computed.';
  end if;

  return query
  select
    f.mode_key,
    f.mode_label,
    f.category,
    f.factor_g_per_pkm,
    round(p_distance_km * f.factor_g_per_pkm / 1000.0, 4) as kg,
    -- Clamped at zero: the app measures avoided emissions, not a net ledger.
    round(greatest(0, p_distance_km * (v_baseline - f.factor_g_per_pkm) / 1000.0), 4)
      as saved_vs_baseline_kg,
    f.is_baseline
  from emission_factors f
  where f.is_active
    and (p_mode_keys is null or f.mode_key = any (p_mode_keys))
  order by kg asc, f.mode_label asc;
end;
$fn$;

comment on function public.compare_journey(numeric, text[]) is
  'Emissions per mode for a journey of p_distance_km, computed from the stored '
  'emission factors. Pass p_mode_keys to restrict to a subset, or null for all '
  'active modes. Results are ordered cleanest first.';

grant execute on function public.compare_journey(numeric, text[]) to anon, authenticated;
