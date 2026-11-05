import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { FALLBACK_FACTORS, FALLBACK_FUEL_PRICE } from '@/lib/fallbackFactors'

/**
 * Emission factors and their sources. Fetched once per session; the calculator
 * reads from here rather than hitting the network per calculation.
 */
export const useFactorsStore = defineStore('factors', () => {
  const factors = ref([])
  const sources = ref([])
  const fuelPrices = ref([])
  const loading = ref(false)
  const usingFallback = ref(false)
  const error = ref(null)

  const baseline = computed(() => factors.value.find((f) => f.is_baseline) ?? null)

  const byKey = computed(() =>
    Object.fromEntries(factors.value.map((f) => [f.mode_key, f]))
  )

  /** Pump price for a country, falling back to the global ZZ row. */
  function fuelPriceFor(countryCode) {
    const rows = fuelPrices.value
    if (!rows.length) return FALLBACK_FUEL_PRICE
    return (
      rows.find((r) => r.country_code === countryCode) ??
      rows.find((r) => r.country_code === 'ZZ') ??
      FALLBACK_FUEL_PRICE
    )
  }

  function useFallback(reason) {
    factors.value = FALLBACK_FACTORS
    fuelPrices.value = [FALLBACK_FUEL_PRICE]
    usingFallback.value = true
    error.value = reason
  }

  async function load() {
    if (factors.value.length || loading.value) return
    loading.value = true
    error.value = null

    if (!supabaseConfigured) {
      useFallback('Supabase is not configured; showing bundled factors.')
      loading.value = false
      return
    }

    try {
      const [factorRes, sourceRes, priceRes] = await Promise.all([
        supabase
          .from('emission_factors')
          .select('mode_key, mode_label, category, factor_g_per_pkm, is_baseline, display_order, source_id, notes')
          .eq('is_active', true)
          .order('display_order'),
        supabase.from('data_sources').select('*'),
        supabase.from('fuel_prices').select('*')
      ])

      if (factorRes.error) throw factorRes.error
      if (!factorRes.data?.length) throw new Error('No emission factors returned')

      factors.value = factorRes.data.map((f) => ({
        ...f,
        factor_g_per_pkm: Number(f.factor_g_per_pkm)
      }))
      sources.value = sourceRes.data ?? []
      // Missing prices are not fatal: the money card simply falls back to the
      // global figure rather than the whole calculator failing.
      fuelPrices.value = priceRes.data?.length ? priceRes.data : [FALLBACK_FUEL_PRICE]
      usingFallback.value = false
    } catch (err) {
      useFallback(`Could not reach the database (${err.message}); showing bundled factors.`)
    } finally {
      loading.value = false
    }
  }

  return {
    factors, sources, fuelPrices, loading, error, usingFallback,
    baseline, byKey, fuelPriceFor, load
  }
})
