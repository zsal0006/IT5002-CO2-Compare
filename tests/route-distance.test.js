import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../supabase/functions/route-distance/index.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'neutral',
  format: 'esm'
})
let handler
const originalDeno = globalThis.Deno
globalThis.Deno = { serve: (callback) => { handler = callback } }
try {
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
} finally {
  globalThis.Deno = originalDeno
}

test('routing rejects non-object JSON before accessing the provider', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected provider request') })
  for (const body of [null, [], 42, 'text']) {
    const response = await handler(new Request('http://localhost/route-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }))
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Request body must be an object.' })
  }
  const malformed = await handler(new Request('http://localhost/route-distance', {
    method: 'POST', body: '{'
  }))
  assert.equal(malformed.status, 400)
  assert.deepEqual(await malformed.json(), { error: 'Request body must be valid JSON.' })
  assert.equal(fetchMock.mock.callCount(), 0)
})
