/**
 * Default market.
 *
 * CO2 Compare is built for an Australian audience: the Climate Council source,
 * the wireframes' "Victoria, Australia" region selector and the fuel prices all
 * assume it. Anything that needs a country or a currency when the trip's own
 * location cannot supply one falls back to these rather than to a global
 * average, so a user who never leaves Australia never sees a foreign currency.
 *
 * The app still works anywhere: a trip starting outside Australia uses its own
 * country's row when one exists. These are defaults, not restrictions.
 */

/** ISO 3166-1 alpha-2 — trip logs, fuel prices. */
export const DEFAULT_COUNTRY_A2 = 'AU'

/** ISO 3166-1 alpha-3 — the emissions dataset and the dashboard. */
export const DEFAULT_COUNTRY_A3 = 'AUS'

/** Number, date and currency formatting. */
export const LOCALE = 'en-AU'

/** Used when no price row at all can be read. */
export const DEFAULT_CURRENCY = 'AUD'
