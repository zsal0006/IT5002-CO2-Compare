import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, supabaseConfigured } from '@/lib/supabase'

/**
 * Community totals: globally, by region and by mode (E4.1, E4.2).
 * The database aggregates trip_logs; the client only shapes the results.
 */
export const useStatsStore = defineStore('stats', () => {
  const global = ref(null)        // { trips, total_saved_kg, ... }
  const byRegion = ref([])        // [{ country_code, region_name, ... }]
  const byMode = ref([])          // [{ mode_key, mode_label, total_saved_kg, ... }]
  const byRegionMode = ref([])    // [{ country_code, region_name, mode_key, ... }]
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
      const [g, r, m, rm] = await Promise.all([
        supabase.from('v_savings_global').select('*').single(),
        supabase.from('v_savings_by_region').select('*').order('total_saved_kg', { ascending: false }),
        supabase.from('v_savings_by_mode').select('*').order('total_saved_kg', { ascending: false }),
        supabase.from('v_savings_by_region_mode').select('*').order('total_saved_kg', { ascending: false })
      ])
      if (g.error) throw g.error
      global.value = g.data
      byRegion.value = r.data ?? []
      byMode.value = m.data ?? []
      // Added by migration 0004. A project that has not applied it yet still
      // gets a working global view rather than a failed page, so this one error
      // is swallowed where the others are not.
      if (rm.error) {
        console.warn('[CO2 Compare] v_savings_by_region_mode unavailable:', rm.error.message)
        byRegionMode.value = []
      } else {
        byRegionMode.value = rm.data ?? []
      }
    } catch (err) {
      error.value = `Could not load community totals: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  /** Mode rows for one region, for the Impact page's scope switch. */
  function modesInRegion(code, region) {
    const name = region || 'Unknown region'
    return byRegionMode.value.filter(
      (row) => row.country_code === code && row.region_name === name
    )
  }

  return {
    global, byRegion, byMode, byRegionMode, loading, error,
    load, modesInRegion
  }
})
