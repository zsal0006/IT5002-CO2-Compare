/**
 * Distance between two points.
 *
 * Primary source is OSRM's public demo server, which gives real road distance
 * and a route geometry we can draw on a map. It is a best-effort service with
 * no availability guarantee, so every call is bounded by a timeout and falls
 * back to a great-circle estimate (NFR-7).
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1'
const TIMEOUT_MS = 3000

/**
 * Detour factor applied to the straight-line distance in fallback mode.
 * Road networks are typically 20-30% longer than the crow flies; 1.25 is the
 * usual mid-point and is stated on screen whenever it is used.
 */
const DETOUR_FACTOR = 1.25

const EARTH_RADIUS_KM = 6371

/**
 * Great-circle distance in kilometres.
 * @param {{lat:number, lon:number}} a
 * @param {{lat:number, lon:number}} b
 */
export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/**
 * @typedef {object} RouteResult
 * @property {number}  km            distance in kilometres
 * @property {boolean} approximate   true when the OSRM call did not succeed
 * @property {Array<[number,number]>|null} geometry [lat, lon] pairs for the map
 * @property {number|null} durationMin driving duration, when OSRM answered
 */

/**
 * @param {{lat:number, lon:number}} from
 * @param {{lat:number, lon:number}} to
 * @param {{profile?: 'driving'|'cycling'|'walking'}} [options]
 * @returns {Promise<RouteResult>}
 */
export async function routeDistance(from, to, options = {}) {
  const profile = options.profile ?? 'driving'
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`
  const url = `${OSRM_BASE}/${profile}/${coords}?overview=simplified&geometries=geojson`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`OSRM responded ${res.status}`)
    const json = await res.json()
    const route = json.routes?.[0]
    if (!route) throw new Error('OSRM returned no route')

    return {
      km: route.distance / 1000,
      approximate: false,
      // GeoJSON is [lon, lat]; Leaflet wants [lat, lon].
      geometry: route.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) ?? null,
      durationMin: route.duration ? route.duration / 60 : null
    }
  } catch (err) {
    console.warn('[CO2 Compare] routing fell back to straight-line distance:', err.message)
    return {
      km: haversineKm(from, to) * DETOUR_FACTOR,
      approximate: true,
      geometry: null,
      durationMin: null
    }
  } finally {
    clearTimeout(timer)
  }
}

export { DETOUR_FACTOR }
