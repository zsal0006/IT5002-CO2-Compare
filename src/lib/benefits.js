/**
 * Co-benefits — the reasons to switch that are not a kilogram of CO₂.
 *
 * A bare "0.8 kg CO₂e" means nothing to most people. These turn a journey into
 * things someone can picture: calories burned, petrol not bought, how long a
 * tree would need to absorb the difference.
 *
 * Pure functions, no I/O, so they are directly unit-testable like
 * `lib/emissions.js`. Nothing here decides a colour or a layout — the tiles and
 * the pictogram panel do that from the `tone` and `unitLadder` each metric
 * carries.
 *
 * ---------------------------------------------------------------------------
 * HONESTY RULES, which the Learn page repeats:
 *
 * 1. Every constant below is an average with a named basis. None is a
 *    measurement of *you*.
 * 2. Calories depend on body mass, pace, terrain and wind. We assume one body
 *    mass and one pace, and the UI says so.
 * 3. "Trees" is a time-to-absorb comparison, not an offset. Nothing here is
 *    sold, traded or claimed as a carbon credit.
 * 4. Never state a co-benefit with more precision than the input deserves —
 *    these round hard on purpose.
 * 5. A figure scaled to a week or a year is a PROJECTION, not a measurement.
 *    `lib/timeframe.js` holds that arithmetic and its caption always states
 *    the trip count assumed.
 *
 * SPRINT 1 (T-1.8): every constant here is a well-known published figure, but
 * the team must confirm each against its primary source and record it in
 * `data_sources` before submission, exactly as the emission factors were.
 * ---------------------------------------------------------------------------
 */
import { LOCALE, DEFAULT_CURRENCY } from './locale.js'

/** Assumed body mass for the energy calculation, kg. */
export const ASSUMED_BODY_KG = 70

/**
 * Metabolic Equivalent of Task and typical speed per active mode.
 * MET values follow the Compendium of Physical Activities (Ainsworth et al.).
 * kcal ≈ MET × body mass (kg) × hours.
 */
export const ACTIVE_PROFILE = {
  walking: { met: 3.5, kmh: 4.8, label: 'walking at a normal pace' },
  cycling: { met: 7.5, kmh: 15, label: 'cycling at a steady pace' }
}

/** Steps per kilometre at an average adult stride (~0.77 m). */
export const STEPS_PER_KM = 1300

/** A widely used daily step target, for the steps card's context line. */
export const DAILY_STEP_GOAL = 10000

/**
 * CO₂ a mature tree absorbs in a year, kg. Basis: US EPA Greenhouse Gas
 * Equivalencies Calculator. Used only to express "how long would a tree need",
 * never as an offset claim.
 */
export const TREE_KG_PER_YEAR = 21.8

/** Petrol: kg CO₂ per litre burned, and a typical car's consumption. */
export const PETROL_KG_PER_LITRE = 2.31
export const CAR_LITRES_PER_100KM = 6.8

/** Charging a smartphone once, kg CO₂e. Basis: US EPA equivalencies. */
export const PHONE_CHARGE_KG = 0.0083

// --------------------------------------------------------------- primitives

/** Energy burned travelling `km` under its own power, in kcal. */
export function caloriesFor(modeKey, km, bodyKg = ASSUMED_BODY_KG) {
  const profile = ACTIVE_PROFILE[modeKey]
  if (!profile || !Number.isFinite(km) || km <= 0) return 0
  return profile.met * bodyKg * (km / profile.kmh)
}

/** kcal per kilometre for an active mode, 0 for everything else. */
export function caloriesPerKm(modeKey, bodyKg = ASSUMED_BODY_KG) {
  return caloriesFor(modeKey, 1, bodyKg)
}

/** Days a mature tree would need to absorb `kg` of CO₂. */
export function treeDaysFor(kg) {
  if (!Number.isFinite(kg) || kg <= 0) return 0
  return kg / (TREE_KG_PER_YEAR / 365)
}

/** Litres of petrol a car would burn over `km`. */
export function litresFor(km) {
  if (!Number.isFinite(km) || km <= 0) return 0
  return (km * CAR_LITRES_PER_100KM) / 100
}

/**
 * Fuel cost for `km` at a given pump price.
 *
 * Deliberately fuel ONLY. We have no fare data, so a "net saving" against a bus
 * ticket or rail fare would be a number we cannot support — and it would often
 * be negative, since a train fare frequently exceeds the petrol for the same
 * trip. What this states is narrower and defensible: the fuel a car would have
 * burned, which you did not buy. The tile says so, and the Learn page repeats it.
 */
export function fuelCostFor(km, price) {
  if (!price || !Number.isFinite(km) || km <= 0) return 0
  return litresFor(km) * Number(price.price_per_litre)
}

// --------------------------------------------------------------- formatting

