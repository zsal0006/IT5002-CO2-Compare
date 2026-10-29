/**
 * Nominatim (OpenStreetMap) geocoding.
 *
 * Nominatim's usage policy allows at most one request per second and asks that
 * applications identify themselves. We honour both: a module-level queue spaces
 * requests out, and results are cached for the lifetime of the tab so retyping
 * the same place costs nothing.
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const MIN_INTERVAL_MS = 1100
const CONTACT = import.meta.env.VITE_APP_CONTACT || 'co2-compare-it5002'

const cache = new Map()
let lastCallAt = 0
let chain = Promise.resolve()

/** Serialises calls and keeps them at least MIN_INTERVAL_MS apart. */
function throttle(fn) {
  chain = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCallAt = Date.now()
    return fn()
  })
  return chain
}

/**
 * @typedef {object} Place
 * @property {string} label     human-readable name shown back to the user
 * @property {number} lat
 * @property {number} lon
 * @property {string} countryCode ISO 3166-1 alpha-2, uppercase, or 'ZZ'
 * @property {string|null} region state or province, used for the community
 *   totals (E4.1). Null when the geocoder does not report one.
 */

/**
 * Resolve free text to up to `limit` candidate places.
 * Returns [] when nothing matches. Throws only on network/server failure.
 *
 * @param {string} query
 * @param {{limit?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<Place[]>}
 */
export async function geocode(query, options = {}) {
  const q = query.trim()
  if (q.length < 2) return []

  const limit = options.limit ?? 5
  const cacheKey = `${q.toLowerCase()}|${limit}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const results = await throttle(async () => {
    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit)
    })
    const res = await fetch(`${ENDPOINT}?${params}`, {
      signal: options.signal,
      headers: { Accept: 'application/json', 'Accept-Language': 'en' },
      referrerPolicy: 'strict-origin-when-cross-origin'
    })
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
    const json = await res.json()
    return json.map(toPlace)
  })

  cache.set(cacheKey, results)
  return results
}

function toPlace(raw) {
  const address = raw.address ?? {}
  return {
    label: raw.display_name,
    lat: Number(raw.lat),
    lon: Number(raw.lon),
    countryCode: (address.country_code || 'ZZ').toUpperCase(),
    // Nominatim names this differently by country: `state` in most federal
    // countries, `region` or `county` elsewhere. We take the first that exists
    // and stop there -- nothing finer than a province is recorded (E6.2).
    region: address.state || address.region || address.county || null
  }
}

/**
 * Reverse-geocode a browser geolocation fix into a Place (E1.2).
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Place|null>}
 */
export async function reverseGeocode(lat, lon) {
  return throttle(async () => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '16'
    })
    const res = await fetch(`${REVERSE_ENDPOINT}?${params}`, {
      headers: { Accept: 'application/json', 'Accept-Language': 'en' },
      referrerPolicy: 'strict-origin-when-cross-origin'
    })
    if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`)
    const json = await res.json()
    return json?.lat ? toPlace(json) : null
  })
}

/**
 * Ask the browser where we are, then name the place. Requires a user gesture and
 * an explicit permission grant; we never poll for location in the background.
 * @returns {Promise<Place>}
 */
export function currentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot report your location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const place = await reverseGeocode(coords.latitude, coords.longitude)
          if (!place) throw new Error('We could not name your current location.')
          resolve(place)
        } catch (err) {
          reject(err)
        }
      },
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
}

/** Shorten a Nominatim display_name to something that fits in a chip. */
export function shortLabel(place, parts = 3) {
  if (!place?.label) return ''
  return place.label.split(',').slice(0, parts).join(',').trim()
}

/** Exposed for tests. */
export function _clearCache() {
  cache.clear()
}

// Nominatim and OSRM both require this attribution wherever their data is shown.
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'
export const CONTACT_STRING = CONTACT
