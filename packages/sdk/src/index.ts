export type { KillMode, KillConfig, KillState, SpecterOptions } from './types.js'
export { fetchKillState, applyKillState, resolveApiUrl } from './client.js'

import type { SpecterOptions } from './types.js'
import { fetchKillState, applyKillState, resolveApiUrl } from './client.js'

/**
 * Vanilla JS init — call once from any page.
 * Checks kill state immediately, then re-polls on the given interval.
 * Also registers the Service Worker if `/specter-sw.js` exists on the domain.
 *
 * @example
 * import { initSpecter } from '@rcti/noir'
 * initSpecter({ token: 'YOUR_TOKEN', apiUrl: 'https://your-api.com' })
 */
export function initSpecter(options: SpecterOptions): () => void {
  if (typeof window === 'undefined') return () => {}

  const interval = options.pollInterval ?? 30_000
  let timer: ReturnType<typeof setInterval>

  async function check() {
    const state = await fetchKillState(options)
    applyKillState(state)
  }

  // Immediate check
  check()

  // Periodic re-poll
  timer = setInterval(check, interval)

  // Register Service Worker for cross-page coverage
  if ('serviceWorker' in navigator) {
    const base = resolveApiUrl(options)
    navigator.serviceWorker
      .register(options.swPath ?? '/specter-sw.js', { scope: '/' })
      .then(reg => {
        const send = (sw: ServiceWorker | null) => {
          if (sw) sw.postMessage({ type: 'SPECTER_INIT', token: options.token, base })
        }
        if (reg.installing) {
          reg.installing.addEventListener('statechange', function () {
            if (this.state === 'activated') send(reg.active)
          })
        } else {
          send(reg.active ?? reg.waiting)
        }
      })
      .catch(() => {}) // fail silently if stub file is absent

    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SPECTER_STATE') applyKillState(e.data)
    })
  }

  return () => clearInterval(timer)
}
