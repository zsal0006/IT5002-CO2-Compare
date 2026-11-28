import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../supabase/functions/address-search/index.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'neutral',
  format: 'esm'
})

let handler
const originalDeno = globalThis.Deno
globalThis.Deno = {
  serve: (callback) => { handler = callback },
  env: { get: (name) => name === 'GEOAPIFY_API_KEY' ? 'test-key' : undefined }
}
try {
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
} finally {
  globalThis.Deno = originalDeno
}

function request(body) {
  return new Request('http://localhost/address-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

const feature = {
  type: 'Feature',
  properties: {
    formatted: '1 Example Street, Sydney NSW, Australia',
    country_code: 'au',
    state: 'New South Wales',
    datasource: {
      attribution: '© OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright'
    }
  },
  geometry: { type: 'Point', coordinates: [151.2, -33.8] }
}

test('address proxy forwards Australian geocoding and preserves coordinates and attribution', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/v1/geocode/search')
    assert.equal(parsed.searchParams.get('text'), '1 Example Street')
    assert.equal(parsed.searchParams.get('filter'), 'countrycode:au')
    assert.equal(parsed.searchParams.get('limit'), '5')
    return Response.json({ features: [feature] })
  })
  globalThis.Deno = { env: { get: () => 'test-key' } }
  t.after(() => { globalThis.Deno = originalDeno })
  const response = await handler(request({ query: ' 1 Example Street ' }))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).places, [{
    label: feature.properties.formatted,
    lon: 151.2,
    lat: -33.8,
    countryCode: 'AU',
    region: 'New South Wales',
    attribution: {
      text: '© OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright'
    }
  }])
})

test('reverse geocoding sends lat and lon and ignores non-Australian results', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/v1/geocode/reverse')
    assert.equal(parsed.searchParams.get('lat'), '-33.8')
    assert.equal(parsed.searchParams.get('lon'), '151.2')
    return Response.json({ features: [
      { ...feature, properties: { ...feature.properties, country_code: 'nz' } },
      feature
    ] })
  })
  globalThis.Deno = { env: { get: () => 'test-key' } }
  t.after(() => { globalThis.Deno = originalDeno })
  const response = await handler(request({ latitude: -33.8, longitude: 151.2 }))
  const places = (await response.json()).places
  assert.equal(places.length, 1)
  assert.equal(places[0].lat, -33.8)
  assert.equal(places[0].lon, 151.2)
  assert.equal(places[0].attribution.text, '© OpenStreetMap contributors')
})

test('empty result sets remain empty', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ features: [] }))
  globalThis.Deno = { env: { get: () => 'test-key' } }
  t.after(() => { globalThis.Deno = originalDeno })
  const response = await handler(request({ query: 'No matching address' }))
  assert.deepEqual((await response.json()).places, [])
})

test('invalid inputs do not reach the provider', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Unexpected provider request')
  })
  globalThis.Deno = { env: { get: () => 'test-key' } }
  t.after(() => { globalThis.Deno = originalDeno })
  assert.equal((await handler(request({ query: 'ab' }))).status, 400)
  assert.equal((await handler(request({ latitude: 0, longitude: 0 }))).status, 400)
  assert.equal((await handler(request(null))).status, 400)
  const malformed = await handler(new Request('http://localhost/address-search', {
    method: 'POST', body: '{'
  }))
  assert.equal(malformed.status, 400)
  assert.deepEqual(await malformed.json(), { error: 'Request body must be valid JSON.' })
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('missing source attribution and provider failures are reported', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({
    features: [{ ...feature, properties: { ...feature.properties, datasource: {} } }]
  }))
  globalThis.Deno = { env: { get: () => 'test-key' } }
  t.after(() => { globalThis.Deno = originalDeno })
  assert.equal((await handler(request({ query: 'Sydney' }))).status, 502)
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 429 }))
  assert.equal((await handler(request({ query: 'Sydney' }))).status, 502)
})
