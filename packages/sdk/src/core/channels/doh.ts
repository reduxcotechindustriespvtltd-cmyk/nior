import type { Signal } from '../../types'
import { computeHmacHex, timeWindow } from '../crypto'

async function sha256Hex(msg: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(msg))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function checkDoH(
  siteToken: string,
  cryptoKey: CryptoKey
): Promise<Signal | null> {
  try {
    const hash = (await sha256Hex(siteToken)).slice(0, 16)
    const hostname = `${hash}.status.specter-cdn.com`

    const res = await fetch(
      `https://1.1.1.1/dns-query?name=${hostname}&type=TXT`,
      { headers: { 'Accept': 'application/dns-json' }, cache: 'no-store' }
    )
    if (!res.ok) return null

    const data = await res.json()
    const answers: Array<{ data: string }> = data.Answer ?? []
    const txt = answers.find(a => a.data?.startsWith('v=sp1'))?.data
    if (!txt) return null

    const parts = Object.fromEntries(
      txt.split(' ').slice(1).map((p: string) => p.split('='))
    )

    const tw = timeWindow()
    const expected = await computeHmacHex(cryptoKey, `${siteToken}:${tw}`)
    if (!expected.startsWith((parts.sig ?? '').slice(0, 16))) return null

    return {
      kill: parts.s === '1',
      mode: (parts.m ?? 'freeze') as Signal['mode'],
      config: {},
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}
