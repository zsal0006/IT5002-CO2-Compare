import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const source = await build({
  entryPoints: ['src/lib/weather.js'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  external: ['@/lib/edgeFunctions'],
  plugins: [{
    name: 'stub',
    setup(b) {
      b.onResolve({ filter: /^@\// }, (a) => ({ path: a.path, namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const invokeEdgeFunction = () => {}' }))
    }
  }]
})
const { assessWeather } = await import(
  `data:text/javascript;base64,${Buffer.from(source.outputFiles[0].text).toString('base64')}`
)

const calm = { tempC: 20, feelsLikeC: 20, windKph: 10, gustKph: 15, precipMm: 0, rainChancePct: 5, uv: 4, isDay: true }

test('calm weather is good for walking and cycling', () => {
  const result = assessWeather(calm)
  assert.equal(result.walking.rating, 'good')
  assert.equal(result.cycling.rating, 'good')
})

test('rain and wind hit cycling harder than walking', () => {
  const result = assessWeather({ ...calm, windKph: 30, rainChancePct: 35 })
  assert.equal(result.walking.rating, 'good')
  assert.equal(result.cycling.rating, 'fair')
  assert.deepEqual(result.cycling.reasons, ['chance of rain', 'windy'])
})

test('heavy rain is poor for both and missing data yields no ratings', () => {
  const result = assessWeather({ ...calm, precipMm: 3, rainChancePct: 90 })
  assert.equal(result.walking.rating, 'poor')
  assert.equal(result.cycling.rating, 'poor')
  assert.deepEqual(assessWeather(null), {})
})
