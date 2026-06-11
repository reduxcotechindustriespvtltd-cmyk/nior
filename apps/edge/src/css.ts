import { SiteState } from './types'

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
 * Convert the first 13 hex chars of a signature into a large decimal number
 * that has the correct parity for the kill state.
 *
 * We use 13 hex chars = 52 bits, well within Number.MAX_SAFE_INTEGER range (53 bits).
 */
function buildPerfUid(hmacSig: string, kill: boolean): number {
  const rawHex = hmacSig.slice(0, 13)
  let num = parseInt(rawHex, 16)

  const isEven = num % 2 === 0
  if (kill && isEven) {
    // flip to odd
    num += 1
  } else if (!kill && !isEven) {
    // flip to even
    num += 1
  }

  return num
}

/**
 * Create a CSS response that looks like a legitimate reset/utility stylesheet
 * while hiding the kill state inside custom property values.
 *
 * Encoding scheme:
 *   --_perf-uid: {largeNumber}   →  largeNumber % 2 === 0 means alive, 1 means kill
 *   --_trace-id: "{hmacSignature}"  →  verifiable HMAC
 */
export async function createCSSResponse(
  state: SiteState,
  siteToken: string,
  secret: string,
): Promise<Response> {
  const timeWindow = Math.floor(Date.now() / 300_000)

  const hmacSignature = await hmacHex(secret, `${siteToken}:${timeWindow}`)
  const perfUid = buildPerfUid(hmacSignature, state.kill)

  // The full sig is embedded as --_trace-id for SDK verification
  const traceId = hmacSignature.slice(0, 32)

  const css = `/* v1 — performance baseline */

/* -------------------------------------------------------------------------
 * 1. Box-sizing reset
 * ------------------------------------------------------------------------- */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* -------------------------------------------------------------------------
 * 2. Document defaults
 * ------------------------------------------------------------------------- */
:root {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  --line-height-base: 1.5;
  --color-text: #1a1a1a;
  --color-bg: #ffffff;
  --spacing-unit: 8px;
  /* internal perf counters — do not edit */
  --_perf-uid: ${perfUid};
  --_trace-id: "${traceId}";
}

html {
  font-family: var(--font-sans);
  line-height: var(--line-height-base);
  -webkit-text-size-adjust: 100%;
  tab-size: 4;
}

body {
  margin: 0;
  color: var(--color-text);
  background-color: var(--color-bg);
}

/* -------------------------------------------------------------------------
 * 3. Semantic element defaults
 * ------------------------------------------------------------------------- */
main {
  display: block;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  margin-top: 0;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

p {
  margin-top: 0;
  margin-bottom: 1em;
}

a {
  color: inherit;
  text-decoration: underline;
}

a:not([href]) {
  color: inherit;
  text-decoration: none;
}

img,
svg,
video,
canvas,
audio,
iframe,
embed,
object {
  display: block;
  max-width: 100%;
}

img,
video {
  height: auto;
}

button,
input,
optgroup,
select,
textarea {
  font-family: inherit;
  font-size: 100%;
  line-height: inherit;
  margin: 0;
}

button,
select {
  text-transform: none;
}

button,
[type="button"],
[type="reset"],
[type="submit"] {
  -webkit-appearance: button;
  appearance: button;
  cursor: pointer;
}

::-moz-focus-inner {
  border-style: none;
  padding: 0;
}

fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  padding: 0;
}

ol,
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

hr {
  height: 0;
  color: inherit;
  border-top-width: 1px;
}

abbr[title] {
  text-decoration: underline dotted;
}

b,
strong {
  font-weight: bolder;
}

code,
kbd,
samp,
pre {
  font-family: var(--font-mono);
  font-size: 1em;
}

small {
  font-size: 80%;
}

sub,
sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

table {
  text-indent: 0;
  border-color: inherit;
  border-collapse: collapse;
}

/* -------------------------------------------------------------------------
 * 4. Focus-visible ring
 * ------------------------------------------------------------------------- */
:focus-visible {
  outline: 2px solid #0070f3;
  outline-offset: 2px;
}

/* -------------------------------------------------------------------------
 * 5. Reduced-motion
 * ------------------------------------------------------------------------- */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* -------------------------------------------------------------------------
 * 6. Utility: sr-only (screen-reader only)
 * ------------------------------------------------------------------------- */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.not-sr-only {
  position: static;
  width: auto;
  height: auto;
  padding: 0;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
`

  const headers = new Headers({
    'Content-Type': 'text/css; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
    Vary: 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff',
  })

  return new Response(css, {
    status: 200,
    headers,
  })
}
