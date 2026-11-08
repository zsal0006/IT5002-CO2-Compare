/**
 * Shaping the community totals for the Impact page.
 *
 * Pure functions over the rows the four `v_savings_*` views return. The
 * database does the aggregating (E4 — the client never sums `trip_logs`); this
 * only decides how the already-aggregated rows are presented.
 */

/**
 * Milestone ladder for the progress bar. Roughly 1-2.5-5 per decade, so the
 * next target is always within sight of the current total rather than being a
 * round number nobody will reach this term.
 */
export const MILESTONES = [
  1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000
]

/**
 * Modes that are not car-free despite not being a car.
 *
 * `category` almost carries this on its own, but `other` holds the e-scooter
 * and the ferry, which ARE car-free, alongside the motorbike, which is not in
 * any sense a reader would accept — the legend says "by car or motorbike".
 * One named exception is more honest than bending the category.
 */
const MOTORISED_PRIVATE = new Set(['motorbike'])

/** Did this mode leave the car at home? */
export function isCarFree(row) {
  if (!row) return false
  return row.category !== 'car' && !MOTORISED_PRIVATE.has(row.mode_key)
}

/**
 * The next milestone above `kg`, and how far through we are.
 *
 * @param {number} kg
 * @returns {{next:number, previous:number, percent:number, remaining:number}}
 */
export function milestoneFor(kg) {
  const total = Number.isFinite(kg) && kg > 0 ? kg : 0
  let next = MILESTONES[MILESTONES.length - 1]
  let previous = 0

  for (let i = 0; i < MILESTONES.length; i++) {
    if (MILESTONES[i] > total) {
      next = MILESTONES[i]
      previous = i ? MILESTONES[i - 1] : 0
      break
    }
  }

  return {
    next,
    previous,
    percent: Math.min(100, Math.round((total / next) * 100)),
    remaining: Math.max(0, next - total)
  }
}

/**
 * Totals for one scope, from the mode rows — which carry distance as well as
 * kilograms, so the equivalences can be derived from kilometres actually
 * travelled rather than scaled out of a saving.
 *
 * @param {object[]} modeRows rows from v_savings_by_mode
 * @returns {{trips:number, savedKg:number, carFreeTrips:number, carFreeKm:number}}
 */
export function summariseModes(modeRows) {
  return modeRows.reduce(
    (acc, row) => {
      const trips = Number(row.trips) || 0
      acc.trips += trips
      acc.savedKg += Number(row.total_saved_kg) || 0
      if (isCarFree(row)) {
        acc.carFreeTrips += trips
        acc.carFreeKm += Number(row.total_distance_km) || 0
      }
      return acc
    },
    { trips: 0, savedKg: 0, carFreeTrips: 0, carFreeKm: 0 }
  )
}

/**
 * "3 trips" / "1 trip". Rounds BEFORE choosing the form, so 1.4 reads as
 * "1 trip" rather than "1 trips".
 *
 * Takes the plural word outright rather than a suffix to append: "country"
 * does not pluralise by adding anything, and a suffix-based version silently
 * produced "countryies".
 *
 * @param {number} n
 * @param {string} singular
 * @param {string} [pluralForm] defaults to `singular + 's'`
 */
export function plural(n, singular, pluralForm = `${singular}s`) {
  const rounded = Math.round(Number(n) || 0)
  return `${rounded} ${rounded === 1 ? singular : pluralForm}`
}
