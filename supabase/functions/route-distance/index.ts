import { handleOptions, jsonResponse, readJsonObject } from '../_shared/http.ts'

const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions'
const REQUEST_TIMEOUT_MS = 10000
const PROFILES = new Set(['driving-car', 'cycling-regular', 'foot-walking'])

Deno.serve(async (request: Request) => {
  const optionsResponse = handleOptions(request)
  if (optionsResponse) return optionsResponse
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const body = await readJsonObject(request)
  if (body instanceof Response) return body

  const profile = body.profile
  const coordinates = body.coordinates
  if (
    typeof profile !== 'string' ||
    !PROFILES.has(profile) ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !coordinates.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === 'number' &&
        Number.isFinite(point[0]) &&
        point[0] >= 96 &&
        point[0] <= 168 &&
        typeof point[1] === 'number' &&
        Number.isFinite(point[1]) &&
        point[1] >= -45 &&
        point[1] <= -8
    )
  ) {
    return jsonResponse(
      { error: 'A supported profile and two Australian coordinates are required.' },
      400
    )
  }

  const apiKey = Deno.env.get('ORS_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'Routing is not configured.' }, 500)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${ORS_BASE_URL}/${profile}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates })
    })

    if (!response.ok) {
      console.error(`[route-distance] OpenRouteService returned ${response.status}.`)
      return jsonResponse({ error: 'Routing is temporarily unavailable.' }, 502)
    }

    const result = await response.json()
    const distance = result.routes?.[0]?.summary?.distance
    if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) {
      console.error('[route-distance] OpenRouteService returned no valid route distance.')
      return jsonResponse({ error: 'No route was found for those locations.' }, 502)
    }

    return jsonResponse({
      distance,
      attribution:
        typeof result.metadata?.attribution === 'string' ? result.metadata.attribution : null
    })
  } catch (error) {
    console.error(
      '[route-distance] Provider request failed.',
      error instanceof Error ? error.name : 'Unknown error'
    )
    return jsonResponse({ error: 'Routing is temporarily unavailable.' }, 502)
  } finally {
    clearTimeout(timer)
  }
})
