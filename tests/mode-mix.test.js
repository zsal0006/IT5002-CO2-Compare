import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(() => server.close())
const { default: ModeMix } = await server.ssrLoadModule('/src/components/impact/ModeMix.vue')
const { default: ComparisonBars } = await server.ssrLoadModule('/src/components/compare/ComparisonBars.vue')
const render = (rows, scopeLabel = 'worldwide') =>
  renderToString(createSSRApp({ render: () => h(ModeMix, { rows, scopeLabel }) }))

test('mode mix draws pies from trips and the car-free split, including car trips', async () => {
  const html = await render([
    { mode_key: 'walking', category: 'active', trips: '3', total_saved_kg: 1, total_emitted_kg: 0 },
    { mode_key: 'car_average', category: 'car', trips: 1, total_saved_kg: 0, total_emitted_kg: 2.5 },
    { mode_key: 'cycling', category: 'active', trips: 0, total_saved_kg: 0 }
  ], 'Victoria')
  assert.match(html, /How people travel/)
  assert.match(html, /Victoria/)
  assert.equal((html.match(/conic-gradient/g) ?? []).length, 2)
  assert.match(html, /Car-free 75%/)
  assert.match(html, /By car 25%/)
  assert.doesNotMatch(html, />Cycling</)
  assert.match(html, /Generated[\s\S]*Avoided[\s\S]*1\.00 kg[\s\S]*2\.50 kg/)
  assert.doesNotMatch(html, /travel-methods-heading/)
})

test('mode mix handles empty data', async () => {
  const html = await render([])
  assert.match(html, /No trips logged/)
  assert.doesNotMatch(html, /conic-gradient/)
})

test('comparison shows the distance used for calculation and percentage lower than driving', async () => {
  const modes = [
    { modeKey: 'car_average', label: 'Car', factor: 170, isBaseline: true, savedVsBaselineKg: 0 },
    { modeKey: 'walking', label: 'Walking', factor: 0, isBaseline: false, savedVsBaselineKg: 1.7221 }
  ]
  const html = await renderToString(createSSRApp({
    render: () => h(ComparisonBars, { modes, distanceKm: 10.13 })
  }))
  assert.match(html, /10\.13 km one way/)
  assert.match(html, /1,722 g CO₂e/)
  assert.match(html, /100% lower than driving/)
})
