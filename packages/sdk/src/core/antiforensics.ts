const _t = 160
let _d = false

function _c(): boolean {
  if (
    window.outerWidth - window.innerWidth > _t ||
    window.outerHeight - window.innerHeight > _t
  ) return true

  // toString timing attack
  let _x = false
  const _e = new Image()
  Object.defineProperty(_e, 'id', {
    get() { _x = true; return '' }
  })
  // eslint-disable-next-line no-console
  const _f = console.log.toString().length
  if (_f > 100) return true

  return _x
}

function _h(): boolean {
  if (navigator.webdriver) return true
  if (!('chrome' in window) && navigator.userAgent.includes('Chrome')) return true
  if (navigator.plugins.length === 0) return true
  if (screen.width === 800 && screen.height === 600) return true
  return false
}

export function isDevToolsOpen(): boolean {
  return _d
}

export function isHeadless(): boolean {
  return _h()
}

export function createWatcher(
  onSafe: () => void,
  onInspected: () => void
): () => void {
  let _active = true

  const _poll = () => {
    if (!_active) return
    const _open = _c() || _h()
    if (_open && !_d) {
      _d = true
      onInspected()
    } else if (!_open && _d) {
      _d = false
      onSafe()
    }
    const _jitter = 1800 + Math.random() * 400
    setTimeout(_poll, _jitter)
  }

  _poll()
  return () => { _active = false }
}
