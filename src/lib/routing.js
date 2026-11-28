import { invokeEdgeFunction } from '@/lib/edgeFunctions'

const TIMEOUT_MS = 8000

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
 * @property {boolean} approximate   true when the OpenRouteService call failed
 * @property {string|null} attribution
 */

/**
 * @param {{lat:number, lon:number}} from
 * @param {{lat:number, lon:number}} to
 * @returns {Promise<RouteResult>}
 */
export async function routeDistance(from, to) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const result = await invokeEdgeFunction(
      'route-distance',
      {
        profile: 'driving-car',
        coordinates: [
          [from.lon, from.lat],
          [to.lon, to.lat]
        ]
      },
      { signal: controller.signal }
    )
    if (typeof result.distance !== 'number' || !Number.isFinite(result.distance) || result.distance <= 0) {
      throw new Error('OpenRouteService returned an invalid route distance.')
    }

    return {
      km: result.distance / 1000,
      approximate: false,
      attribution: result.attribution || null
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[CO2 Compare] routing fell back to straight-line distance:', err.message)
    }
    return {
      km: haversineKm(from, to) * DETOUR_FACTOR,
      approximate: true,
      attribution: null
    }
  } finally {
    clearTimeout(timer)
  }
}

export { DETOUR_FACTOR }
