import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when the app has credentials to talk to Supabase. When false the app
 * still runs: the calculator uses the bundled fallback factors and the
 * dashboard shows an explicit "not configured" state (NFR-7).
 */
export const supabaseConfigured = Boolean(url && key)

export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: false } })
  : null

if (!supabaseConfigured) {
  console.warn(
    '[CarbonRoute] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env.local. Running with bundled fallback data.'
  )
}
