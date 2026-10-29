import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, supabaseConfigured } from '@/lib/supabase'

/**
 * Community totals: globally, by country, by region and by mode (E4.1, E4.2).
 * All four are database views over trip_logs — the client never aggregates.
 */
export const useStatsStore = defineStore('stats', () => {
  const global = ref(null)        // { trips, total_saved_kg, ... }
  const byCountry = ref([])       // [{ country_code, trips, total_saved_kg, ... }]
  const byRegion = ref([])        // [{ country_code, region_name, ... }]
  const byMode = ref([])          // [{ mode_key, mode_label, total_saved_kg, ... }]
  const loading = ref(false)
  const error = ref(null)

  async function load({ force = false } = {}) {
    if (!force && global.value) return
    if (!supabaseConfigured) {
      error.value = 'The shared database is not configured, so community totals are unavailable.'
      return
    }
    loading.value = true
    error.value = null
    try {
      const [g, c, r, m] = await Promise.all([
        supabase.from('v_savings_global').select('*').single(),
        supabase.from('v_savings_by_country').select('*').order('total_saved_kg', { ascending: false }),
        supabase.from('v_savings_by_region').select('*').order('total_saved_kg', { ascending: false }),
        supabase.from('v_savings_by_mode').select('*').order('total_saved_kg', { ascending: false })
      ])
      if (g.error) throw g.error
      global.value = g.data
      byCountry.value = c.data ?? []
      byRegion.value = r.data ?? []
      byMode.value = m.data ?? []
    } catch (err) {
      error.value = `Could not load community totals: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  function forCountry(code) {
    return byCountry.value.find((row) => row.country_code === code) ?? null
  }

  /** @param {string} code alpha-2 @param {string|null} region */
  function forRegion(code, region) {
    const name = region || 'Unknown region'
    return byRegion.value.find((row) => row.country_code === code && row.region_name === name) ?? null
  }

  /** Regions within one country, for the Impact page selector. */
  function regionsIn(code) {
    return byRegion.value.filter((row) => row.country_code === code)
  }

  return {
    global, byCountry, byRegion, byMode, loading, error,
    load, forCountry, forRegion, regionsIn
  }
})
