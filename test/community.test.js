import assert from 'node:assert/strict'
import test from 'node:test'
import { milestoneFor, summariseModes } from '../src/lib/community.js'

test('mode totals include car trips while car-free counts and distances include only alternatives', () => {
  // The Supabase views return one aggregate per mode, including numeric strings.
  const rows = [
    { category: 'car', trips: '3', total_saved_kg: '0', total_distance_km: '30' },
    { category: 'public_transport', trips: '2', total_saved_kg: '1.46', total_distance_km: '20' },
    { category: 'active', trips: 4, total_saved_kg: '1.36', total_distance_km: 8 }
  ]
  const totals = summariseModes(rows)
  assert.equal(totals.trips, 9)
  assert.equal(totals.carFreeTrips, 6)
  assert.equal(totals.carFreeKm, 28)
  assert.ok(Math.abs(totals.savedKg - 2.82) < 1e-9)
})

test('an empty scope and a scope containing only car trips have no car-free kilometres', () => {
  assert.deepEqual(summariseModes([]), { trips: 0, savedKg: 0, carFreeTrips: 0, carFreeKm: 0 })
  const cars = [{ category: 'car', trips: 2, total_saved_kg: 0, total_distance_km: 12 }]
  assert.deepEqual(summariseModes(cars), { trips: 2, savedKg: 0, carFreeTrips: 0, carFreeKm: 0 })
})

test('reaching an exact savings milestone advances the next community target', () => {
  assert.deepEqual(milestoneFor(25), { previous: 25, next: 50, remaining: 25, percent: 50 })
})
