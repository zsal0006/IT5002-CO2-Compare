/**
 * Co-benefits — the reasons to switch that are not a kilogram of CO₂.
 *
 * A bare "0.8 kg CO₂e" means nothing to most people. These turn a journey into
 * things someone can picture: calories burned, petrol not bought, how long a
 * tree would need to absorb the difference.
 *
 * Pure functions, no I/O, so they are directly unit-testable like
 * `lib/emissions.js`.
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
const ACTIVE_PROFILE = {
  walking: { met: 3.5, kmh: 4.8, label: 'walking at a normal pace' },
  cycling: { met: 7.5, kmh: 15, label: 'cycling at a steady pace' }
}

/** Steps per kilometre at an average adult stride (~0.77 m). */
const STEPS_PER_KM = 1300

/**
 * CO₂ a mature tree absorbs in a year, kg. Basis: US EPA Greenhouse Gas
 * Equivalencies Calculator. Used only to express "how long would a tree need",
 * never as an offset claim.
 */
const TREE_KG_PER_YEAR = 21.8

/** Petrol: kg CO₂ per litre burned, and a typical car's consumption. */
const PETROL_KG_PER_LITRE = 2.31
const CAR_LITRES_PER_100KM = 6.8

/**
 * Fuel cost for `km` at a given pump price.
 *
 * Deliberately fuel ONLY. We have no fare data, so a "net saving" against a bus
 * ticket or rail fare would be a number we cannot support — and it would often
 * be negative, since a train fare frequently exceeds the petrol for the same
 * trip. What this states is narrower and defensible: the fuel a car would have
 * burned, which you did not buy. The card says so, and the Learn page repeats it.
 *
 * @param {number} km
 * @param {{price_per_litre:number, currency_code:string}} price
 */
export function fuelCostFor(km, price) {
  if (!price || !Number.isFinite(km) || km <= 0) return 0
  return litresFor(km) * Number(price.price_per_litre)
}

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

/** Charging a smartphone once, kg CO₂e. Basis: US EPA equivalencies. */
const PHONE_CHARGE_KG = 0.0083

/**
 * @typedef {object} Benefit
 * @property {string} key
 * @property {string} headline  the number, already formatted
 * @property {string} detail    what it means, one short line
 * @property {string} basis     the assumption, shown as a footnote
 */

