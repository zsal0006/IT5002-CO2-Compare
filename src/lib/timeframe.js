/**
 * Scaling one journey up to a week, a month or a year.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS SEPARATE FROM THE EMISSIONS MATHS
 *
 * `lib/emissions.js` computes what a journey actually costs. This file computes
 * a PROJECTION: what the same choice would come to if repeated. They must not
 * be confused, because only the first is a measurement. Nothing projected here
 * is ever logged to `trip_logs` — the Impact page counts trips that happened.
 *
 * The projection is honest only if its assumption is on screen, so every
 * timeframe carries a caption that states the trip count it used.
 * ---------------------------------------------------------------------------
 */

/** Working weeks in a year, allowing four weeks of leave and public holidays. */
export const WEEKS_PER_YEAR = 48

/** Weeks in an average month. 52 ÷ 12, not 4 — four would understate by 8%. */
export const WEEKS_PER_MONTH = 52 / 12

export const TIMEFRAMES = [
  { key: 'trip', label: 'Trip' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' }
]

export const DEFAULT_TRIPS_PER_WEEK = 10

/**
 * How many journeys the chosen timeframe contains.
 *
 * @param {string} timeframe one of TIMEFRAMES[].key
 * @param {number} tripsPerWeek one-way journeys per week
 * @param {boolean} returnTrip whether the quoted distance is already doubled
 * @returns {number}
 */
export function tripCount(timeframe, tripsPerWeek, returnTrip = false) {
  const perWeek = Number.isFinite(tripsPerWeek) ? tripsPerWeek : DEFAULT_TRIPS_PER_WEEK
  switch (timeframe) {
    // "This trip" is the journey as calculated. A return trip is one journey
    // of twice the distance, not two journeys, because the distance already
    // carries the doubling — counting it twice would double it again.
    case 'trip':
      return 1
    case 'week':
      return perWeek
    case 'month':
      return perWeek * WEEKS_PER_MONTH
    case 'year':
      return perWeek * WEEKS_PER_YEAR
    default:
      return 1
  }
}

/** The assumption, in words, to sit under the headline figure. */
export function timeframeCaption(timeframe, tripsPerWeek, returnTrip = false) {
  const n = Number.isFinite(tripsPerWeek) ? tripsPerWeek : DEFAULT_TRIPS_PER_WEEK
  switch (timeframe) {
    case 'trip':
      return returnTrip ? 'on this return trip' : 'on this one-way trip'
    case 'week':
      return `per week at ${n} trips`
    case 'month':
      return `per month at ${n} trips a week`
    case 'year':
      return `per year, ${WEEKS_PER_YEAR} weeks at ${n} trips`
    default:
      return ''
  }
}

export function capitalise(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}
