#!/usr/bin/env node

/**
 * Specter SDK obfuscation pipeline.
 *
 * Usage:
 *   node scripts/obfuscate.js
 *   node scripts/obfuscate.js --site-token <token>   (bakes token into output)
 *   node scripts/obfuscate.js --all-sites            (reads sites.json, emits per-site variants)
 *
 * Inputs:  dist/sdk.min.js
 * Outputs: dist/sdk.obfuscated.js
 *          dist/sdk.<siteToken>.js   (per-site variant, one per token)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const INPUT = path.join(DIST, "sdk.min.js");
const OUTPUT_BASE = path.join(DIST, "sdk.obfuscated.js");

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const siteTokenIdx = args.indexOf("--site-token");
const allSites = args.includes("--all-sites");
const singleToken = siteTokenIdx !== -1 ? args[siteTokenIdx + 1] : null;

// ─── Obfuscator config ────────────────────────────────────────────────────────

/**
 * Build an obfuscator options object.
 *
 * @param {object} [overrides]  Any option overrides (used for per-site baking).
 * @returns {import('javascript-obfuscator').ObfuscatorOptions}
 */
function buildOptions(overrides = {}) {
  return {
    // ── Identifier renaming ─────────────────────────────────────────────────
    identifierNamesGenerator: "hexadecimal",   // _0x1a2b3c style
    identifiersPrefix: "_$",                    // extra prefix for uniqueness
    renameGlobals: false,                       // keep exported API intact
    renameProperties: false,                    // renaming props breaks duck-typing

    // ── String encryption ───────────────────────────────────────────────────
    stringArray: true,
    stringArrayEncoding: ["rc4"],               // RC4 encoded string table
    stringArrayIndexesType: ["hexadecimal-number"],
    stringArrayThreshold: 0.85,                 // 85% of strings go through array
    stringArrayWrappersCount: 3,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 5,
    stringArrayWrappersType: "function",
    splitStrings: true,
    splitStringsChunkLength: 4,
    unicodeEscapeSequence: false,               // avoid double-encoding with RC4

    // ── Control flow ────────────────────────────────────────────────────────
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.85,

    // ── Dead-code injection ─────────────────────────────────────────────────
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.5,            // 50% of blocks get dead code

    // ── Self-defending ──────────────────────────────────────────────────────
    selfDefending: true,                        // breaks if beautified/formatted

    // ── Debug protection ────────────────────────────────────────────────────
    debugProtection: false,                     // causes DevTools hangs; skip
    debugProtectionInterval: 0,

    // ── Misc hardening ──────────────────────────────────────────────────────
    disableConsoleOutput: false,                // keep console for error logs
    domainLock: [],                             // optionally lock to domain
    domainLockRedirectUrl: "about:blank",
    forceTransformStrings: [],
    reservedNames: [],
    reservedStrings: [],
    rotateStringArray: true,
    shuffleStringArray: true,
    simplify: true,
    transformObjectKeys: true,

    // ── Source map ──────────────────────────────────────────────────────────
    sourceMap: false,
    sourceMapMode: "separate",

    // ── Caller overrides ────────────────────────────────────────────────────
    ...overrides,
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Inject a site token constant at the top of the source before obfuscation.
 * The constant replaces the __SPECTER_SITE_TOKEN__ placeholder used by the
 * SDK source so each variant is uniquely bound to one site.
 *
 * @param {string} source
 * @param {string} token
 * @returns {string}
 */
function bakeToken(source, token) {
  const escapedToken = JSON.stringify(token); // safe string literal
  const injection = `var __SPECTER_SITE_TOKEN__=${escapedToken};`;

  // Replace placeholder if present, otherwise prepend
  if (source.includes("__SPECTER_SITE_TOKEN__")) {
    return source.replace(
      /var\s+__SPECTER_SITE_TOKEN__\s*=\s*["'][^"']*["']\s*;/,
      injection
    );
  }
  return injection + "\n" + source;
}

/**
 * Run the obfuscator and write output to disk.
 *
 * @param {string} source   Raw JS source string
 * @param {string} outPath  Absolute path for the output file
 * @param {object} opts     Obfuscator options
 */
function obfuscate(source, outPath, opts) {
  const result = JavaScriptObfuscator.obfuscate(source, opts);
  fs.writeFileSync(outPath, result.getObfuscatedCode(), "utf8");

  const inKb = (Buffer.byteLength(source, "utf8") / 1024).toFixed(1);
  const outKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(
    `  [obfuscate] ${path.basename(outPath)}  ${inKb} kB -> ${outKb} kB`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Ensure dist/ exists
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  // Read input
  if (!fs.existsSync(INPUT)) {
    console.error(`[obfuscate] ERROR: Input not found: ${INPUT}`);
    console.error(
      "[obfuscate] Run `npm run build` (rollup) first to produce dist/sdk.min.js"
    );
    process.exit(1);
  }

  const source = fs.readFileSync(INPUT, "utf8");
  console.log(`[obfuscate] Input: ${INPUT}`);

  // ── Step 1: Generic obfuscated build ──────────────────────────────────────
  console.log("[obfuscate] Building generic obfuscated bundle...");
  obfuscate(source, OUTPUT_BASE, buildOptions());
  console.log(`[obfuscate] -> ${OUTPUT_BASE}`);

  // ── Step 2: Per-site variant(s) ────────────────────────────────────────────
  const tokens = [];

  if (singleToken) {
    tokens.push(singleToken);
  }

  if (allSites) {
    const sitesFile = path.join(ROOT, "sites.json");
    if (!fs.existsSync(sitesFile)) {
      console.warn(
        "[obfuscate] --all-sites: sites.json not found, skipping per-site variants."
      );
    } else {
      const sites = JSON.parse(fs.readFileSync(sitesFile, "utf8"));
      for (const site of sites) {
        if (site.siteToken) tokens.push(site.siteToken);
      }
    }
  }

  if (tokens.length > 0) {
    console.log(
      `[obfuscate] Building ${tokens.length} per-site variant(s)...`
    );
    for (const token of tokens) {
      // Sanitise token for use in filename
      const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, "_");
      const outPath = path.join(DIST, `sdk.${safeToken}.js`);
      const bakedSource = bakeToken(source, token);

      // Use a unique identifiersPrefix per site so variables differ across
      // sites, making cross-site correlation harder even for a determined actor.
      const prefix = `_$${safeToken.substring(0, 4)}`;
      obfuscate(bakedSource, outPath, buildOptions({ identifiersPrefix: prefix }));
      console.log(`[obfuscate] -> ${outPath}  (token: ${token})`);
    }
  }

  console.log("[obfuscate] Done.");
}

main();