/** Energy burned travelling `km` under its own power, in kcal. */
export function caloriesFor(modeKey, km, bodyKg = ASSUMED_BODY_KG) {
  const profile = ACTIVE_PROFILE[modeKey]
  if (!profile || !Number.isFinite(km) || km <= 0) return 0
  return profile.met * bodyKg * (km / profile.kmh)
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

function round(value, step) {
  return Math.round(value / step) * step
}

const int = (n) => new Intl.NumberFormat(LOCALE).format(Math.round(n))

/**
 * Build the co-benefit cards for one mode on one journey.
 *
 * @param {{modeKey:string, label:string, category:string, kg:number, savedVsBaselineKg:number}} mode
 * @param {number} km distance for the journey as calculated
 * @param {{price_per_litre:number, currency_code:string, updated_on?:string}|null} [price]
 *   pump price for the trip's start country. Omit and the money card is simply
 *   left out rather than guessed at.
 * @returns {Benefit[]} at most four, most persuasive first
 */
export function benefitsFor(mode, km, price = null) {
  if (!mode || !Number.isFinite(km) || km <= 0) return []

  const out = []
  const saved = mode.savedVsBaselineKg ?? 0

  // --- Active travel: the health case is stronger than the carbon one -------
  if (mode.category === 'active') {
    const kcal = caloriesFor(mode.modeKey, km)
    if (kcal >= 10) {
      out.push({
        key: 'calories',
        headline: `${int(round(kcal, 5))} kcal`,
        detail: `Burned ${ACTIVE_PROFILE[mode.modeKey].label} this distance.`,
        basis: `Assumes a ${ASSUMED_BODY_KG} kg adult at ${ACTIVE_PROFILE[mode.modeKey].kmh} km/h. Your own figure will differ.`
      })
    }
    if (mode.modeKey === 'walking') {
      out.push({
        key: 'steps',
        headline: `${int(round(km * STEPS_PER_KM, 100))} steps`,
        detail: 'Towards a daily step target, without setting foot in a gym.',
        basis: `Assumes ${STEPS_PER_KM} steps per km at an average stride.`
      })
    }
  }

  // --- Anything that beats the car ----------------------------------------
  if (saved > 0.01) {
    if (price && mode.category !== 'car') {
      const cost = fuelCostFor(km, price)
      if (cost > 0) {
        out.push({
          key: 'money',
          headline: formatMoney(cost, price.currency_code),
          detail: 'Fuel a car would have used, that you did not buy.',
          basis:
            `Fuel only, at ${formatMoney(Number(price.price_per_litre), price.currency_code)} per litre` +
            `${price.updated_on ? ` as at ${price.updated_on}` : ''}. ` +
            'Excludes any fare or ticket you paid instead, and excludes tax, parking, insurance and wear.'
        })
      }
    }

    const days = round(treeDaysFor(saved), 1)
    out.push({
      key: 'trees',
      headline: days >= 1 ? `${int(days)} tree-day${days === 1 ? '' : 's'}` : 'Under a tree-day',
      detail: `How long a mature tree needs to absorb the ${formatKgShort(saved)} you avoided.`,
      basis: `A mature tree absorbs about ${TREE_KG_PER_YEAR} kg CO₂ a year. A comparison, not an offset.`
    })

    if (mode.category !== 'car') {
      const litres = litresFor(km)
      if (litres >= 0.2) {
        out.push({
          key: 'fuel',
          headline: `${litres.toFixed(1)} litres`,
          detail: 'Petrol a car would have burned on this trip, left in the ground.',
          basis: `Assumes ${CAR_LITRES_PER_100KM} L/100 km and ${PETROL_KG_PER_LITRE} kg CO₂ per litre.`
        })
      }
    }
  }

  // --- The car's own trip: state the cost rather than celebrate it ---------
  if (mode.category === 'car' && mode.kg > 0) {
    const litres = litresFor(km)
    out.push({
      key: 'fuel-burned',
      headline: `${litres.toFixed(1)} litres`,
      detail: 'Petrol burned on this trip.',
      basis: `Assumes ${CAR_LITRES_PER_100KM} L/100 km. An electric car burns none, but its electricity is not free of carbon.`
    })
    if (price) {
      const cost = fuelCostFor(km, price)
      if (cost > 0) {
        out.push({
          key: 'money-spent',
          headline: formatMoney(cost, price.currency_code),
          detail: 'Fuel for this trip, at local pump prices.',
          basis:
            `At ${formatMoney(Number(price.price_per_litre), price.currency_code)} per litre` +
            `${price.updated_on ? ` as at ${price.updated_on}` : ''}. ` +
            'Fuel only — parking, insurance, tax and wear are on top.'
        })
      }
    }

    out.push({
      key: 'charges',
      headline: `${int(mode.kg / PHONE_CHARGE_KG)} phone charges`,
      detail: 'The same emissions, in a unit you use every day.',
      basis: `About ${PHONE_CHARGE_KG * 1000} g CO₂e per smartphone charge.`
    })
  }

  // Qualitative, so it goes last: it only earns a slot when the measured cards
  // have not already filled the row.
  if (mode.category === 'active') {
    out.push({
      key: 'zero',
      headline: 'No tailpipe',
      detail: 'No fuel burned, nothing emitted, no parking to find.',
      basis: 'Zero on an operational basis. Making a bicycle and growing food are not counted.'
    })
  }

  return out.slice(0, 4)
}

function formatKgShort(kg) {
  if (kg < 1) return `${Math.round(kg * 1000)} g`
  return `${kg.toFixed(kg < 10 ? 1 : 0)} kg`
}

export const BENEFIT_CONSTANTS = {
  ASSUMED_BODY_KG,
  STEPS_PER_KM,
  TREE_KG_PER_YEAR,
  PETROL_KG_PER_LITRE,
  CAR_LITRES_PER_100KM,
  PHONE_CHARGE_KG,
  ACTIVE_PROFILE
}
