/**
 * Specter Service Worker
 *
 * Responsibilities:
 *  1. Immediately activate on install (skipWaiting + clients.claim).
 *  2. Persist kill state in the Cache API so it survives full page reloads.
 *  3. Intercept fetch requests to Specter CDN endpoints and serve from cache
 *     so the kill-check logic cannot be neutered by re-deploying / removing
 *     script tags from the network layer.
 *  4. Serve itself (/specter-sw.js) from cache — self-preservation against
 *     network-level removal.
 *  5. Handle postMessage IPC from the main thread (SET_KILL / GET_STATE).
 *  6. Broadcast state changes to all open tabs via clients.matchAll().
 *  7. Handle Background Sync events so a pending check can fire when the
 *     page is closed and later re-opened.
 */

/// <reference lib="webworker" />
/// <reference types="@types/serviceworker" />

import type {
  KillState,
  SwMessage,
  SwMsgStateUpdate,
  KillMode,
  KillModeConfig,
} from '../../types';

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_NAME = 'specter-v1';
const STATE_CACHE_KEY = 'https://specter.internal/kill-state';
const SW_SELF_KEY = 'https://specter.internal/sw-self';
const CDN_ORIGIN_PATTERN = /specter(?:cdn|\.io|\.app|\.dev)/i;
const BROADCAST_CHANNEL = 'specter-ipc';
const SW_SCRIPT_PATH = '/specter-sw.js';
const STATE_VERSION = 1;

// ---------------------------------------------------------------------------
// Install — skip waiting so the new SW takes over immediately
// ---------------------------------------------------------------------------

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Cache own script for self-preservation
      const cache = await caches.open(CACHE_NAME);
      const swRequest = new Request(SW_SCRIPT_PATH);
      try {
        const swResponse = await fetch(swRequest);
        if (swResponse.ok) {
          await cache.put(SW_SELF_KEY, swResponse.clone());
          await cache.put(swRequest, swResponse.clone());
        }
      } catch {
        // If we cannot fetch ourselves at install time (e.g., offline),
        // we simply skip — the cache entry will be written on the next
        // successful fetch intercept.
      }
      await self.skipWaiting();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Activate — claim all clients immediately
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Remove stale caches from previous SW versions
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('specter-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
      // Broadcast current state to any already-open tabs
      await broadcastState();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Message handler — IPC with main thread
// ---------------------------------------------------------------------------

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data as SwMessage;
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'SET_KILL') {
    event.waitUntil(
      (async () => {
        const { kill, mode, config } = msg.payload;
        const state = await buildKillState(kill, mode, config);
        await persistState(state);
        await broadcastState(state);
      })(),
    );
  }

  if (msg.type === 'GET_STATE') {
    event.waitUntil(
      (async () => {
        const state = await loadState();
        const reply: SwMsgStateUpdate = { type: 'STATE_UPDATE', payload: state };
        // Reply to the specific client that asked
        if (event.source) {
          (event.source as Client).postMessage(reply);
        }
      })(),
    );
  }
});

// ---------------------------------------------------------------------------
// Fetch handler — intercept CDN + self-serve SW script
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Self-preservation: serve our own script from cache
  if (url.pathname === SW_SCRIPT_PATH || url.href === SW_SELF_KEY) {
    event.respondWith(serveSelf(request));
    return;
  }

  // Intercept Specter CDN requests — network-first with cache fallback
  if (CDN_ORIGIN_PATTERN.test(url.hostname)) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }
});

// ---------------------------------------------------------------------------
// Background Sync — retry kill-state check when page was closed
// ---------------------------------------------------------------------------

self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'specter-kill-check') {
    event.waitUntil(
      (async () => {
        const state = await loadState();
        if (state) {
          await broadcastState(state);
        }
      })(),
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildKillState(
  kill: boolean,
  mode: KillMode,
  config: KillModeConfig,
): Promise<KillState> {
  // Preserve the existing siteToken if already stored
  const existing = await loadState();
  return {
    signal: { kill, mode, config, timestamp: Date.now() },
    siteToken: existing?.siteToken ?? '',
    cachedAt: Date.now(),
    version: STATE_VERSION,
  };
}

async function persistState(state: KillState): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const body = JSON.stringify(state);
  const response = new Response(body, {
    headers: { 'Content-Type': 'application/json' },
  });
  await cache.put(STATE_CACHE_KEY, response);
}

async function loadState(): Promise<KillState | null> {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(STATE_CACHE_KEY);
  if (!response) return null;
  try {
    return (await response.json()) as KillState;
  } catch {
    return null;
  }
}

async function broadcastState(state?: KillState | null): Promise<void> {
  const resolved = state !== undefined ? state : await loadState();
  const message: SwMsgStateUpdate = { type: 'STATE_UPDATE', payload: resolved };

  // Broadcast to all open tabs via clients.matchAll
  const allClients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  });
  for (const client of allClients) {
    client.postMessage(message);
  }

  // Also emit on the BroadcastChannel so non-controlled tabs can listen
  try {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL);
    bc.postMessage(message);
    bc.close();
  } catch {
    // BroadcastChannel not available in all SW environments — non-fatal
  }
}

/** Serve the SW script itself — from cache, falling back to network and re-caching. */
async function serveSelf(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);

  // Try our internal key first, then the real URL
  const cached =
    (await cache.match(SW_SELF_KEY)) ?? (await cache.match(request));
  if (cached) return cached;

  // Not in cache yet — fetch from network and store for future requests
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(SW_SELF_KEY, fresh.clone());
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return new Response('Service worker unavailable', { status: 503 });
  }
}

/** Network-first strategy: try network, cache successful responses, fall back to cache. */
async function networkFirstWithCache(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Network error and no cache available', { status: 503 });
  }
}
