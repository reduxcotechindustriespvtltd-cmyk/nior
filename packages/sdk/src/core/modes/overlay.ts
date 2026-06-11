const OVERLAY_ID = '__sp_mo'

interface OverlayConfig {
  title?: string
  message?: string
  returnAt?: number
  contact?: string
}

export function executeOverlayMode(config: OverlayConfig = {}): void {
  if (document.getElementById(OVERLAY_ID)) return

  const {
    title = 'Under Maintenance',
    message = 'We\'ll be back shortly. Thank you for your patience.',
    returnAt,
    contact,
  } = config

  const returnLine = returnAt
    ? `<p style="margin:8px 0 0;font-size:13px;color:#888">Expected back: ${new Date(returnAt).toLocaleString()}</p>`
    : ''
  const contactLine = contact
    ? `<p style="margin:8px 0 0;font-size:13px;color:#888">Contact: <a href="mailto:${contact}" style="color:#a78bfa">${contact}</a></p>`
    : ''

  const el = document.createElement('div')
  el.id = OVERLAY_ID
  el.innerHTML = `
    <style>
      @keyframes __sp_pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      @keyframes __sp_in { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
      #${OVERLAY_ID} { position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;
        justify-content:center;background:rgba(0,0,0,.85);backdrop-filter:blur(12px);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
      #__sp_card { background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
        border-radius:20px;padding:48px 40px;max-width:440px;width:90%;text-align:center;
        animation:__sp_in .4s ease; }
      #__sp_icon { font-size:48px;margin-bottom:20px;display:block;
        animation:__sp_pulse 2.5s ease-in-out infinite; }
      #__sp_title { color:#fff;font-size:24px;font-weight:600;margin:0 0 12px; }
      #__sp_msg { color:#aaa;font-size:15px;line-height:1.6;margin:0; }
    </style>
    <div id="__sp_card">
      <span id="__sp_icon">⚙️</span>
      <h1 id="__sp_title">${title}</h1>
      <p id="__sp_msg">${message}</p>
      ${returnLine}${contactLine}
    </div>
  `
  document.documentElement.appendChild(el)
  document.body.style.overflow = 'hidden'
}

export function undoOverlayMode(): void {
  document.getElementById(OVERLAY_ID)?.remove()
  document.body.style.overflow = ''
}
