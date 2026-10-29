/**
 * Bundled copy of the emission factors, used when Supabase is unreachable or
 * not yet configured (NFR-7). Keep in step with
 * supabase/seed/0002_seed_sources_and_factors.sql — the database is the source
 * of truth; this is the lifeboat.
 */
export const FALLBACK_FACTORS = [
  { mode_key: 'walking',        mode_label: 'Walking',               category: 'active',           factor_g_per_pkm: 0,   is_baseline: false, display_order: 1 },
  { mode_key: 'cycling',        mode_label: 'Cycling',               category: 'active',           factor_g_per_pkm: 0,   is_baseline: false, display_order: 2 },
  { mode_key: 'e_scooter',      mode_label: 'E-scooter',             category: 'other',            factor_g_per_pkm: 20,  is_baseline: false, display_order: 3 },
  { mode_key: 'coach',          mode_label: 'Coach',                 category: 'public_transport', factor_g_per_pkm: 27,  is_baseline: false, display_order: 4 },
  { mode_key: 'train_metro',    mode_label: 'Metro / underground',   category: 'public_transport', factor_g_per_pkm: 28,  is_baseline: false, display_order: 5 },
  { mode_key: 'tram',           mode_label: 'Tram / light rail',     category: 'public_transport', factor_g_per_pkm: 29,  is_baseline: false, display_order: 6 },
  { mode_key: 'train_national', mode_label: 'National rail',         category: 'public_transport', factor_g_per_pkm: 35,  is_baseline: false, display_order: 7 },
  { mode_key: 'car_electric',   mode_label: 'Electric car',          category: 'car',              factor_g_per_pkm: 47,  is_baseline: false, display_order: 8 },
  { mode_key: 'bus_city',       mode_label: 'City bus',              category: 'public_transport', factor_g_per_pkm: 97,  is_baseline: false, display_order: 9 },
  { mode_key: 'motorbike',      mode_label: 'Motorbike',             category: 'other',            factor_g_per_pkm: 103, is_baseline: false, display_order: 10 },
  { mode_key: 'ferry',          mode_label: 'Ferry (foot passenger)',category: 'other',            factor_g_per_pkm: 113, is_baseline: false, display_order: 11 },
  { mode_key: 'car_average',    mode_label: 'Car (average)',         category: 'car',              factor_g_per_pkm: 170, is_baseline: true,  display_order: 12 },
  { mode_key: 'car_petrol',     mode_label: 'Petrol car',            category: 'car',              factor_g_per_pkm: 170, is_baseline: false, display_order: 13 },
  { mode_key: 'car_diesel',     mode_label: 'Diesel car',            category: 'car',              factor_g_per_pkm: 171, is_baseline: false, display_order: 14 }
]
