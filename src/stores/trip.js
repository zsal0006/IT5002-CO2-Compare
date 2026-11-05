import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { routeDistance } from '@/lib/routing'
import { compare, HEADLINE_MODES } from '@/lib/emissions'
import { useFactorsStore } from '@/stores/factors'
import { supabase, supabaseConfigured } from '@/lib/supabase'

/**
 * The current journey: the two confirmed places, the distance, the comparison,
 * and the logging action. Holds no PII — only places the user typed themselves,
 * and never persisted beyond the tab.
 */
export const useTripStore = defineStore('trip', () => {
  const origin = ref(null)       // Place | null
  const destination = ref(null)  // Place | null
  const returnTrip = ref(false)
  const carMode = ref('car_average')

  const distanceKm = ref(null)
  const approximate = ref(false)
  const geometry = ref(null)
  const durationMin = ref(null)

  const calculating = ref(false)
  const error = ref(null)

  // Rows from compare_journey(), and the distance they were computed for. The
  // distance is tracked so a return-trip toggle does not silently show figures
  // for the previous distance while the refetch is in flight.
  const serverModes = ref([])
  const serverKm = ref(null)
  const usingServerCompare = ref(false)

  const logging = ref(false)
  const lastLog = ref(null)      // { modeKey, savedKg, emittedKg }
  const sessionSavedKg = ref(0)  // session only; cleared when the tab closes

  const ready = computed(() => Boolean(origin.value && destination.value))

  /** Distance actually used in the calculation, doubled for a return trip. */
  const effectiveKm = computed(() =>
    distanceKm.value == null ? null : distanceKm.value * (returnTrip.value ? 2 : 1)
  )

  /** The five headline modes, with the chosen car sub-type swapped in (FR-6). */
  const headlineKeys = computed(() =>
    HEADLINE_MODES.map((k) => (k === 'car_average' ? carMode.value : k))
  )

  /**
   * Every mode for this journey.
   *
   * The database is the source of truth: compare_journey() multiplies the
   * distance by the stored factors server-side. The pure client implementation
   * in lib/emissions.js is the fallback when that call cannot be made, and is
   * also what fills the gap for the instant between toggling a return trip and
   * the refetch landing (NFR-7).
   */
  const allModes = computed(() => {
    if (effectiveKm.value == null) return []
    if (serverModes.value.length && serverKm.value === effectiveKm.value) {
      return serverModes.value
    }
    const factorsStore = useFactorsStore()
    return compare(effectiveKm.value, factorsStore.factors)
  })

  /** The five headline modes, with the chosen car sub-type swapped in. */
  const comparison = computed(() =>
    headlineKeys.value
      .map((key) => allModes.value.find((m) => m.modeKey === key))
      .filter(Boolean)
      .sort((a, b) => a.kg - b.kg || a.label.localeCompare(b.label))
  )

  const worst = computed(() => comparison.value.at(-1) ?? null)
  const best = computed(() => comparison.value[0] ?? null)

  /**
   * The headline swap for this journey (E2.2): the biggest saving available
   * that is not simply "walk instead". We take the cleanest *powered* mode so
   * the message stays actionable for a 40 km commute; if none exists, fall back
   * to the cleanest mode overall.
   */
  const headlineSwap = computed(() => {
    const from = comparison.value.find((m) => m.isBaseline) ?? worst.value
    if (!from) return null
    const powered = comparison.value.filter((m) => m.category !== 'active' && m.kg < from.kg)
    const to = powered[0] ?? best.value
    if (!to || to.modeKey === from.modeKey) return null
    return { from, to, savedKg: from.kg - to.kg }
  })

  /** Ask the database to do the multiplication (the brief's business logic). */
  async function fetchComparison() {
    const km = effectiveKm.value
    if (km == null) return
    if (!supabaseConfigured) {
      usingServerCompare.value = false
      return
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('compare_journey', {
        p_distance_km: Number(km.toFixed(2))
      })
      if (rpcError) throw rpcError

      serverModes.value = (data ?? []).map((row) => ({
        modeKey: row.mode_key,
        label: row.mode_label,
        category: row.category,
        factor: Number(row.factor_g_per_pkm),
        kg: Number(row.kg),
        savedVsBaselineKg: Number(row.saved_vs_baseline_kg),
        isBaseline: row.is_baseline
      }))
      serverKm.value = km
      usingServerCompare.value = true
    } catch (err) {
      // Not surfaced as an error: the client fallback produces the same figures
      // from the same factors, so the user loses nothing visible.
      console.warn('[CO2 Compare] compare_journey unavailable, using client fallback:', err.message)
      usingServerCompare.value = false
    }
  }

  // A return-trip toggle changes the distance without re-routing, so the
  // comparison has to be recomputed server-side too.
  watch(effectiveKm, (km) => {
    if (km != null && distanceKm.value != null) fetchComparison()
  })

  async function calculate() {
    if (!ready.value) return
    calculating.value = true
    error.value = null
    lastLog.value = null

    try {
      const result = await routeDistance(origin.value, destination.value)
      distanceKm.value = result.km
      approximate.value = result.approximate
      geometry.value = result.geometry
      durationMin.value = result.durationMin
      await fetchComparison()
    } catch (err) {
      error.value = 'We could not work out the distance for that journey. Please try again.'
      distanceKm.value = null
    } finally {
      calculating.value = false
    }
  }

  /**
   * Log the mode the user actually took. The saving is recomputed in the
   * database (FR-11) — we send only distance, mode and country.
   */
  async function logTrip(modeKey) {
    if (effectiveKm.value == null || logging.value) return null
    logging.value = true
    error.value = null

    // Region comes from the start point, like the country code. Addresses and
    // coordinates are never sent (E6.2).
    const countryCode = origin.value?.countryCode || 'ZZ'
    const regionName = origin.value?.region || null

    try {
      if (!supabaseConfigured) {
        throw new Error('The shared database is not configured, so this trip was not counted.')
      }
      const { data, error: rpcError } = await supabase.rpc('log_trip', {
        p_distance_km: Number(effectiveKm.value.toFixed(2)),
        p_mode_key: modeKey,
        p_country_code: countryCode,
        p_region_name: regionName
      })
      if (rpcError) throw rpcError

      lastLog.value = {
        modeKey,
        savedKg: Number(data.saved_kg),
        emittedKg: Number(data.emitted_kg),
        countryCode: data.country_code,
        regionName: data.region_name,
        regionTotalKg: data.region_total_kg == null ? null : Number(data.region_total_kg)
      }
      sessionSavedKg.value += Number(data.saved_kg)
      return lastLog.value
    } catch (err) {
      error.value = err.message || 'Could not log that trip.'
      return null
    } finally {
      logging.value = false
    }
  }

  function reset() {
    origin.value = null
    destination.value = null
    distanceKm.value = null
    serverModes.value = []
    serverKm.value = null
    usingServerCompare.value = false
    geometry.value = null
    durationMin.value = null
    approximate.value = false
    error.value = null
    lastLog.value = null
  }

  return {
    origin, destination, returnTrip, carMode,
    distanceKm, effectiveKm, approximate, geometry, durationMin,
    calculating, error, logging, lastLog, sessionSavedKg, usingServerCompare,
    ready, comparison, allModes, best, worst, headlineSwap,
    calculate, logTrip, reset
  }
})
