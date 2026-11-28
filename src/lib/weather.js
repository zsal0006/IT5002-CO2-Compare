import { invokeEdgeFunction } from '@/lib/edgeFunctions'

const TIMEOUT_MS = 6000

/** Current conditions at a point, via the `weather` Edge Function (WeatherAPI). */
export function fetchWeather({ lat, lon }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return invokeEdgeFunction('weather', { lat, lon }, { signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

const LABELS = { good: 'Good day for it', fair: 'Fair conditions', poor: 'Not ideal' }

/**
 * Thresholds per mode. Cycling is stricter than walking: wind, wet roads and
 * cold hands matter more at speed. Each rule is [rating, test, reason].
 */
const RULES = {
  walking: [
    ['poor', (w) => w.precipMm >= 2 || w.rainChancePct >= 70, 'rain likely'],
    ['poor', (w) => w.feelsLikeC >= 35, 'very hot'],
    ['poor', (w) => w.feelsLikeC <= 0, 'freezing'],
    ['poor', (w) => w.gustKph >= 60, 'strong gusts'],
    ['fair', (w) => w.precipMm > 0.2 || w.rainChancePct >= 40, 'chance of rain'],
    ['fair', (w) => w.feelsLikeC >= 30, 'hot'],
    ['fair', (w) => w.feelsLikeC <= 5, 'cold'],
    ['fair', (w) => w.windKph >= 40, 'windy'],
    ['fair', (w) => w.uv >= 8, 'high UV']
  ],
  cycling: [
    ['poor', (w) => w.precipMm >= 1 || w.rainChancePct >= 60, 'rain likely'],
    ['poor', (w) => w.feelsLikeC >= 35, 'very hot'],
    ['poor', (w) => w.feelsLikeC <= 2, 'near freezing'],
    ['poor', (w) => w.windKph >= 35 || w.gustKph >= 50, 'strong wind'],
    ['fair', (w) => w.precipMm > 0 || w.rainChancePct >= 30, 'chance of rain'],
    ['fair', (w) => w.feelsLikeC >= 30, 'hot'],
    ['fair', (w) => w.feelsLikeC <= 7, 'cold'],
    ['fair', (w) => w.windKph >= 25, 'windy'],
    ['fair', (w) => w.uv >= 8, 'high UV'],
    ['fair', (w) => w.isDay === false, 'after dark']
  ]
}

/**
 * Rate walking and cycling for the given conditions.
 * @returns {{[mode: string]: {rating: 'good'|'fair'|'poor', label: string, reasons: string[]}}}
 */
export function assessWeather(weather) {
  if (!weather) return {}
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const w = {
    ...weather,
    precipMm: num(weather.precipMm),
    rainChancePct: num(weather.rainChancePct),
    feelsLikeC: num(weather.feelsLikeC ?? weather.tempC),
    windKph: num(weather.windKph),
    gustKph: num(weather.gustKph),
    uv: num(weather.uv)
  }
  const out = {}
  for (const [mode, rules] of Object.entries(RULES)) {
    const hits = rules.filter(([, test]) => test(w))
    const rating = ['poor', 'fair'].find((r) => hits.some(([level]) => level === r)) ?? 'good'
    out[mode] = {
      rating,
      label: LABELS[rating],
      reasons: hits.filter(([level]) => level === rating).map(([, , reason]) => reason)
    }
  }
  return out
}
