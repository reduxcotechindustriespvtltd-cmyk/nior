'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { KillState, SpecterOptions } from '../types.js'
import { fetchKillState, applyKillState, resolveApiUrl } from '../client.js'

// ── Context ───────────────────────────────────────────────────────────────────

const SpecterCtx = createContext<KillState>({
  isKilled: false,
  killMode: 'none',
  config: {},
})

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Wrap your app (or root layout) with this provider once.
 * All child components can then call `useSpecter()` to read the kill state.
 *
 * @example
 * // app/layout.tsx
 * import { SpecterProvider } from '@rcti/noir/react'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SpecterProvider token="YOUR_TOKEN" apiUrl="https://your-api.com">
 *           {children}
 *         </SpecterProvider>
 *       </body>
 *     </html>
 *   )
 * }
 */
export function SpecterProvider({
  children,
  token,
  apiUrl,
  pollInterval = 30_000,
  swPath,
}: SpecterOptions & { children: ReactNode }) {
  const [state, setState] = useState<KillState>({
    isKilled: false,
    killMode: 'none',
    config: {},
  })

  useEffect(() => {
    const opts: SpecterOptions = { token, apiUrl, pollInterval }
    const base = resolveApiUrl(opts)

    async function check() {
      const next = await fetchKillState(opts)
      setState(next)
      applyKillState(next)
    }

    check()
    const timer = setInterval(check, pollInterval)

    // Register SW for cross-page coverage
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(swPath ?? '/specter-sw.js', { scope: '/' })
        .then(reg => {
          const send = (sw: ServiceWorker | null) => {
            if (sw) sw.postMessage({ type: 'SPECTER_INIT', token, base })
          }
          if (reg.installing) {
            reg.installing.addEventListener('statechange', function () {
              if (this.state === 'activated') send(reg.active)
            })
          } else {
            send(reg.active ?? reg.waiting)
          }
        })
        .catch(() => {})

      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'SPECTER_STATE') {
          setState(e.data)
          applyKillState(e.data)
        }
      })
    }

    return () => clearInterval(timer)
  }, [token, apiUrl, pollInterval])

  return <SpecterCtx.Provider value={state}>{children}</SpecterCtx.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Read the current kill state inside any component.
 * Requires a `<SpecterProvider>` ancestor.
 *
 * @example
 * function MyComponent() {
 *   const { isKilled, killMode } = useSpecter()
 *   if (isKilled) return <p>Site is down</p>
 *   return <p>All good</p>
 * }
 */
export function useSpecter(): KillState {
  return useContext(SpecterCtx)
}

// ── Guard component ───────────────────────────────────────────────────────────

/**
 * Renders `fallback` (or a default maintenance screen) when the kill switch
 * is active, and `children` when the site is live.
 *
 * @example
 * <SpecterGuard token="YOUR_TOKEN" apiUrl="https://your-api.com">
 *   <App />
 * </SpecterGuard>
 */
export function SpecterGuard({
  children,
  fallback,
  ...options
}: SpecterOptions & {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [state, setState] = useState<KillState>({
    isKilled: false,
    killMode: 'none',
    config: {},
  })

  useEffect(() => {
    fetchKillState(options).then(s => {
      setState(s)
      // Only apply DOM-replacing modes if no custom fallback is provided
      if (!fallback) applyKillState(s)
    })
    const timer = setInterval(async () => {
      const s = await fetchKillState(options)
      setState(s)
      if (!fallback) applyKillState(s)
    }, options.pollInterval ?? 30_000)
    return () => clearInterval(timer)
  }, [options.token, options.apiUrl])

  if (state.isKilled && fallback) return <>{fallback}</>

  return (
    <SpecterCtx.Provider value={state}>
      {children}
    </SpecterCtx.Provider>
  )
}
