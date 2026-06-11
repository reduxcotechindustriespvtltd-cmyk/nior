import type { KillState, SpecterOptions } from './types.js'

const DEFAULT_API = 'https://api.noir.app'

export function resolveApiUrl(options: SpecterOptions): string {
  return (options.apiUrl ?? DEFAULT_API).replace(/\/$/, '')
}

/**
 * Fetch the current kill state for a token.
 * Always resolves — returns { isKilled: false } on any network error so the
 * site is never blocked by a Specter outage.
 */
export async function fetchKillState(options: SpecterOptions): Promise<KillState> {
  const base = resolveApiUrl(options)
  try {
    const res = await fetch(`${base}/api/v1/status/${options.token}`, {
      cache: 'no-store',
      credentials: 'omit',
    })
    if (!res.ok) return { isKilled: false, killMode: 'none', config: {} }
    return await res.json() as KillState
  } catch {
    return { isKilled: false, killMode: 'none', config: {} }
  }
}

/**
 * Apply a kill state to the current browser page.
 * No-ops on the server.
 */
export function applyKillState(state: KillState): void {
  if (typeof document === 'undefined') return
  if (!state.isKilled) return

  const { killMode: mode, config: c } = state

  if (mode === 'redirect' && c.url) {
    window.location.replace(c.url)
    return
  }

  if (mode === 'overlay') {
    const el = document.createElement('div')
    el.style.cssText =
      'position:fixed;inset:0;background:#0a0a0a;color:#fff;z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;' +
      'text-align:center;padding:2rem'
    const title = c.title ?? 'Down for maintenance'
    const msg   = c.message ?? "We'll be back soon."
    const back  = c.returnTime
      ? `<p style="opacity:.35;font-size:.8rem;margin-top:.5rem">Back: ${new Date(c.returnTime as string).toLocaleString()}</p>`
      : ''
    el.innerHTML = `<div><h1 style="font-size:2rem;margin:0 0 .75rem;font-weight:700">${title}</h1><p style="opacity:.5;line-height:1.6">${msg}</p>${back}</div>`
    const inject = () => document.body.appendChild(el)
    document.body ? inject() : document.addEventListener('DOMContentLoaded', inject)
    return
  }

  if (mode === 'ghost') {
    const disable = () =>
      document.querySelectorAll<HTMLElement>('a,button,input,select,textarea,form')
        .forEach(el => { el.style.pointerEvents = 'none' })
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', disable)
      : disable()
    return
  }

  // freeze / timebomb / default — replace the entire page
  const title = c.maintenanceMessage ?? 'Down for maintenance'
  document.open()
  document.write(
    `<!DOCTYPE html><html><head><title>${title}</title>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;` +
    `background:#0a0a0a;color:#fff;height:100dvh;display:flex;align-items:center;` +
    `justify-content:center;text-align:center;padding:2rem}h1{font-size:2rem;font-weight:700;` +
    `margin-bottom:.75rem}p{opacity:.5}</style></head><body>` +
    `<div><h1>${title}</h1><p>Please check back later.</p></div></body></html>`
  )
  document.close()
}
