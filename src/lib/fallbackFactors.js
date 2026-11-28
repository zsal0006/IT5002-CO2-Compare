/**
 * Bundled emission factors used when Supabase is unreachable or not configured.
 * Keep these five modes in step with the database seed.
 */
export const FALLBACK_FACTORS = [
  { mode_key: 'car_average',    mode_label: 'Car',     category: 'car',              factor_g_per_pkm: 170, is_baseline: true,  display_order: 5 },
  { mode_key: 'train_national', mode_label: 'Train',   category: 'public_transport', factor_g_per_pkm: 35,  is_baseline: false, display_order: 4 },
  { mode_key: 'bus_city',       mode_label: 'Bus',     category: 'public_transport', factor_g_per_pkm: 97,  is_baseline: false, display_order: 3 },
  { mode_key: 'cycling',        mode_label: 'Cycling', category: 'active',           factor_g_per_pkm: 0,   is_baseline: false, display_order: 1 },
  { mode_key: 'walking',        mode_label: 'Walking', category: 'active',           factor_g_per_pkm: 0,   is_baseline: false, display_order: 2 }
]
