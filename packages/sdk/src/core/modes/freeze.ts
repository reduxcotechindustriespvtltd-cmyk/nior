const OVERLAY_ID = '__sp_fo'

export function executeFreezeMode(): void {
  if (document.getElementById(OVERLAY_ID)) return

  const el = document.createElement('div')
  el.id = OVERLAY_ID
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'pointer-events:all', 'cursor:not-allowed',
    'background:transparent', 'user-select:none',
  ].join(';')
  document.documentElement.appendChild(el)

  const _block = (e: Event) => { e.stopImmediatePropagation(); e.preventDefault() }
  const _events = ['click','mousedown','mouseup','keydown','keyup','keypress','touchstart','touchend','submit']
  _events.forEach(ev => document.addEventListener(ev, _block, { capture: true }))

  const _origScroll = window.scrollTo.bind(window)
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}

  ;(el as any).__cleanup = () => {
    _events.forEach(ev => document.removeEventListener(ev, _block, { capture: true }))
    window.scrollTo = _origScroll
  }
}

export function undoFreezeMode(): void {
  const el = document.getElementById(OVERLAY_ID)
  if (!el) return
  ;(el as any).__cleanup?.()
  el.remove()
}
