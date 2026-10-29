import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

  const comparison = computed(() => {
    const factorsStore = useFactorsStore()
    if (effectiveKm.value == null || !factorsStore.factors.length) return []
    return compare(effectiveKm.value, factorsStore.factors, { modeKeys: headlineKeys.value })
  })

  /** Every mode, for the "log what you actually took" selector. */
  const allModes = computed(() => {
    const factorsStore = useFactorsStore()
    if (effectiveKm.value == null) return []
    return compare(effectiveKm.value, factorsStore.factors)
  })

  const worst = computed(() => comparison.value.at(-1) ?? null)
  const best = computed(() => comparison.value[0] ?? null)

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

    const countryCode = origin.value?.countryCode || 'ZZ'

    try {
      if (!supabaseConfigured) {
        throw new Error('The shared database is not configured, so this trip was not counted.')
      }
      const { data, error: rpcError } = await supabase.rpc('log_trip', {
        p_distance_km: Number(effectiveKm.value.toFixed(2)),
        p_mode_key: modeKey,
        p_country_code: countryCode
      })
      if (rpcError) throw rpcError

      lastLog.value = {
        modeKey,
        savedKg: Number(data.saved_kg),
        emittedKg: Number(data.emitted_kg),
        countryCode: data.country_code
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
    geometry.value = null
    durationMin.value = null
    approximate.value = false
    error.value = null
    lastLog.value = null
  }

  return {
    origin, destination, returnTrip, carMode,
    distanceKm, effectiveKm, approximate, geometry, durationMin,
    calculating, error, logging, lastLog, sessionSavedKg,
    ready, comparison, allModes, best, worst,
    calculate, logTrip, reset
  }
})
