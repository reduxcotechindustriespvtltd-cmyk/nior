import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { KillState, SpecterOptions } from '../types.js'

/**
 * Next.js Edge Middleware — checks kill state before the page renders.
 * Add to `middleware.ts` at your project root.
 *
 * @example
 * // middleware.ts
 * import { withSpecter } from '@rcti/noir/next'
 *
 * export default withSpecter({
 *   token: process.env.SPECTER_TOKEN!,
 *   apiUrl: process.env.SPECTER_API_URL,
 * })
 *
 * export const config = {
 *   matcher: ['/((?!_next|api|favicon).*)'],
 * }
 */
export function withSpecter(options: SpecterOptions) {
  const base = (options.apiUrl ?? 'https://api.noir.com').replace(/\/$/, '')

  return async function spectermiddleware(req: NextRequest) {
    let state: KillState = { isKilled: false, killMode: 'none', config: {} }

    try {
      const res = await fetch(`${base}/api/v1/status/${options.token}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) state = await res.json()
    } catch {
      // Fail open — never block the site due to a Specter outage
      return NextResponse.next()
    }

    if (!state.isKilled) return NextResponse.next()

    const { killMode: mode, config: c } = state

    // Redirect
    if (mode === 'redirect' && c.url) {
      return NextResponse.redirect(c.url as string, { status: 302 })
    }

    // Ghost — let the page load but add a header the client can read
    if (mode === 'ghost') {
      const res = NextResponse.next()
      res.headers.set('x-specter-mode', 'ghost')
      return res
    }

    // Everything else (freeze / overlay / timebomb) — return a 503 HTML page
    const title = mode === 'overlay' && c.title ? String(c.title) : 'Down for maintenance'
    const msg   = mode === 'overlay' && c.message ? String(c.message) : "We'll be back soon."
    const back  = mode === 'overlay' && c.returnTime
      ? `<p class="b">Back: ${new Date(String(c.returnTime)).toLocaleString()}</p>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;
         height:100dvh;display:flex;align-items:center;justify-content:center;
         text-align:center;padding:2rem}
    .w{max-width:500px}
    h1{font-size:2.25rem;font-weight:700;margin-bottom:.75rem;line-height:1.2}
    p{opacity:.5;line-height:1.6}
    .b{opacity:.35;font-size:.8rem;margin-top:.5rem}
  </style>
</head>
<body>
  <div class="w">
    <h1>${title}</h1>
    <p>${msg}</p>
    ${back}
  </div>
</body>
</html>`

    return new NextResponse(html, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '3600',
        'x-specter-mode': mode,
      },
    })
  }
}

export type { KillState, SpecterOptions } from '../types.js'
