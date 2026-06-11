import type { IncomingMessage, ServerResponse } from 'node:http'
import type { KillState, SpecterOptions } from '../types.js'

type NextFn = (err?: unknown) => void

/**
 * Express / Connect / Fastify (with `middie`) middleware.
 * Checks the kill state before every request and responds with an
 * appropriate page if the site is killed.
 *
 * @example
 * // Express
 * import express from 'express'
 * import { specterMiddleware } from '@rcti/noir/node'
 *
 * const app = express()
 * app.use(specterMiddleware({
 *   token: process.env.SPECTER_TOKEN,
 *   apiUrl: process.env.SPECTER_API_URL,
 * }))
 *
 * @example
 * // Fastify
 * import Fastify from 'fastify'
 * import middie from '@fastify/middie'
 * import { specterMiddleware } from '@rcti/noir/node'
 *
 * const app = Fastify()
 * await app.register(middie)
 * app.use(specterMiddleware({ token: '...' }))
 */
export function specterMiddleware(options: SpecterOptions) {
  const base = (options.apiUrl ?? 'https://api.noir.com').replace(/\/$/, '')

  // Simple in-process cache to avoid hitting the API on every request
  let cached: KillState = { isKilled: false, killMode: 'none', config: {} }
  let lastFetch = 0
  const TTL = options.pollInterval ?? 30_000

  async function getState(): Promise<KillState> {
    const now = Date.now()
    if (now - lastFetch < TTL) return cached
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`${base}/api/v1/status/${options.token}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'noir-node/1.0' },
      })
      clearTimeout(timeout)
      if (res.ok) {
        cached = await res.json()
        lastFetch = now
      }
    } catch {
      // Fail open
    }
    return cached
  }

  return async function spectermiddleware(
    _req: IncomingMessage,
    res: ServerResponse,
    next: NextFn
  ) {
    const state = await getState()

    if (!state.isKilled) return next()

    const { killMode: mode, config: c } = state

    if (mode === 'redirect' && c.url) {
      res.writeHead(302, { Location: c.url as string })
      res.end()
      return
    }

    if (mode === 'ghost') {
      // Add header so client-side JS can pick it up, then pass through
      res.setHeader('x-specter-mode', 'ghost')
      return next()
    }

    const title = mode === 'overlay' && c.title ? String(c.title) : 'Down for maintenance'
    const msg   = mode === 'overlay' && c.message ? String(c.message) : "We'll be back soon."
    const back  = mode === 'overlay' && c.returnTime
      ? `<p style="opacity:.35;font-size:.8rem;margin-top:.5rem">Back: ${new Date(String(c.returnTime)).toLocaleString()}</p>`
      : ''

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;height:100dvh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}.w{max-width:500px}h1{font-size:2.25rem;font-weight:700;margin-bottom:.75rem}p{opacity:.5;line-height:1.6}</style></head><body><div class="w"><h1>${title}</h1><p>${msg}</p>${back}</div></body></html>`

    res.writeHead(503, {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '3600',
      'x-specter-mode': mode,
    })
    res.end(html)
  }
}

export type { KillState, SpecterOptions } from '../types.js'
