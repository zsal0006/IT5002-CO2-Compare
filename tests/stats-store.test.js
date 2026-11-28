import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const bundled = await build({
  stdin: {
    contents: "export { useStatsStore } from './src/stores/stats.js'; export { createPinia, setActivePinia } from 'pinia'",
    resolveDir: root
  },
  plugins: [{
    name: 'stats-supabase-mock',
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'supabase', namespace: 'mock' }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
        contents: 'export const supabaseConfigured = true; export const supabase = { from: (...args) => globalThis.statsTest.from(...args) }'
      }))
    }
  }],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm'
})
const { useStatsStore, createPinia, setActivePinia } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

function setup(t, failures) {
  globalThis.statsTest = {
    from(name) {
      const result = failures.includes(name)
        ? { data: null, error: { message: `${name} failed` } }
        : { data: name === 'v_savings_global' ? { trips: 1 } : [], error: null }
      return { select: () => ({ single: async () => result, order: async () => result }) }
    }
  }
  t.after(() => { delete globalThis.statsTest })
  setActivePinia(createPinia())
  return useStatsStore()
}

for (const view of ['v_savings_by_region', 'v_savings_by_mode']) {
  test(`community totals report failure of ${view}`, async (t) => {
    const stats = setup(t, [view])
    await stats.load()
    assert.match(stats.error, new RegExp(`${view} failed`))
    assert.equal(stats.global, null)
    assert.equal(stats.loading, false)
  })
}

test('missing regional mode totals preserve global results with a warning', async (t) => {
  const stats = setup(t, ['v_savings_by_region_mode'])
  await stats.load()
  assert.equal(stats.global.trips, 1)
  assert.equal(stats.error, null)
  assert.match(stats.warning, /regional details cannot be displayed/)
})
