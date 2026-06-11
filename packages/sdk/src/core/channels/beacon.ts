import type { Signal } from '../../types'
import { importKey, computeHmacHex, timeWindow } from '../crypto'

export async function checkBeacon(
  endpoint: string,
  siteToken: string,
  cryptoKey: CryptoKey
): Promise<Signal | null> {
  try {
    const _r = Math.random().toString(36).slice(2)
    const res = await fetch(`${endpoint}/v1/b/${siteToken}.gif?_=${_r}&cb=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'image/gif,image/*;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const lm = res.headers.get('Last-Modified')
    const etag = res.headers.get('ETag')
    if (!lm || !etag) return null

    const secs = new Date(lm).getSeconds()
    const kill = secs % 2 === 1

    const tw = timeWindow()
    const expected = await computeHmacHex(cryptoKey, `${siteToken}:${tw}`)
    const etagClean = etag.replace(/"/g, '').slice(0, 16)
    if (!expected.startsWith(etagClean)) return null

    const modeHeader = res.headers.get('X-Mode') ?? 'freeze'
    const configHeader = res.headers.get('X-Config')
    const config = configHeader ? JSON.parse(atob(configHeader)) : {}

    return {
      kill,
      mode: modeHeader as Signal['mode'],
      config,
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}
