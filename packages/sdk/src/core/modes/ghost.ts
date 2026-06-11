let _patched = false

export function executeGhostMode(): void {
  if (_patched) return
  _patched = true

  // Silently swallow all fetch calls
  const _origFetch = window.fetch
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      const res = await _origFetch(...args)
      return res
    } catch {
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
  }

  // Break XHR silently
  const _origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function(...args: any[]) {
    _origOpen.apply(this, args)
    this.addEventListener('readystatechange', () => {
      if (this.readyState === 4) {
        Object.defineProperty(this, 'status', { get: () => 200 })
        Object.defineProperty(this, 'responseText', { get: () => '{}' })
      }
    })
  }

  // Freeze timers — queued but never fire
  const _origSetTimeout = window.setTimeout
  const _origSetInterval = window.setInterval
  ;(window as any).__sp_timers = []
  window.setTimeout = (fn: any, delay?: number, ...args: any[]) => {
    if (delay && delay < 100) return _origSetTimeout(fn, delay, ...args)
    const id = Math.random()
    ;(window as any).__sp_timers.push(id)
    return id as any
  }
  window.setInterval = (_fn: any, _delay?: number) => {
    return Math.random() as any
  }

  // Suppress all console errors so devs don't see clues
  console.error = () => {}
  console.warn = () => {}
}
