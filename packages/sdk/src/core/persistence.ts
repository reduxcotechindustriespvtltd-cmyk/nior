/**
 * Specter SDK — Persistence Layer
 *
 * Handles:
 *  - Service Worker registration + self-healing re-registration
 *  - IndexedDB read/write for kill state across page visits
 *  - BroadcastChannel listener to receive SW state updates
 *  - MutationObserver to detect script-tag removal and reinstall SW
 */

import type { KillState, SwMsgStateUpdate } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDB_DB_NAME = 'specter';
const IDB_STORE_NAME = 'state';
const IDB_KEY = 'kill-state';
const IDB_VERSION = 1;
const BROADCAST_CHANNEL_NAME = 'specter-ipc';
const SW_SCOPE = '/';

// ---------------------------------------------------------------------------
// Service Worker installation
// ---------------------------------------------------------------------------

/**
 * Registers the Specter Service Worker at `swUrl`.
 *
 * - Handles environments where SW is not supported (SSR, old browsers).
 * - Sets up a BroadcastChannel listener so kill-state updates pushed by the
 *   SW are forwarded to the in-page SpectreClient.
 * - Watches the DOM for removal of the SDK script tag and re-installs the SW.
 *
 * @returns The ServiceWorkerRegistration, or null when unavailable.
 */
export async function installServiceWorker(
  swUrl: string,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: SW_SCOPE,
      updateViaCache: 'none', // always re-check for SW updates on each navigation
    });

    // Kick an immediate update check so any newly-deployed SW is picked up
    registration.update().catch(() => {
      // Non-fatal; SW may not be reachable right now
    });

    // Listen for state messages arriving from the SW via BroadcastChannel
    _setupBroadcastListener();

    return registration;
  } catch (err) {
    // SW registration failed (e.g., wrong origin, insecure context) — non-fatal
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[specter] SW registration failed:', err);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// BroadcastChannel listener
// ---------------------------------------------------------------------------

/** Callback registry populated by the SDK client layer. */
const _stateListeners: Array<(state: KillState | null) => void> = [];

/**
 * Register a callback to be invoked whenever the SW broadcasts a state update.
 * Called internally by SpectreClient.
 */
export function onStateUpdate(
  cb: (state: KillState | null) => void,
): () => void {
  _stateListeners.push(cb);
  return () => {
    const idx = _stateListeners.indexOf(cb);
    if (idx !== -1) _stateListeners.splice(idx, 1);
  };
}

let _broadcastSetup = false;

function _setupBroadcastListener(): void {
  if (_broadcastSetup) return;
  _broadcastSetup = true;

  try {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.onmessage = (event: MessageEvent<SwMsgStateUpdate>) => {
      if (event.data?.type === 'STATE_UPDATE') {
        const payload = event.data.payload ?? null;
        for (const cb of _stateListeners) {
          try {
            cb(payload);
          } catch {
            // Individual listener errors must not break the chain
          }
        }
      }
    };

    // Also listen on the navigator.serviceWorker channel for browsers that
    // route SW messages through it instead of BroadcastChannel
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener(
        'message',
        (event: MessageEvent<SwMsgStateUpdate>) => {
          if (event.data?.type === 'STATE_UPDATE') {
            const payload = event.data.payload ?? null;
            for (const cb of _stateListeners) {
              try {
                cb(payload);
              } catch {
                // non-fatal
              }
            }
          }
        },
      );
    }
  } catch {
    // BroadcastChannel not available — silent fallback
  }
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function _openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persist a KillState snapshot to IndexedDB.
 * Called after every successful poll / SW message so state survives restarts.
 */
export async function saveStateToIDB(state: KillState): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await _openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(state, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IDB write failure is non-fatal; we still have the in-memory state
  }
}

/**
 * Load a previously-persisted KillState from IndexedDB.
 * Called on SDK init so the kill switch fires before the first network poll
 * completes (or if the network is unavailable).
 */
export async function loadStateFromIDB(): Promise<KillState | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await _openDB();
    const result = await new Promise<KillState | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as KillState) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Self-healing: detect script-tag removal and reinstall
// ---------------------------------------------------------------------------

/**
 * Watch the entire document for removal of the Specter SDK script element.
 * If the tag is removed (e.g., by a page mutation or aggressive CSP cleanup),
 * we re-register the SW and re-append a minimal script tag so execution
 * continues uninterrupted.
 *
 * @param siteToken  The data-sid value used to identify our script tag.
 * @param endpoint   CDN base URL used to re-create the script tag.
 */
export function setupSelfHealing(siteToken: string, endpoint: string): void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let _healingInProgress = false;

  const _heal = async () => {
    if (_healingInProgress) return;
    _healingInProgress = true;

    try {
      // Re-register SW
      const swUrl = `${endpoint}/specter-sw.js`;
      await installServiceWorker(swUrl);

      // Re-append script tag if completely gone from DOM
      const existing = document.querySelector<HTMLScriptElement>(
        `script[data-sid="${CSS.escape(siteToken)}"]`,
      );
      if (!existing) {
        const script = document.createElement('script');
        script.src = `${endpoint}/v1/sdk.js`;
        script.async = true;
        script.setAttribute('data-sid', siteToken);
        script.setAttribute('data-e', endpoint);
        // Place in <head> — harder to accidentally remove than <body>
        (document.head ?? document.documentElement).appendChild(script);
      }
    } finally {
      _healingInProgress = false;
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      for (const node of Array.from(mutation.removedNodes)) {
        if (
          node instanceof HTMLScriptElement &&
          (node.getAttribute('data-sid') === siteToken ||
            (node.src ?? '').includes('specter'))
        ) {
          void _heal();
          return;
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
