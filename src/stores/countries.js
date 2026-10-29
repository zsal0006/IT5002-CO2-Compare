import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, supabaseConfigured } from '@/lib/supabase'

/**
 * National transport-sector emissions (FR-16 to FR-18). Series are cached by
 * country code so switching back and forth costs nothing.
 */
export const useCountriesStore = defineStore('countries', () => {
  const list = ref([])            // [{ country_code, country_name }]
  const series = ref({})          // { [code]: [{ year, transport_mt_co2e, ... }] }
  const loadingList = ref(false)
  const loadingSeries = ref(false)
  const snapshot = ref([])        // every country for one year, for the map (E5.3)
  const snapshotYear = ref(null)
  const loadingSnapshot = ref(false)
  const error = ref(null)

  async function loadList() {
    if (list.value.length || loadingList.value) return
    if (!supabaseConfigured) {
      error.value = 'The shared database is not configured, so country data is unavailable.'
      return
    }
    loadingList.value = true
    try {
      // One row per country: take the most recent year's row for each.
      const { data, error: err } = await supabase
        .from('country_transport_emissions')
        .select('country_code, country_name')
        .order('country_name')
      if (err) throw err

      const seen = new Set()
      list.value = (data ?? []).filter((r) => {
        if (seen.has(r.country_code)) return false
        seen.add(r.country_code)
        return true
      })
    } catch (err) {
      error.value = `Could not load the country list: ${err.message}`
    } finally {
      loadingList.value = false
    }
  }

  async function loadSeries(code) {
    if (!code || series.value[code]) return series.value[code]
    if (!supabaseConfigured) return []
    loadingSeries.value = true
    try {
      const { data, error: err } = await supabase.rpc('country_series', { p_country_code: code })
      if (err) throw err
      series.value = { ...series.value, [code]: data ?? [] }
      return data ?? []
    } catch (err) {
      error.value = `Could not load emissions for ${code}: ${err.message}`
      return []
    } finally {
      loadingSeries.value = false
    }
  }

  /**
   * One row per country for a single year — the choropleth's input (E5.3).
   * Defaults to the most recent year present in the dataset.
   */
  async function loadSnapshot(year = null) {
    if (!supabaseConfigured || loadingSnapshot.value) return snapshot.value
    if (snapshot.value.length && (year == null || year === snapshotYear.value)) {
      return snapshot.value
    }
    loadingSnapshot.value = true
    try {
      let target = year
      if (target == null) {
        const { data: maxRow, error: maxErr } = await supabase
          .from('country_transport_emissions')
          .select('year')
          .not('transport_mt_co2e', 'is', null)
          .order('year', { ascending: false })
          .limit(1)
          .single()
        if (maxErr) throw maxErr
        target = maxRow.year
      }

      const { data, error: err } = await supabase
        .from('country_transport_emissions')
        .select('country_code, country_name, transport_mt_co2e, total_mt_co2e, transport_share_pct')
        .eq('year', target)
      if (err) throw err

      snapshot.value = data ?? []
      snapshotYear.value = target
      return snapshot.value
    } catch (err) {
      error.value = `Could not load the world map data: ${err.message}`
      return []
    } finally {
      loadingSnapshot.value = false
    }
  }

  /** The most recent year with a transport figure, for the headline tiles. */
  function latest(code) {
    const rows = series.value[code]
    if (!rows?.length) return null
    return [...rows].reverse().find((r) => r.transport_mt_co2e != null) ?? null
  }

  return {
    list, series, snapshot, snapshotYear,
    loadingList, loadingSeries, loadingSnapshot, error,
    loadList, loadSeries, loadSnapshot, latest
  }
})
