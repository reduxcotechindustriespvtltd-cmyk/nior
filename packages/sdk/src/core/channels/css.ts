import type { Signal } from '../../types'
import { computeHmacHex, timeWindow } from '../crypto'

export async function checkCSS(
  endpoint: string,
  siteToken: string,
  cryptoKey: CryptoKey
): Promise<Signal | null> {
  try {
    const _r = Math.random().toString(36).slice(2)
    const res = await fetch(`${endpoint}/v1/theme/${siteToken}.css?v=${_r}`, {
      headers: { 'Accept': 'text/css,*/*;q=0.1' },
      cache: 'no-store',
    })
    if (!res.ok) return null

    const text = await res.text()

    const uidMatch = text.match(/--_perf-uid:\s*(\d+)/)
    const sigMatch = text.match(/--_trace-id:\s*"([a-f0-9]+)"/)
    if (!uidMatch || !sigMatch) return null

    const uid = parseInt(uidMatch[1], 10)
    const sig = sigMatch[1]

    const tw = timeWindow()
    const expected = await computeHmacHex(cryptoKey, `${siteToken}:${tw}`)
    if (!expected.startsWith(sig.slice(0, 16))) return null

    const kill = uid % 2 === 1
    const modeMatch = text.match(/--_evt-class:\s*"([a-z]+)"/)
    const mode = (modeMatch?.[1] ?? 'freeze') as Signal['mode']

    return { kill, mode, config: {}, timestamp: Date.now() }
  } catch {
    return null
  }
}
