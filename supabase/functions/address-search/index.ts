import { handleOptions, jsonResponse, readJsonObject } from '../_shared/http.ts'

const GEOAPIFY_BASE_URL = 'https://api.geoapify.com/v1/geocode'
const REQUEST_TIMEOUT_MS = 8000

Deno.serve(async (request: Request) => {
  const optionsResponse = handleOptions(request)
  if (optionsResponse) return optionsResponse
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const body = await readJsonObject(request)
  if (body instanceof Response) return body

  const apiKey = Deno.env.get('GEOAPIFY_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'Address search is not configured.' }, 500)

  let path: string
  const params = new URLSearchParams({ apiKey, format: 'geojson' })
  if (typeof body.query === 'string') {
    const query = body.query.trim()
    const limit = body.limit ?? 5
    if (query.length < 3 || query.length > 200) {
      return jsonResponse({ error: 'Address searches must be 3 to 200 characters.' }, 400)
    }
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      return jsonResponse({ error: 'Result limit must be between 1 and 20.' }, 400)
    }
    path = 'search'
    params.set('text', query)
    params.set('filter', 'countrycode:au')
    params.set('limit', String(limit))
  } else if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
    if (
      !Number.isFinite(body.latitude) ||
      !Number.isFinite(body.longitude) ||
      body.latitude < -45 ||
      body.latitude > -8 ||
      body.longitude < 96 ||
      body.longitude > 168
    ) {
      return jsonResponse({ error: 'Reverse geocoding is available in Australia only.' }, 400)
    }
    path = 'reverse'
    params.set('lat', String(body.latitude))
    params.set('lon', String(body.longitude))
    params.set('limit', '1')
  } else {
    return jsonResponse({ error: 'Provide a query or Australian coordinates.' }, 400)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${GEOAPIFY_BASE_URL}/${path}?${params}`, {
      signal: controller.signal
    })
    if (!response.ok) {
      console.error(`[address-search] Geoapify returned ${response.status}.`)
      return jsonResponse({ error: 'Address search is temporarily unavailable.' }, 502)
    }

    const result = await response.json()
    if (!Array.isArray(result?.features)) {
      console.error('[address-search] Geoapify returned an invalid response.')
      return jsonResponse({ error: 'Address search returned incomplete data.' }, 502)
    }

    const places = []
    for (const feature of result.features) {
      const properties = feature?.properties
      const coordinates = feature?.geometry?.coordinates
      if (properties?.country_code?.toLowerCase() !== 'au') continue
      if (
        typeof properties.formatted !== 'string' ||
        !properties.formatted ||
        !Array.isArray(coordinates) ||
        typeof coordinates[0] !== 'number' ||
        !Number.isFinite(coordinates[0]) ||
        typeof coordinates[1] !== 'number' ||
        !Number.isFinite(coordinates[1])
      ) continue

      const source = properties.datasource
      if (typeof source?.attribution !== 'string' || !source.attribution.trim()) {
        console.error('[address-search] Geoapify result did not include data-source attribution.')
        return jsonResponse({ error: 'Address search returned incomplete data.' }, 502)
      }

      let sourceUrl: string | null = null
      if (typeof source.url === 'string') {
        try {
          const parsed = new URL(source.url)
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') sourceUrl = parsed.href
        } catch {
          console.warn('[address-search] Geoapify returned an invalid data-source URL.')
        }
      }

      places.push({
        label: properties.formatted,
        lat: coordinates[1],
        lon: coordinates[0],
        countryCode: 'AU',
        region: typeof properties.state === 'string' ? properties.state : null,
        attribution: { text: source.attribution, url: sourceUrl }
      })
    }
    return jsonResponse({ places })
  } catch (error) {
    console.error(
      '[address-search] Provider request failed.',
      error instanceof Error ? error.name : 'Unknown error'
    )
    return jsonResponse({ error: 'Address search is temporarily unavailable.' }, 502)
  } finally {
    clearTimeout(timer)
  }
})
