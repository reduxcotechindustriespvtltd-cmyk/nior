import type { Signal, KillMode } from '../types'

export async function importKey(rawKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(rawKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function verifyHmac(
  key: CryptoKey,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder()
    const sigBytes = hexToBytes(signature)
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(message))
  } catch {
    return false
  }
}

export async function computeHmacHex(key: CryptoKey, message: string): Promise<string> {
  const enc = new TextEncoder()
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bytesToHex(new Uint8Array(sig))
}

export function decodeSignal(raw: string, siteToken: string): Signal | null {
  try {
    const decoded = atob(raw)
    const parsed = JSON.parse(decoded)
    if (typeof parsed.kill !== 'boolean' || typeof parsed.mode !== 'string') return null
    return {
      kill: parsed.kill,
      mode: parsed.mode as KillMode,
      config: parsed.config ?? {},
      timestamp: parsed.ts ?? Date.now(),
    }
  } catch {
    return null
  }
}

export function timeWindow(): number {
  return Math.floor(Date.now() / 300_000)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
