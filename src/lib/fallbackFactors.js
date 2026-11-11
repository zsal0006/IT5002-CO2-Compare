/**
 * Bundled copy of the emission factors, used when Supabase is unreachable or
 * not yet configured (NFR-7). Keep in step with
 * supabase/seed/0100_seed_sources_and_factors.sql — the database is the source
 * of truth; this is the lifeboat.
 */
export const FALLBACK_FACTORS = [
  { mode_key: 'walking',        mode_label: 'Walking',               category: 'active',           factor_g_per_pkm: 0,   is_baseline: false, display_order: 1 },
  { mode_key: 'cycling',        mode_label: 'Cycling',               category: 'active',           factor_g_per_pkm: 0,   is_baseline: false, display_order: 2 },
  { mode_key: 'train_national', mode_label: 'Train',         category: 'public_transport', factor_g_per_pkm: 35,  is_baseline: false, display_order: 7 },
  { mode_key: 'car_electric',   mode_label: 'Electric car',          category: 'car',              factor_g_per_pkm: 47,  is_baseline: false, display_order: 8 },
  { mode_key: 'bus_city',       mode_label: 'Bus',              category: 'public_transport', factor_g_per_pkm: 97,  is_baseline: false, display_order: 9 },
  { mode_key: 'car_average',    mode_label: 'Car (average)',         category: 'car',              factor_g_per_pkm: 170, is_baseline: true,  display_order: 12 },
]

/**
 * Fallback pump price, used only when `fuel_prices` cannot be read.
 * Australia is the default market, so this mirrors the ZZ row in
 * supabase/migrations/0002_fuel_prices.sql — AUD at the Australian price.
 */
export const FALLBACK_FUEL_PRICE = {
  country_code: 'ZZ',
  currency_code: 'AUD',
  price_per_litre: 1.95,
  fuel_label: 'Petrol (unleaded 91)',
  updated_on: null
}
