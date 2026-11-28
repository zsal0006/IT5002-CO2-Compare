import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const mocks = {
  '@/lib/routing': 'export const routeDistance = (...args) => globalThis.tripTest.routeDistance(...args)',
  '@/lib/weather': 'export const fetchWeather = async () => null',
  '@/stores/factors': 'export const useFactorsStore = () => ({ factors: globalThis.tripTest.factors })',
  '@/lib/supabase': 'export const supabaseConfigured = true; export const supabase = { rpc: (...args) => globalThis.tripTest.rpc(...args) }'
}
const bundled = await build({
  stdin: {
    contents: "export { useTripStore } from './src/stores/trip.js'; export { createPinia, setActivePinia } from 'pinia'; export { nextTick } from 'vue'",
    resolveDir: root
  },
  plugins: [{
    name: 'trip-test-mocks',
    setup(builder) {
      builder.onResolve({ filter: /^@\/(lib\/routing|lib\/weather|stores\/factors|lib\/supabase)$/ }, (args) => ({
        path: args.path,
        namespace: 'mock'
      }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({ contents: mocks[args.path] }))
      builder.onResolve({ filter: /^@\/lib\/emissions$/ }, () => ({
        path: fileURLToPath(new URL('../src/lib/emissions.js', import.meta.url))
      }))
    }
  }],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm'
})
const { useTripStore, createPinia, setActivePinia, nextTick } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function setup(t, routeDistance) {
  globalThis.tripTest = {
    routeDistance,
    factors: [
      { mode_key: 'cycling', factor_g_per_pkm: 0 },
      { mode_key: 'walking', factor_g_per_pkm: 0 },
      { mode_key: 'bus_city', factor_g_per_pkm: 97 },
      { mode_key: 'train_national', factor_g_per_pkm: 35 },
      { mode_key: 'car_average', factor_g_per_pkm: 170, is_baseline: true }
    ],
    rpc: async () => ({ data: [], error: null })
  }
  t.after(() => { delete globalThis.tripTest })
  setActivePinia(createPinia())
  const trip = useTripStore()
  trip.origin = { lat: -33.8, lon: 151.2 }
  trip.destination = { lat: -33.9, lon: 151.3 }
  return trip
}

test('planner retains one-way distance when a return trip is selected', async (t) => {
  const trip = setup(t, async () => ({ km: 10, approximate: false, attribution: 'route credit' }))
  await nextTick()
  await trip.calculate()
  assert.equal(trip.distanceKm, 10)
  assert.equal(trip.effectiveKm, 10)
  trip.returnTrip = true
  await nextTick()
  assert.equal(trip.distanceKm, 10)
  assert.equal(trip.effectiveKm, 20)
  assert.equal(trip.comparison.length, 5)
})

test('changing a location while routing prevents stale results', async (t) => {
  const route = deferred()
  const trip = setup(t, () => route.promise)
  await nextTick()
  const calculation = trip.calculate()
  trip.destination = { lat: -34, lon: 151.4 }
  await nextTick()
  route.resolve({ km: 10, approximate: false, attribution: 'route credit' })
  await calculation
  assert.equal(trip.distanceKm, null)
  assert.equal(trip.routeAttribution, null)
  assert.equal(trip.calculating, false)
  assert.deepEqual(trip.comparison, [])
})

test('zero-distance journeys show an error instead of a comparison', async (t) => {
  const trip = setup(t, async () => ({ km: 0, approximate: true, attribution: null }))
  await nextTick()
  await trip.calculate()
  assert.equal(trip.distanceKm, null)
  assert.match(trip.error, /distance must be at least 0.01 km/)
  assert.deepEqual(trip.comparison, [])
})

test('a late comparison response cannot replace the current return-trip figures', async (t) => {
  const trip = setup(t, async () => ({ km: 10, approximate: false, attribution: null }))
  const oneWay = deferred()
  const returnWay = deferred()
  globalThis.tripTest.rpc = (_, { p_distance_km }) => p_distance_km === 10 ? oneWay.promise : returnWay.promise
  const rows = (kg) => globalThis.tripTest.factors.map((factor) => ({
    ...factor,
    kg,
    saved_vs_baseline_kg: 0
  }))
  await nextTick()
  const calculation = trip.calculate()
  await nextTick()
  trip.returnTrip = true
  await nextTick()
  returnWay.resolve({ data: rows(20), error: null })
  await nextTick()
  await nextTick()
  assert.equal(trip.comparison[0].kg, 20)
  oneWay.resolve({ data: rows(10), error: null })
  await calculation
  assert.equal(trip.comparison[0].kg, 20)
})

test('comparison and logging use the same rounded distance, including return trips', async (t) => {
  const calls = []
  const trip = setup(t, async () => ({ km: 10.126, approximate: false, attribution: null }))
  globalThis.tripTest.rpc = async (name, args) => {
    calls.push({ name, ...args })
    return name === 'log_trip' ? { data: { saved_kg: 3.443 }, error: null } : { data: [], error: null }
  }
  trip.returnTrip = true
  await nextTick()
  await trip.calculate()
  assert.equal(trip.effectiveKm, 20.25)
  assert.equal(trip.comparison.find((mode) => mode.modeKey === 'walking').savedVsBaselineKg, 3.4425)
  assert.equal((await trip.logTrip('walking')).savedKg, 3.443)
  assert.equal(calls.find((call) => call.name === 'compare_journey').p_distance_km, 20.25)
  assert.equal(calls.find((call) => call.name === 'log_trip').p_distance_km, 20.25)
  assert.equal(trip.sessionTrips, 1)
  assert.equal(trip.sessionSavedKg, 3.443)
})

test('a route rounding to zero is not offered for logging', async (t) => {
  const trip = setup(t, async () => ({ km: 0.004 }))
  globalThis.tripTest.rpc = () => { throw new Error('RPC must not be called') }
  await nextTick()
  await trip.calculate()
  assert.equal(trip.distanceKm, null)
  assert.match(trip.error, /at least 0.01 km/)
})
