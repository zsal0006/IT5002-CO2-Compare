import assert from 'node:assert/strict'
import test from 'node:test'
import { carEquivalentKm, compare, emissionsKg, MODE_KEYS } from '../src/lib/emissions.js'
import { FALLBACK_FACTORS } from '../src/lib/fallbackFactors.js'
import { caloriesBurned, treeAbsorptionDays } from '../src/lib/journeyImpact.js'

test('fallback factors contain exactly the supported modes', () => {
  assert.deepEqual(
    new Set(FALLBACK_FACTORS.map((factor) => factor.mode_key)),
    new Set(MODE_KEYS)
  )
})

test('comparison returns emissions for all supported modes', () => {
  const modes = compare(10, FALLBACK_FACTORS)

  assert.deepEqual(new Set(modes.map((mode) => mode.modeKey)), new Set(MODE_KEYS))
  assert.equal(modes.find((mode) => mode.modeKey === 'car_average').kg, emissionsKg(10, 170))
})

test('car-equivalent distance compares equal emissions in distance units', () => {
  assert.equal(carEquivalentKm(10, 170, 170), 10)
  assert.equal(carEquivalentKm(10, 0, 170), 0)
  assert.equal(carEquivalentKm(10, 97, 170), (10 * 97) / 170)
})

test('invalid inputs do not produce invalid equivalent distances', () => {
  assert.equal(carEquivalentKm(Number.NaN, 97, 170), 0)
  assert.equal(carEquivalentKm(10, 97, 0), 0)
})

test('active-mode energy estimates use distance and return zero for other modes', () => {
  assert.equal(caloriesBurned('cycling', 15), 525)
  assert.equal(caloriesBurned('walking', 4.8), 245)
  assert.equal(caloriesBurned('bus_city', 10), 0)
  assert.equal(caloriesBurned('walking', Number.NaN), 0)
})

test('tree absorption time is an equivalent, not a count of trees', () => {
  assert.equal(treeAbsorptionDays(21.8), 365)
  assert.equal(treeAbsorptionDays(0), 0)
  assert.equal(treeAbsorptionDays(Number.NaN), 0)
})