/** Format an amount in its own currency, without inventing precision. */
export function formatMoney(amount, currencyCode = DEFAULT_CURRENCY) {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'code',
      maximumFractionDigits: amount < 10 ? 2 : 0
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`
  }
}

const int = (n) => new Intl.NumberFormat(LOCALE).format(Math.round(n))

function plural(n, word) {
  return `${int(n)} ${word}${Math.round(n) === 1 ? '' : 's'}`
}

/** Tree-days become tree-years once the number stops being imaginable. */
function formatTreeTime(days) {
  if (days < 1) return 'Under a tree-day'
  if (days < 365) return plural(days, 'tree-day')
  return `${(days / 365).toFixed(1)} tree-years`
}

function formatLitres(litres) {
  const digits = litres < 10 ? 1 : 0
  return `${new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(litres)} litres`
}

// ------------------------------------------------------------- the metrics

/**
 * @typedef {object} BenefitMetric
 * @property {string} key        money | tree | fuel | steps | kcal
 * @property {number} value      the raw number, for the pictogram's arithmetic
 * @property {string} formatted  the same number for a human
 * @property {string} label      what it is, one line, on the tile
 * @property {string} title      the heading the pictogram panel uses
 * @property {string} basis      the assumption behind it
 * @property {'series-1'|'accent'|'neutral'|'warm'} tone  which swatch the tile wears
 * @property {number[]} unitLadder  candidate "one glyph = N" steps, ascending
 * @property {(unit:number)=>string} unitLabel  how to caption the chosen step
 */

/**
 * Candidate denominations for one pictogram glyph. The panel walks each ladder
 * upward and takes the first step that keeps the row under forty glyphs — forty
 * being roughly where a reader stops counting and starts estimating, which is
 * the moment the pictogram has stopped doing its job.
 */
const UNIT_LADDERS = {
  money: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000],
  tree: [1, 2, 5, 10, 30, 73, 182.5, 365, 730, 1825, 3650],
  fuel: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 500],
  steps: [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000],
  kcal: [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000]
}

/**
 * Every co-benefit of taking `mode` instead of the baseline, scaled to `trips`.
 *
 * @param {{modeKey:string, label:string, category:string, kg:number, savedVsBaselineKg:number}} mode
 * @param {number} km distance of ONE journey, as calculated
 * @param {object} [options]
 * @param {number} [options.trips=1] how many such journeys the timeframe holds
 * @param {{price_per_litre:number, currency_code:string, updated_on?:string}|null} [options.price]
 *   pump price for the trip's start country. Omit and the money metric is left
 *   out rather than guessed at.
 * @param {string} [options.caption] the timeframe's assumption, for titles
 * @returns {BenefitMetric[]}
 */
export function benefitMetrics(mode, km, options = {}) {
  if (!mode || !Number.isFinite(km) || km <= 0) return []

  const { trips = 1, price = null, caption = '' } = options
  const n = Number.isFinite(trips) && trips > 0 ? trips : 1
  const saved = (mode.savedVsBaselineKg ?? 0) * n
  const totalKm = km * n
  const suffix = caption ? ` ${caption}` : ''

  const out = []

  // --- what the car would have cost, in money and in litres ----------------
  // Both describe fuel a car would have burned. They stay separate metrics
  // because each drives its own pictogram — coins and drops count different
  // things — and a tile here is a view the reader switches between, not a
  // summary they read all at once.
  const isCar = mode.category === 'car'

  if (!isCar && saved > 0.01) {
    const litres = litresFor(totalKm)

    if (price) {
      const cost = fuelCostFor(totalKm, price)
      if (cost > 0) {
        out.push({
          key: 'money',
          value: cost,
          formatted: formatMoney(cost, price.currency_code),
          label: 'Fuel money kept in your pocket',
          title: `Fuel money saved${suffix}`,
          tone: 'series-1',
          unitLadder: UNIT_LADDERS.money,
          unitLabel: (unit) =>
            `1 coin = ${formatMoney(unit, price.currency_code)}`,
          basis:
            `${CAR_LITRES_PER_100KM} L/100 km at ` +
            `${formatMoney(Number(price.price_per_litre), price.currency_code)} per litre` +
            `${price.updated_on ? ` as at ${price.updated_on}` : ''}. ` +
            'Fuel only: excludes any fare or ticket you paid instead, and excludes ' +
            'tax, parking, insurance and wear.'
        })
      }
    }

    if (litres >= 0.05) {
      out.push({
        key: 'fuel',
        value: litres,
        formatted: formatLitres(litres),
        label: 'Petrol left in the ground',
        title: `Petrol you did not burn${suffix}`,
        tone: 'neutral',
        unitLadder: UNIT_LADDERS.fuel,
        unitLabel: (unit) => `1 drop = ${unit} L`,
        basis: `Assumes ${CAR_LITRES_PER_100KM} L/100 km and ${PETROL_KG_PER_LITRE} kg CO₂ per litre.`
      })
    }

    const days = treeDaysFor(saved)
    out.push({
      key: 'tree',
      value: days,
      formatted: formatTreeTime(days),
      label: 'Of a mature tree soaking up CO₂',
      title: 'Tree time it would take to absorb the same CO₂',
      tone: 'accent',
      unitLadder: UNIT_LADDERS.tree,
      unitLabel: (unit) =>
        unit >= 365
          ? `1 tree = ${plural(unit / 365, 'tree-year')}`
          : `1 tree = ${plural(unit, 'tree-day')}`,
      basis:
        `A mature tree absorbs about ${TREE_KG_PER_YEAR} kg CO₂ a year. ` +
        'A comparison, not an offset — nothing here is traded or claimed as a credit.'
    })
  }

  // --- active travel: the health case is stronger than the carbon one ------
  if (mode.category === 'active') {
    const profile = ACTIVE_PROFILE[mode.modeKey]
    const kcal = caloriesFor(mode.modeKey, totalKm)

    if (kcal >= 10) {
      out.push({
        key: 'kcal',
        value: kcal,
        formatted: `${int(kcal)} kcal`,
        label: `Burned ${profile.label} instead of sitting in traffic`,
        title: `Energy you would burn${suffix}`,
        tone: 'warm',
        unitLadder: UNIT_LADDERS.kcal,
        unitLabel: (unit) => `1 flame = ${int(unit)} kcal`,
        basis:
          `About ${caloriesPerKm(mode.modeKey).toFixed(0)} kcal per km for a ` +
          `${ASSUMED_BODY_KG} kg adult at ${profile.kmh} km/h. Your own figure will differ ` +
          'with body mass, pace, terrain and wind.'
      })
    }

    if (mode.modeKey === 'walking') {
      const steps = totalKm * STEPS_PER_KM
      out.push({
        key: 'steps',
        value: steps,
        formatted: `${int(steps)} steps`,
        label: 'Steps towards your daily goal',
        title: `Steps you would take${suffix}`,
        tone: 'accent',
        unitLadder: UNIT_LADDERS.steps,
        unitLabel: (unit) => `1 footprint = ${int(unit)} steps`,
        basis:
          `About ${STEPS_PER_KM} steps per km at an average adult stride. ` +
          `${int(DAILY_STEP_GOAL)} steps is a common daily target.`
      })
    }
  }

  // --- the car's own trip: state the cost rather than celebrate it ---------
  if (isCar && mode.kg > 0) {
    const litres = litresFor(totalKm)

    if (price) {
      const cost = fuelCostFor(totalKm, price)
      if (cost > 0) {
        out.push({
          key: 'money',
          value: cost,
          formatted: formatMoney(cost, price.currency_code),
          label: 'Fuel for this journey, at local pump prices',
          title: `Fuel you would pay for${suffix}`,
          tone: 'series-1',
          unitLadder: UNIT_LADDERS.money,
          unitLabel: (unit) => `1 coin = ${formatMoney(unit, price.currency_code)}`,
          basis:
            `At ${formatMoney(Number(price.price_per_litre), price.currency_code)} per litre` +
            `${price.updated_on ? ` as at ${price.updated_on}` : ''}. ` +
            'Fuel only — parking, insurance, tax and wear are on top.'
        })
      }
    }

    out.push({
      key: 'fuel',
      value: litres,
      formatted: formatLitres(litres),
      label: 'Petrol burned on this journey',
      title: `Petrol burned${suffix}`,
      tone: 'neutral',
      unitLadder: UNIT_LADDERS.fuel,
      unitLabel: (unit) => `1 drop = ${unit} L`,
      basis:
        `Assumes ${CAR_LITRES_PER_100KM} L/100 km. An electric car burns none, ` +
        'but its electricity is not free of carbon.'
    })
  }

  return out
}

/**
 * Choose the denomination for one pictogram glyph, and how many to draw.
 *
 * @param {BenefitMetric} metric
 * @param {number} [maxGlyphs=40]
 * @returns {{unit:number, unitLabel:string, full:number, fraction:number, count:number}}
 */
export function pictogramUnits(metric, maxGlyphs = 40) {
  const ladder = metric?.unitLadder ?? [1]
  const value = Number(metric?.value) || 0

  let unit = ladder[ladder.length - 1]
  for (const step of ladder) {
    if (value / step <= maxGlyphs) {
      unit = step
      break
    }
  }

  const exact = value / unit
  const full = Math.floor(exact)
  const fraction = exact - full
  // A part-glyph is only worth drawing once it is visible; below that it reads
  // as a rendering fault rather than as "and a bit more".
  const count = full + (fraction > 0.05 ? 1 : 0)

  return { unit, unitLabel: metric.unitLabel(unit), full, fraction, count }
}

export const BENEFIT_CONSTANTS = {
  ASSUMED_BODY_KG,
  STEPS_PER_KM,
  DAILY_STEP_GOAL,
  TREE_KG_PER_YEAR,
  PETROL_KG_PER_LITRE,
  CAR_LITRES_PER_100KM,
  PHONE_CHARGE_KG,
  ACTIVE_PROFILE
}
