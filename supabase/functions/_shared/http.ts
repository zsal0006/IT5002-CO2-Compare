const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

export function handleOptions(request: Request) {
  if (request.method !== 'OPTIONS') return null
  return new Response('ok', { headers: corsHeaders })
}

// Fixed-window counters per caller. State lives in the isolate, so this is a
// best-effort brake on bursts rather than a global quota.
const windows = new Map<string, { count: number; resetAt: number }>()
const MAX_TRACKED_CALLERS = 5000

function callerId(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
  return forwarded || request.headers.get('cf-connecting-ip') || 'unknown'
}

/** Returns a 429 response once `limit` requests per `windowMs` is exceeded, otherwise null. */
export function rateLimit(request: Request, name: string, limit: number, windowMs = 60_000) {
  const now = Date.now()
  if (windows.size >= MAX_TRACKED_CALLERS) {
    for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key)
    if (windows.size >= MAX_TRACKED_CALLERS) windows.clear()
  }

  const key = `${name}:${callerId(request)}`
  let entry = windows.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    windows.set(key, entry)
  }
  if (++entry.count <= limit) return null

  return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }), {
    status: 429,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000))
    }
  })
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | Response> {
  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return jsonResponse({ error: 'Request body must be an object.' }, 400)
  }
  return parsed as Record<string, unknown>
}
