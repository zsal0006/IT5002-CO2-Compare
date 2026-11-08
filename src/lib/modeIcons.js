/**
 * Line-art glyphs for each transport mode, as raw SVG path data.
 *
 * Paths rather than components so one <svg> element can render any mode: the
 * logger draws fourteen of these in a grid, and fourteen separate components
 * would be fourteen imports for no gain.
 *
 * Every path is drawn for a 24×24 box with `fill="none"`, `stroke="currentColor"`
 * and a stroke width near 2, so the glyph takes the colour of whatever it sits
 * in. Icons are decorative here — each button carries a real text label or an
 * aria-label — so the <svg> that renders them is aria-hidden.
 *
 * Keys are our own `mode_key` values from `emission_factors`, so a mode added
 * to the database without a glyph falls back to FALLBACK_ICON rather than
 * rendering an empty button.
 */

export const FALLBACK_ICON = 'M12 5a7 7 0 1 1 0 14a7 7 0 1 1 0-14zM12 8v4l3 2'

export const MODE_ICONS = {
  walking: 'M13 2.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM11 21l2-6-3-3 1-4 3 3 3 1M10 8l-3 3',
  cycling:
    'M6 12.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM18 12.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM6 16l4-7h5l3 7M10 9l2 7M14 6h2',
  e_scooter: 'M6 15.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5zM18 15.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5zM8.5 18h7l2-12h3',
  coach: 'M2 7h17l3 4v6H2zM2 12h20M6 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M6 7v5M10 7v5M14 7v5',
  train_metro: 'M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM9 13V7l3 3 3-3v6M8 21l2-4M16 21l-2-4',
  tram: 'M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM4 12h16M9 2h6M12 2v4M8 22l2-4M16 22l-2-4',
  train_national: 'M9 3h6a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM6 10h12M9 20l-2 2M15 20l2 2M9 16l-1 4M15 16l1 4',
  car_electric: 'M5 16l1.6-5.2A2 2 0 0 1 8.5 9.4h7a2 2 0 0 1 1.9 1.4L19 16M4 16h16v3H4zM13 2l-2 3h3l-2 3',
  bus_city: 'M6 3h12a2 2 0 0 1 2 2v12H4V5a2 2 0 0 1 2-2zM4 10h16M7 17v3M17 17v3M8 13.5h.01M16 13.5h.01',
  motorbike: 'M5 13.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM19 13.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM5 16.5h5l3-5h4l2 5M13 11.5l-1-3H9M15 8.5h3',
  ferry: 'M3 15l2 4h14l2-4zM6 15V9h12v6M9 9V6h6v3M2 22c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1',
  car_average: 'M5 15l1.6-5.2A2 2 0 0 1 8.5 8.4h7a2 2 0 0 1 1.9 1.4L19 15M4 15h16v3H4zM7 18v2M17 18v2',
  car_petrol: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 9h6M14 8l3 3v6a1.5 1.5 0 0 0 3 0v-7l-3-3',
  car_diesel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M7 8h2a2 2 0 0 1 0 4H7zM14 8l3 3v6a1.5 1.5 0 0 0 3 0v-7l-3-3'
}

export function iconFor(modeKey) {
  return MODE_ICONS[modeKey] ?? FALLBACK_ICON
}

/**
 * Short names for the places a full label will not fit: the pill row, the
 * route strip's end caps, the week planner's day cards.
 *
 * Falls back to the first word of the database label, so an unlisted mode still
 * reads sensibly instead of being blank.
 */
const SHORT_NAMES = {
  walking: 'Walk',
  cycling: 'Bike',
  e_scooter: 'Scooter',
  coach: 'Coach',
  train_metro: 'Metro',
  tram: 'Tram',
  train_national: 'Train',
  car_electric: 'EV',
  bus_city: 'Bus',
  motorbike: 'Moto',
  ferry: 'Ferry',
  car_average: 'Car',
  car_petrol: 'Petrol',
  car_diesel: 'Diesel'
}

export function shortName(modeKey, label = '') {
  return SHORT_NAMES[modeKey] ?? label.split(/[\s(/]/)[0] ?? modeKey
}

/**
 * The imperative that opens the headline: "Take the train and save …".
 * Verbs are per mode because "Take walking" and "Do the train" both read wrong.
 */
const VERBS = {
  walking: 'Walk',
  cycling: 'Cycle',
  e_scooter: 'Ride an e-scooter',
  coach: 'Take a coach',
  train_metro: 'Take the metro',
  tram: 'Take the tram',
  train_national: 'Take the train',
  car_electric: 'Drive electric',
  bus_city: 'Take the bus',
  motorbike: 'Ride a motorbike',
  ferry: 'Take the ferry',
  car_average: 'Drive',
  car_petrol: 'Drive',
  car_diesel: 'Drive'
}

export function verbFor(modeKey, label = '') {
  return VERBS[modeKey] ?? `Take the ${label.toLowerCase()}`
}
