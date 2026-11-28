import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  stdin: {
    contents: "export { useCountriesStore } from './src/stores/countries.js'; export { createPinia, setActivePinia } from 'pinia'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url))
  },
  plugins: [{
    name: 'countries-supabase-mock',
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'supabase', namespace: 'mock' }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
        contents: 'export const supabaseConfigured = true; export const supabase = globalThis.countriesTest'
      }))
    }
  }],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm'
})
globalThis.countriesTest = {}
const { useCountriesStore, createPinia, setActivePinia } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)
const supabase = globalThis.countriesTest
delete globalThis.countriesTest

test('country loaders report errors and clear their loading state', async () => {
  setActivePinia(createPinia())
  const store = useCountriesStore()
  supabase.from = () => ({
    select: () => ({
      order: async () => ({ error: { message: 'list failed' } }),
      eq: async () => { throw new Error('snapshot failed') }
    })
  })
  supabase.rpc = async () => ({ error: { message: 'series failed' } })

  await store.loadList()
  assert.equal(store.error, 'Could not load the country list: list failed')
  assert.equal(store.loadingList, false)
  assert.deepEqual(await store.loadSeries('AU'), [])
  assert.equal(store.error, 'Could not load emissions for AU: series failed')
  assert.equal(store.loadingSeries, false)
  assert.deepEqual(await store.loadSnapshot(2020), [])
  assert.equal(store.error, 'Could not load the world map data: snapshot failed')
  assert.equal(store.loadingSnapshot, false)
})

test('country loaders cache successful data after a retry', async () => {
  setActivePinia(createPinia())
  const store = useCountriesStore()
  let requests = 0
  supabase.rpc = async () => {
    requests++
    if (requests === 1) return { error: { message: 'temporary failure' } }
    return { data: [{ year: 2020 }], error: null }
  }
  assert.deepEqual(await store.loadSeries('AU'), [])
  assert.deepEqual(await store.loadSeries('AU'), [{ year: 2020 }])
  assert.deepEqual(await store.loadSeries('AU'), [{ year: 2020 }])
  assert.equal(requests, 2)
  assert.equal(store.loadingSeries, false)
})
