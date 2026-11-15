import { invokeEdgeFunction } from '@/lib/edgeFunctions'

const cache = new Map()

/**
 * @typedef {object} Place
 * @property {string} label
 * @property {number} lat
 * @property {number} lon
 * @property {'AU'} countryCode
 * @property {string|null} region
 * @property {{text:string, url:string|null}} attribution
 */

/**
 * Return Australian places from Geoapify forward geocoding.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.limit]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Place[]>}
 */
export async function geocode(query, options = {}) {
  const q = query.trim()
  if (q.length < 3) return []

  options.signal?.throwIfAborted()
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 20)
  const cacheKey = `${q.toLowerCase()}|${limit}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const response = await invokeEdgeFunction(
    'address-search',
    { query: q, limit },
    { signal: options.signal }
  )

  options.signal?.throwIfAborted()

  if (!Array.isArray(response.places)) throw new Error('Address search returned invalid results.')
  const places = response.places

  cache.set(cacheKey, places)
  return places
}

/**
 * Reverse-geocode an Australian browser location.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Place|null>}
 */
export async function reverseGeocode(lat, lon) {
  const response = await invokeEdgeFunction('address-search', {
    latitude: lat,
    longitude: lon
  })
  if (!Array.isArray(response.places)) throw new Error('Address search returned invalid results.')
  return response.places[0] ?? null
}

/**
 * Ask the browser where we are, then name the place. Requires a user gesture and
 * an explicit permission grant; we never poll for location in the background.
 * @returns {Promise<Place>}
 */
export async function currentLocation() {
  const coords = await new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot report your location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      (err) => {
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location access was declined. Type a start location instead.'
              : 'We could not get your location. Type a start location instead.'
          )
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  })
  const place = await reverseGeocode(coords.latitude, coords.longitude)
  if (!place) throw new Error('We could not name your current location.')
  return place
}

/** Shorten an address to something that fits in a chip. */
export function shortLabel(place, parts = 3) {
  if (!place?.label) return ''
  return place.label.split(',').slice(0, parts).join(',').trim()
}
