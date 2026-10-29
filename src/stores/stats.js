import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, supabaseConfigured } from '@/lib/supabase'

/** Aggregated savings logged by everyone, globally and per country (FR-14, FR-15). */
export const useStatsStore = defineStore('stats', () => {
  const global = ref(null)        // { trips, total_saved_kg, ... }
  const byCountry = ref([])       // [{ country_code, trips, total_saved_kg, ... }]
  const modePopularity = ref([])
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
      const [g, c, m] = await Promise.all([
        supabase.from('v_savings_global').select('*').single(),
        supabase.from('v_savings_by_country').select('*').order('total_saved_kg', { ascending: false }),
        supabase.from('v_mode_popularity').select('*').order('trips', { ascending: false })
      ])
      if (g.error) throw g.error
      global.value = g.data
      byCountry.value = c.data ?? []
      modePopularity.value = m.data ?? []
    } catch (err) {
      error.value = `Could not load community totals: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  function forCountry(code) {
    return byCountry.value.find((r) => r.country_code === code) ?? null
  }

  return { global, byCountry, modePopularity, loading, error, load, forCountry }
})
