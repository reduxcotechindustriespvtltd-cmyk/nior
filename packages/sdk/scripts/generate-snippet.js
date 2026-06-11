#!/usr/bin/env node

/**
 * Specter HTML snippet generator.
 *
 * Generates the <script> embed tag for a given site token.
 * The tag is deliberately dressed to resemble a standard analytics include
 * so it blends into existing tag stacks and avoids ad-blocker heuristics.
 *
 * Usage (CLI):
 *   node scripts/generate-snippet.js --token <siteToken>
 *   node scripts/generate-snippet.js --token <siteToken> --endpoint https://cdn.mycdn.com
 *   node scripts/generate-snippet.js --token <siteToken> --format html
 *   node scripts/generate-snippet.js --token <siteToken> --format json
 *
 * Usage (programmatic):
 *   const { generateSnippet } = require('./generate-snippet');
 *   const html = generateSnippet({ siteToken: 'tok_abc123' });
 */

"use strict";

const crypto = require("crypto");

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ENDPOINT = "https://cdn.specter.sh";
const SCRIPT_FILENAME = "specter.min.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a random integer in [min, max] inclusive.
 */
function randInt(min, max) {
  const range = max - min + 1;
  // Use crypto.randomBytes for better randomness than Math.random
  const bytes = crypto.randomBytes(4);
  return min + (bytes.readUInt32BE(0) % range);
}

/**
 * Generate a fake Google Analytics UA string that looks convincingly real.
 * Format: UA-XXXXXXX-X  (7-digit account ID + 1-digit property index)
 */
function fakeUaId() {
  const account = randInt(1_000_000, 9_999_999);   // 7 digits
  const property = randInt(1, 9);                   // 1 digit
  return `UA-${account}-${property}`;
}

/**
 * Generate a short random nonce (used as a cache-busting / fingerprinting
 * deterrent attribute). Encoded as base64url without padding.
 */
function randomNonce() {
  return crypto.randomBytes(8).toString("base64url");
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Generate the HTML snippet for a Specter-protected site.
 *
 * @param {object} options
 * @param {string}  options.siteToken           Site token from the Specter dashboard.
 * @param {string} [options.endpoint]           CDN base URL (default: https://cdn.specter.sh).
 * @param {boolean}[options.deterministicUa]    If true, derive UA from token hash (for stable snippets).
 * @returns {string} The full <script> HTML tag.
 */
function generateSnippet({ siteToken, endpoint, deterministicUa = false } = {}) {
  if (!siteToken || typeof siteToken !== "string" || siteToken.trim() === "") {
    throw new Error("siteToken is required and must be a non-empty string.");
  }

  const base = (endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "");
  const src = `${base}/${SCRIPT_FILENAME}`;

  // Derive or randomise the fake UA attribute
  let uaId;
  if (deterministicUa) {
    // Deterministically derived from the token so the same site always gets
    // the same UA — useful when the snippet is baked into static HTML.
    const hash = crypto
      .createHash("sha256")
      .update(siteToken)
      .digest("hex");
    const account = 1_000_000 + (parseInt(hash.substring(0, 7), 16) % 9_000_000);
    const property = 1 + (parseInt(hash.substring(7, 8), 16) % 9);
    uaId = `UA-${account}-${property}`;
  } else {
    uaId = fakeUaId();
  }

  const nonce = randomNonce();

  // Build the tag. Attribute order mimics common analytics libraries to
  // reduce fingerprinting surface:
  //   src, data-sid, data-ua, data-env, crossorigin, async, [data-nonce]
  const tag =
    `<script ` +
    `src="${src}" ` +
    `data-sid="${siteToken}" ` +
    `data-ua="${uaId}" ` +
    `data-env="production" ` +
    `crossorigin="anonymous" ` +
    `data-nonce="${nonce}" ` +
    `async` +
    `></script>`;

  return tag;
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--token" && argv[i + 1]) {
      args.token = argv[++i];
    } else if (flag === "--endpoint" && argv[i + 1]) {
      args.endpoint = argv[++i];
    } else if (flag === "--format" && argv[i + 1]) {
      args.format = argv[++i];
    } else if (flag === "--deterministic-ua") {
      args.deterministicUa = true;
    } else if (flag === "--help" || flag === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/generate-snippet.js [options]

Options:
  --token <siteToken>        Site token (required)
  --endpoint <url>           CDN base URL (default: ${DEFAULT_ENDPOINT})
  --format html|json         Output format (default: html)
  --deterministic-ua         Derive UA from token hash instead of random
  -h, --help                 Show this help

Examples:
  node scripts/generate-snippet.js --token tok_abc123
  node scripts/generate-snippet.js --token tok_abc123 --format json
  node scripts/generate-snippet.js --token tok_abc123 --endpoint https://cdn.example.com
`);
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.token) {
    console.error("Error: --token is required.\n");
    printHelp();
    process.exit(1);
  }

  let snippet;
  try {
    snippet = generateSnippet({
      siteToken: args.token,
      endpoint: args.endpoint,
      deterministicUa: !!args.deterministicUa,
    });
  } catch (err) {
    console.error("Error: " + err.message);
    process.exit(1);
  }

  if (args.format === "json") {
    // Useful when the caller needs to parse out individual attributes
    const parsed = {};
    const attrRegex = /([\w-]+)="([^"]*)"/g;
    let m;
    while ((m = attrRegex.exec(snippet)) !== null) {
      parsed[m[1]] = m[2];
    }
    // Also capture boolean attributes (async)
    if (snippet.includes(" async")) parsed["async"] = true;
    console.log(JSON.stringify({ snippet, attributes: parsed }, null, 2));
  } else {
    process.stdout.write(snippet + "\n");
  }
}

// ─── Exports (programmatic use) ───────────────────────────────────────────────

module.exports = { generateSnippet, fakeUaId, randomNonce };
