/**
 * Nominatim (OpenStreetMap) geocoding.
 *
 * Nominatim's usage policy allows at most one request per second and asks that
 * applications identify themselves. We honour both: a module-level queue spaces
 * requests out, and results are cached for the lifetime of the tab so retyping
 * the same place costs nothing.
 *
 * We do not send a contact address. The policy's "identify your application"
 * rule is aimed at server-side callers that set a User-Agent; browsers forbid
 * JavaScript from setting that header, and Nominatim identifies browser traffic
 * by Referer, which the browser sends on its own. Putting a contact address in a
 * VITE_ variable would compile a real email into a public bundle and send it
 * nowhere.
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const MIN_INTERVAL_MS = 1100

const cache = new Map()
let lastCallAt = 0
let chain = Promise.resolve()

/** Thrown when a queued request was superseded before it ran. */
export class SupersededError extends Error {
  constructor() {
    super('superseded')
    this.name = 'SupersededError'
  }
}

/**
 * Serialises calls and keeps them at least MIN_INTERVAL_MS apart, as Nominatim's
 * usage policy requires.
 *
 * The abort check matters as much as the spacing. Someone typing an address
 * pauses several times, and each pause would otherwise add a request to the
 * queue, every one of them waiting a further second behind the last — so the
 * result for what you finally typed arrives five seconds late. Checking the
 * signal both before the wait and after it means a superseded request leaves the
 * queue immediately instead of consuming a slot, and only the latest query is
 * ever actually sent.
 */
function throttle(fn, signal) {
  const run = async () => {
    if (signal?.aborted) throw new SupersededError()
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    if (signal?.aborted) throw new SupersededError()
    lastCallAt = Date.now()
    return fn()
  }
  chain = chain.then(run, run)
  // Keep the stored chain from staying rejected, which would otherwise make the
  // next caller inherit this one's failure.
  const result = chain
  chain = chain.catch(() => {})
  return result
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
 * How far around the bias point Nominatim is asked to prefer results, in
 * degrees. Roughly 330 km at the equator and less towards the poles — generous
 * for a commute without being so wide it stops meaning anything.
 */
const BIAS_DEGREES = 3

/**
 * Resolve free text to up to `limit` candidate places.
 * Returns [] when nothing matches. Throws only on network/server failure.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.limit]
 * @param {AbortSignal} [options.signal]
 * @param {Place|null} [options.bias] prefer results near this place and in its
 *   country. Preference only — a destination in another country still appears,
 *   just below the local matches, so cross-border journeys keep working.
 * @returns {Promise<Place[]>}
 */
export async function geocode(query, options = {}) {
  const q = query.trim()
  if (q.length < 2) return []

  const limit = options.limit ?? 5
  const bias = options.bias ?? null
  // The bias changes the result order, so it has to be part of the cache key.
  const biasKey = bias ? `${bias.countryCode}@${bias.lat.toFixed(2)},${bias.lon.toFixed(2)}` : '-'
  const cacheKey = `${q.toLowerCase()}|${limit}|${biasKey}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const results = await throttle(async () => {
    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      // Ask for more than we show when biasing: a local match can sit outside
      // the top five of an unbiased relevance ranking.
      limit: String(bias ? Math.max(limit * 2, 10) : limit)
    })

    if (bias) {
      const { lat, lon } = bias
      // viewbox without bounded=1 is a preference, not a filter.
      params.set(
        'viewbox',
        [lon - BIAS_DEGREES, lat + BIAS_DEGREES, lon + BIAS_DEGREES, lat - BIAS_DEGREES].join(',')
      )
    }
    const res = await fetch(`${ENDPOINT}?${params}`, {
      signal: options.signal,
      headers: { Accept: 'application/json', 'Accept-Language': 'en' },
      referrerPolicy: 'strict-origin-when-cross-origin'
    })
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
    const json = await res.json()
    return rank(json.map(toPlace), bias).slice(0, limit)
  }, options.signal)

  cache.set(cacheKey, results)
  return results
}

/**
 * Put matches in the bias country first, keeping Nominatim's relevance order
 * within each group (Array.sort is stable). Server-side viewbox preference is
 * fuzzy, so this makes the country part explicit and predictable.
 */
function rank(places, bias) {
  if (!bias?.countryCode || bias.countryCode === 'ZZ') return places
  return [...places].sort(
    (a, b) =>
      (a.countryCode === bias.countryCode ? 0 : 1) - (b.countryCode === bias.countryCode ? 0 : 1)
  )
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
