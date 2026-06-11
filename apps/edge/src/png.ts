import { SiteState } from './types'

// A real 1x1 transparent GIF (GIF89a format, 43 bytes)
// Header: GIF89a, logical screen descriptor, global color table (2 colors: black + transparent),
// graphic control extension (transparency index 0), image descriptor, image data, trailer.
const TRANSPARENT_GIF_BYTES = new Uint8Array([
  // GIF header
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
  // Logical Screen Descriptor
  0x01, 0x00, // width = 1
  0x01, 0x00, // height = 1
  0x80,       // packed: global color table flag=1, color resolution=1, sort=0, size=0 (2 colors)
  0x00,       // background color index
  0x00,       // pixel aspect ratio
  // Global Color Table (2 entries × 3 bytes = 6 bytes)
  0x00, 0x00, 0x00, // color 0: black (will be transparent)
  0xff, 0xff, 0xff, // color 1: white
  // Graphic Control Extension
  0x21,       // extension introducer
  0xf9,       // graphic control label
  0x04,       // block size
  0x01,       // packed: transparent color flag=1
  0x00, 0x00, // delay time (0 cs)
  0x00,       // transparent color index = 0
  0x00,       // block terminator
  // Image Descriptor
  0x2c,       // image separator
  0x00, 0x00, // left = 0
  0x00, 0x00, // top = 0
  0x01, 0x00, // width = 1
  0x01, 0x00, // height = 1
  0x00,       // packed: no local color table
  // Image Data
  0x02,       // LZW minimum code size
  0x02,       // block size
  0x4c, 0x01, // compressed pixel data (single transparent pixel)
  0x00,       // block terminator
  // GIF Trailer
  0x3b,
])

/**
 * Derive an HMAC-SHA256 signature and return the hex string.
 */
async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Build a Last-Modified date string where the seconds component encodes
 * the kill state: EVEN seconds = alive, ODD seconds = kill.
 *
 * We pick a deterministic base time so the header looks plausible, then
 * force the seconds to the correct parity.
 */
function buildLastModified(kill: boolean, updatedAt: number): string {
  const d = new Date(updatedAt)
  const currentSeconds = d.getUTCSeconds()
  const isCurrentEven = currentSeconds % 2 === 0

  // Adjust seconds to match the desired parity
  let targetSeconds: number
  if (kill) {
    // must be odd
    targetSeconds = isCurrentEven ? (currentSeconds === 0 ? 1 : currentSeconds - 1) : currentSeconds
  } else {
    // must be even
    targetSeconds = isCurrentEven ? currentSeconds : currentSeconds - 1
  }
  // Clamp to valid range
  if (targetSeconds < 0) targetSeconds += 2
  d.setUTCSeconds(targetSeconds)

  return d.toUTCString()
}

/**
 * Create a 1x1 transparent GIF response with the kill state steganographically
 * encoded in the HTTP headers.
 *
 * Encoding scheme:
 *   - Last-Modified seconds parity: even = alive, odd = kill
 *   - ETag: first 16 hex chars of HMAC-SHA256(siteToken:timeWindow)
 *   - X-Request-Id: random UUID (legitimacy cover)
 */
export async function createBeaconResponse(
  state: SiteState,
  siteToken: string,
  secret: string,
): Promise<Response> {
  // 5-minute rolling window prevents replay attacks
  const timeWindow = Math.floor(Date.now() / 300_000)

  const hmacSignature = await hmacHex(secret, `${siteToken}:${timeWindow}`)
  const etag = `"${hmacSignature.slice(0, 16)}"`

  const lastModified = buildLastModified(state.kill, state.updatedAt)

  // Random UUID as X-Request-Id — looks like a standard request tracing header
  const requestId = crypto.randomUUID()

  const headers = new Headers({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Last-Modified': lastModified,
    ETag: etag,
    'X-Request-Id': requestId,
    Vary: 'Accept',
  })

  return new Response(TRANSPARENT_GIF_BYTES, {
    status: 200,
    headers,
  })
}
