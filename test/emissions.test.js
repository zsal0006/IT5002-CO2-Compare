import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { carEquivalentKm, compare, emissionsKg, savedKg } from '../src/lib/emissions.js'

// Decimal reference values calculated independently from the five published
// factors (g CO2e per passenger-km). Keep full precision until display time.
const referenceTrips = JSON.parse(readFileSync(new URL('./fixtures/reference-trips.json', import.meta.url), 'utf8'))
const factors = [
  { mode_key: 'bus_city', mode_label: 'Bus', category: 'public_transport', factor_g_per_pkm: '97.00', is_baseline: false },
  { mode_key: 'car_average', mode_label: 'Car', category: 'car', factor_g_per_pkm: '170.00', is_baseline: true },
  { mode_key: 'walking', mode_label: 'Walking', category: 'active', factor_g_per_pkm: '0.00', is_baseline: false },
  { mode_key: 'train_national', mode_label: 'Train', category: 'public_transport', factor_g_per_pkm: '35.00', is_baseline: false },
  { mode_key: 'cycling', mode_label: 'Cycling', category: 'active', factor_g_per_pkm: '0.00', is_baseline: false }
]

function assertKg(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected} kg, got ${actual} kg`)
}

for (const trip of referenceTrips) {
  test(`five modes match the reference emissions and savings at ${trip.distanceKm} km`, () => {
    const expected = {
      car_average: [trip.carKg, 0],
      bus_city: [trip.busKg, trip.busSavedKg],
      train_national: [trip.trainKg, trip.trainSavedKg],
      cycling: [0, trip.carKg],
      walking: [0, trip.carKg]
    }
    const results = compare(trip.distanceKm, factors)
    assert.deepEqual(results.map(row => row.modeKey).sort(), Object.keys(expected).sort())
    for (const row of results) {
      const [emitted, saved] = expected[row.modeKey]
      assertKg(row.kg, emitted, `${row.modeKey} emissions`)
      assertKg(row.savedVsBaselineKg, saved, `${row.modeKey} saving`)
    }
  })
}

test('both active modes share the lowest emissions and only the car is the baseline', () => {
  const results = compare(10, factors)
  assert.deepEqual(results.map(row => row.modeKey), ['cycling', 'walking', 'train_national', 'bus_city', 'car_average'])
  assert.deepEqual(results.filter(row => row.kg === results[0].kg).map(row => row.modeKey), ['cycling', 'walking'])
  assert.deepEqual(results.filter(row => row.isBaseline).map(row => row.modeKey), ['car_average'])
})

test('a zero-length journey emits and saves zero for every mode', () => {
  const results = compare(0, factors)
  assert.equal(results.length, 5)
  for (const row of results) {
    assert.equal(row.kg, 0)
    assert.equal(row.savedVsBaselineKg, 0)
  }
})

test('negative, missing and non-finite inputs yield zero emissions', () => {
  for (const invalid of [-1, null, undefined, NaN, Infinity]) {
    assert.equal(emissionsKg(invalid, 170), 0)
    assert.equal(emissionsKg(10, invalid), 0)
  }
})

test('savings use the supplied baseline and cannot fall below zero', () => {
  assertKg(savedKg(10, 35, 200), 1.65, 'alternative baseline')
  assert.equal(savedKg(10, 200, 170), 0)
  assert.equal(savedKg(10, 170, 170), 0)
})

test('equivalent car distance uses the baseline factor and guards against an invalid divisor', () => {
  assert.equal(carEquivalentKm(10, 85, 170), 5)
  assert.equal(carEquivalentKm(10, 0, 170), 0)
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.equal(carEquivalentKm(10, 85, invalid), 0)
  }
})
