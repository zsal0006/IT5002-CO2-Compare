/**
 * The emissions arithmetic. Pure functions only — no network, no store access —
 * so this module is directly unit-testable and is the single place the
 * calculation is defined.
 *
 * Unit discipline: factors are grams CO2e per PASSENGER-kilometre; distances
 * are kilometres; everything returned to the UI is kilograms.
 */

/**
 * @typedef {object} Factor
 * @property {string} mode_key
 * @property {string} mode_label
 * @property {string} category
 * @property {number} factor_g_per_pkm
 * @property {boolean} is_baseline
 */

/**
 * @typedef {object} ModeResult
 * @property {string} modeKey
 * @property {string} label
 * @property {string} category
 * @property {number} factor      g CO2e / passenger-km
 * @property {number} kg          emissions for this journey, kg CO2e
 * @property {number} savedVsBaselineKg  never negative
 * @property {boolean} isBaseline
 */

/**
 * Emissions for one mode over a distance.
 * @param {number} distanceKm
 * @param {number} factorGPerPkm
 * @returns {number} kg CO2e
 */
export function emissionsKg(distanceKm, factorGPerPkm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0
  if (!Number.isFinite(factorGPerPkm) || factorGPerPkm < 0) return 0
  return (distanceKm * factorGPerPkm) / 1000
}

/**
 * Saving versus the baseline mode. Clamped at zero: the leaderboard counts
 * avoided emissions, not a net ledger (see docs/04 §4.3).
 */
export function savedKg(distanceKm, factorGPerPkm, baselineGPerPkm) {
  return Math.max(0, emissionsKg(distanceKm, baselineGPerPkm) - emissionsKg(distanceKm, factorGPerPkm))
}

/**
 * Build the full comparison for a journey, sorted cleanest-first.
 *
 * @param {number} distanceKm
 * @param {Factor[]} factors
 * @param {{modeKeys?: string[]}} [options] restrict to a subset of modes
 * @returns {ModeResult[]}
 */
export function compare(distanceKm, factors, options = {}) {
  const baseline = factors.find((f) => f.is_baseline)
  const baselineFactor = baseline ? Number(baseline.factor_g_per_pkm) : 0

  const pool = options.modeKeys
    ? options.modeKeys.map((k) => factors.find((f) => f.mode_key === k)).filter(Boolean)
    : factors

  return pool
    .map((f) => {
      const factor = Number(f.factor_g_per_pkm)
      return {
        modeKey: f.mode_key,
        label: f.mode_label,
        category: f.category,
        factor,
        kg: emissionsKg(distanceKm, factor),
        savedVsBaselineKg: savedKg(distanceKm, factor, baselineFactor),
        isBaseline: Boolean(f.is_baseline)
      }
    })
    .sort((a, b) => a.kg - b.kg || a.label.localeCompare(b.label))
}

/** The five modes the headline comparison shows (FR-4). */
export const HEADLINE_MODES = ['car_average', 'bus_city', 'train_national', 'cycling', 'walking']

/**
 * Everyday equivalences, used to make a bare kilogram figure mean something.
 * Each is a deliberate, citable approximation — see the Learn page.
 */
export function equivalences(kg) {
  return [
    { label: 'km driven in an average car', value: kg / 0.17 },
    { label: 'smartphone charges', value: kg / 0.0083 },
    { label: 'days a mature tree takes to absorb this', value: kg / 0.06 }
  ]
}
