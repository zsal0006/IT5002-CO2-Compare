import { handleOptions, jsonResponse, rateLimit, readJsonObject } from '../_shared/http.ts'

const WEATHER_URL = 'https://api.weatherapi.com/v1/forecast.json'
const REQUEST_TIMEOUT_MS = 8000
const REQUESTS_PER_MINUTE = 20

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

Deno.serve(async (request: Request) => {
  const optionsResponse = handleOptions(request)
  if (optionsResponse) return optionsResponse
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  const limited = rateLimit(request, 'weather', REQUESTS_PER_MINUTE)
  if (limited) return limited

  const body = await readJsonObject(request)
  if (body instanceof Response) return body

  if (!inRange(body.lat, -90, 90) || !inRange(body.lon, -180, 180)) {
    return jsonResponse({ error: 'A valid latitude and longitude are required.' }, 400)
  }

  const apiKey = Deno.env.get('WEATHER_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'Weather is not configured.' }, 500)

  // Two decimal places (~1 km) is plenty for weather and avoids forwarding an exact address.
  const query = `${body.lat.toFixed(2)},${body.lon.toFixed(2)}`
  const url = `${WEATHER_URL}?${new URLSearchParams({ key: apiKey, q: query, days: '1', aqi: 'no', alerts: 'no' })}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      console.error(`[weather] WeatherAPI returned ${response.status}.`)
      return jsonResponse({ error: 'Weather is temporarily unavailable.' }, 502)
    }

    const result = await response.json()
    const current = result.current
    const day = result.forecast?.forecastday?.[0]?.day
    if (!current || typeof current.temp_c !== 'number') {
      return jsonResponse({ error: 'Weather is temporarily unavailable.' }, 502)
    }

    return jsonResponse({
      tempC: current.temp_c,
      feelsLikeC: current.feelslike_c,
      windKph: current.wind_kph,
      gustKph: current.gust_kph,
      precipMm: current.precip_mm,
      uv: current.uv,
      isDay: current.is_day === 1,
      condition: current.condition?.text ?? '',
      rainChancePct: day?.daily_chance_of_rain ?? 0
    })
  } catch (error) {
    console.error('[weather] Provider request failed.', error instanceof Error ? error.name : 'Unknown error')
    return jsonResponse({ error: 'Weather is temporarily unavailable.' }, 502)
  } finally {
    clearTimeout(timer)
  }
})
