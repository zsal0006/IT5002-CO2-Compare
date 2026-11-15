const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function invokeEdgeFunction(name, body, options = {}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured for address search and routing.')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    signal: options.signal,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(result?.error || `The ${name} service failed (${response.status}).`)
  }
  if (!result || typeof result !== 'object') {
    throw new Error(`The ${name} service returned an invalid response.`)
  }
  return result
}
