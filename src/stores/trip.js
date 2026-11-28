import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { routeDistance } from '@/lib/routing'
import { fetchWeather } from '@/lib/weather'
import { compare, MODE_KEYS, MODE_LABELS } from '@/lib/emissions'
import { useFactorsStore } from '@/stores/factors'
import { supabase, supabaseConfigured } from '@/lib/supabase'

/**
 * The current journey: the two confirmed places, the distance, the comparison,
 * and the logging action. The app keeps places in tab memory; routing sends
 * their coordinates to a provider.
 */
export const useTripStore = defineStore('trip', () => {
  const origin = ref(null)       // Place | null
  const destination = ref(null)  // Place | null
  const returnTrip = ref(false)

  const distanceKm = ref(null)
  const approximate = ref(false)
  const routeAttribution = ref(null)

  const calculating = ref(false)
  const error = ref(null)

  // Rows from compare_journey(), and the distance they were computed for. The
  // distance is tracked so a return-trip toggle does not silently show figures
  // for the previous distance while the refetch is in flight.
  const serverModes = ref([])
  const serverKm = ref(null)

  const logging = ref(false)
  const lastLog = ref(null)
  const sessionSavedKg = ref(0)  // session only; cleared when the tab closes
  const sessionTrips = ref(0)

  const ready = computed(() => Boolean(origin.value && destination.value))

  /** Distance actually used in the calculation, doubled for a return trip. */
  const effectiveKm = computed(() =>
    distanceKm.value == null ? null : Number((distanceKm.value * (returnTrip.value ? 2 : 1)).toFixed(2))
  )
  const comparisonUsesFallback = computed(() =>
    serverModes.value.length !== MODE_KEYS.length || serverKm.value !== effectiveKm.value
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
    if (!comparisonUsesFallback.value) return serverModes.value
    const factorsStore = useFactorsStore()
    return compare(effectiveKm.value, factorsStore.factors)
  })

  /** The five supported modes, including the car baseline. */
  const comparison = computed(() =>
    MODE_KEYS
      .map((key) => allModes.value.find((m) => m.modeKey === key))
      .filter(Boolean)
  )

  /** Ask the database to do the multiplication (the brief's business logic). */
  async function fetchComparison() {
    const km = effectiveKm.value
    if (km == null) return
    if (!supabaseConfigured) {
      return
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('compare_journey', {
        p_distance_km: Number(km.toFixed(2))
      })
      if (rpcError) throw rpcError

      if (effectiveKm.value !== km) return
      serverModes.value = (data ?? []).map((row) => ({
        modeKey: row.mode_key,
        label: MODE_LABELS[row.mode_key] ?? row.mode_label,
        category: row.category,
        factor: Number(row.factor_g_per_pkm),
        kg: Number(row.kg),
        savedVsBaselineKg: Number(row.saved_vs_baseline_kg),
        isBaseline: row.is_baseline
      }))
      serverKm.value = km
    } catch (err) {
      // The client uses its loaded factors when the server comparison fails.
      console.warn('[CO2 Compare] compare_journey unavailable, using client fallback:', err.message)
    }
  }

  // calculate() refreshes after routing; only a return-trip toggle needs its
  // own refresh because it changes the effective distance without re-routing.
  watch(returnTrip, () => {
    if (distanceKm.value != null) fetchComparison()
  })

  // Optional extra: never blocks or fails the comparison.
  const weather = ref(null)
  async function loadWeather() {
    const from = origin.value
    weather.value = null
    if (!from || !supabaseConfigured) return
    try {
      const result = await fetchWeather(from)
      if (origin.value === from) weather.value = result
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('[CO2 Compare] Weather unavailable:', err.message)
    }
  }

  watch([origin, destination], ([newOrigin], [oldOrigin]) => {
    if (newOrigin !== oldOrigin) weather.value = null
    distanceKm.value = null
    approximate.value = false
    routeAttribution.value = null
    serverModes.value = []
    serverKm.value = null
    lastLog.value = null
    error.value = null
  })

  async function calculate() {
    if (!ready.value || calculating.value) return
    calculating.value = true
    error.value = null
    lastLog.value = null
    const from = origin.value
    const to = destination.value

    try {
      const result = await routeDistance(from, to)
      if (origin.value !== from || destination.value !== to) return
      if (!Number.isFinite(result.km) || result.km <= 0 ||
          Number((result.km * (returnTrip.value ? 2 : 1)).toFixed(2)) <= 0) {
        throw new Error('The journey distance must be at least 0.01 km after rounding.')
      }
      distanceKm.value = result.km
      approximate.value = result.approximate
      routeAttribution.value = result.attribution
      loadWeather()
      await fetchComparison()
    } catch (err) {
      if (origin.value !== from || destination.value !== to) return
      console.warn('[CO2 Compare] Could not calculate journey:', err.message)
      error.value = `Could not calculate the journey: ${err.message || 'Please try again.'}`
      distanceKm.value = null
    } finally {
      calculating.value = false
    }
  }

  /**
   * Log the mode the user actually took. The saving is recomputed in the
   * database (FR-11) — we send distance, mode, country and region.
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
        savedKg: Number(data.saved_kg)
      }
      sessionSavedKg.value += Number(data.saved_kg)
      sessionTrips.value++
      return lastLog.value
    } catch (err) {
      error.value = err.message || 'Could not log that trip.'
      return null
    } finally {
      logging.value = false
    }
  }

  return {
    origin, destination, returnTrip,
    distanceKm, effectiveKm, approximate, routeAttribution,
    calculating, error, logging, lastLog, sessionSavedKg, sessionTrips,
    weather, ready, comparison, comparisonUsesFallback,
    calculate, logTrip
  }
})
