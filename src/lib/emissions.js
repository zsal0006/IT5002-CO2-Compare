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

/** Equivalent distance in a baseline vehicle for the same emissions. */
export function carEquivalentKm(distanceKm, factorGPerPkm, carFactorGPerPkm) {
  if (
    !Number.isFinite(distanceKm) || distanceKm < 0 ||
    !Number.isFinite(factorGPerPkm) || factorGPerPkm < 0 ||
    !Number.isFinite(carFactorGPerPkm) || carFactorGPerPkm <= 0
  ) return 0
  return (distanceKm * factorGPerPkm) / carFactorGPerPkm
}

/**
 * Saving versus the baseline mode. Clamped at zero: the leaderboard counts
 * avoided emissions, not a net ledger.
 */
export function savedKg(distanceKm, factorGPerPkm, baselineGPerPkm) {
  return Math.max(0, emissionsKg(distanceKm, baselineGPerPkm) - emissionsKg(distanceKm, factorGPerPkm))
}

/** The five modes supported by the app, in display order. */
export const MODE_KEYS = ['cycling', 'walking', 'bus_city', 'train_national', 'car_average']
export const MODE_LABELS = {
  cycling: 'Cycling',
  walking: 'Walking',
  bus_city: 'Bus',
  train_national: 'Train',
  car_average: 'Car'
}

/**
 * Build the full comparison for a journey, sorted cleanest-first.
 *
 * @param {number} distanceKm
 * @param {Factor[]} factors
 * @returns {ModeResult[]}
 */
export function compare(distanceKm, factors) {
  const baseline = factors.find((f) => f.is_baseline)
  const baselineFactor = baseline ? Number(baseline.factor_g_per_pkm) : 0

  return factors
    .map((f) => {
      const factor = Number(f.factor_g_per_pkm)
      return {
        modeKey: f.mode_key,
        label: MODE_LABELS[f.mode_key] ?? f.mode_label,
        category: f.category,
        factor,
        kg: emissionsKg(distanceKm, factor),
        savedVsBaselineKg: savedKg(distanceKm, factor, baselineFactor),
        isBaseline: Boolean(f.is_baseline)
      }
    })
    .sort((a, b) => a.kg - b.kg || a.label.localeCompare(b.label))
}
