import assert from 'node:assert/strict'
import test from 'node:test'
import { percentChange, signedPercent, usableRows } from '../src/lib/series.js'

test('sorts country years, preserves measured zeroes and omits unusable emissions', () => {
  const rows = [
    { year: '2024', transport_mt_co2e: '12.5', total_mt_co2e: '50', transport_share_pct: '25' },
    { year: 2000, transport_mt_co2e: null },
    { year: 1980, transport_mt_co2e: 'unavailable' },
    { year: 1990, transport_mt_co2e: '0', total_mt_co2e: null, transport_share_pct: null }
  ]
  assert.deepEqual(usableRows(rows), [
    { year: 1990, value: 0, total: null, sharePct: null },
    { year: 2024, value: 12.5, total: 50, sharePct: 25 }
  ])
})

test('an absent or empty country series produces no plot points', () => {
  assert.deepEqual(usableRows(null), [])
  assert.deepEqual(usableRows([]), [])
})

test('percentage change distinguishes growth, decline and a measured zero at the end', () => {
  assert.equal(percentChange(40, 50), 25)
  assert.equal(percentChange(40, 30), -25)
  assert.equal(percentChange(40, 40), 0)
  assert.equal(percentChange(40, 0), -100)
})

test('zero or unavailable baselines cannot produce a percentage label', () => {
  for (const baseline of [0, null, undefined, NaN, Infinity]) {
    assert.equal(percentChange(baseline, 50), null)
  }
  assert.equal(signedPercent(percentChange(0, 50)), '—')
  assert.equal(signedPercent(0), '+0.0%')
})
