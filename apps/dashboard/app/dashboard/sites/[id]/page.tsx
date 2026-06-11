'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Globe, Layers, Navigation, Ghost, Lock, Bomb,
  Copy, Check, Zap, Clock, ExternalLink, Loader2, Trash2, Terminal,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  useSite, useSiteEvents, useSiteSnippet, useKillSite, useRestoreSite, useDeleteSite,
} from '@/lib/hooks'

type SiteMode = 'freeze' | 'overlay' | 'redirect' | 'ghost' | 'timebomb' | 'none'

const MODES: { id: SiteMode; label: string; icon: React.ElementType; description: string; color: string }[] = [
  { id: 'freeze',   label: 'Freeze',   icon: Lock,       description: 'Return a 503. Site appears down.', color: 'text-blue-400' },
  { id: 'overlay',  label: 'Overlay',  icon: Layers,     description: 'Show a branded maintenance page.', color: 'text-purple-400' },
  { id: 'redirect', label: 'Redirect', icon: Navigation, description: 'Send visitors to another URL.', color: 'text-yellow-400' },
  { id: 'ghost',    label: 'Ghost',    icon: Ghost,      description: 'Site loads but is read-only.', color: 'text-cyan-400' },
  { id: 'timebomb', label: 'Timebomb', icon: Bomb,       description: 'Automatically kill at a set time.', color: 'text-orange-400' },
]

function ConfirmModal({ isKilled, onConfirm, onCancel, busy }: {
  isKilled: boolean; onConfirm: () => void; onCancel: () => void; busy: boolean
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative glass rounded-2xl p-8 max-w-sm w-full z-10 border border-white/10"
        style={{ background: 'rgba(10,10,10,0.97)' }}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto ${
          isKilled ? 'bg-emerald-400/10 border border-emerald-400/20' : 'bg-red-500/10 border border-red-500/20'
        }`}>
          <Zap size={24} className={isKilled ? 'text-emerald-400' : 'text-red-400'} />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-2">{isKilled ? 'Restore Site?' : 'Kill Site?'}</h2>
        <p className="text-white/50 text-sm text-center mb-8">
          {isKilled
            ? 'The site will go live immediately for all visitors.'
            : 'Visitors will immediately see the configured kill mode. This is logged.'}
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <motion.button onClick={onConfirm} disabled={busy} whileTap={{ scale: 0.97 }}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
              isKilled ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
            }`}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {isKilled ? 'Yes, restore' : 'Yes, kill it'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ModeConfigPanel({ mode, config, onChange }: {
  mode: SiteMode
  config: Record<string, any>
  onChange: (c: Record<string, any>) => void
}) {
  if (mode === 'freeze' || mode === 'ghost' || mode === 'none') {
    return (
      <div className="text-white/30 text-sm text-center py-8 border border-dashed border-white/8 rounded-xl">
        No configuration needed for this mode.
      </div>
    )
  }
  if (mode === 'redirect') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <label className="text-white/50 text-xs uppercase tracking-widest block">Redirect URL</label>
        <input type="url" className="sp-input w-full"
          placeholder="https://example.com/maintenance"
          value={config.url ?? ''}
          onChange={e => onChange({ ...config, url: e.target.value })} />
        <p className="text-white/25 text-xs">Visitors will be sent a 302 redirect to this URL.</p>
      </motion.div>
    )
  }
  if (mode === 'overlay') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div>
          <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Title</label>
          <input type="text" className="sp-input w-full" placeholder="We'll be right back"
            value={config.title ?? ''}
            onChange={e => onChange({ ...config, title: e.target.value })} />
        </div>
        <div>
          <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Message</label>
          <textarea rows={3} className="sp-input w-full resize-none"
            placeholder="We're performing scheduled maintenance..."
            value={config.message ?? ''}
            onChange={e => onChange({ ...config, message: e.target.value })} />
        </div>
        <div>
          <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Return Time</label>
          <input type="datetime-local" className="sp-input w-full"
            value={config.returnTime ?? ''} style={{ colorScheme: 'dark' }}
            onChange={e => onChange({ ...config, returnTime: e.target.value })} />
        </div>
      </motion.div>
    )
  }
  if (mode === 'timebomb') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <label className="text-white/50 text-xs uppercase tracking-widest block">Detonate At</label>
        <input type="datetime-local" className="sp-input w-full"
          value={config.detonateAt ?? ''} style={{ colorScheme: 'dark' }}
          onChange={e => onChange({ ...config, detonateAt: e.target.value })} />
        <p className="text-white/25 text-xs">The site will be killed automatically at this time.</p>
      </motion.div>
    )
  }
  return null
}

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative">
      {label && <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest mb-1.5">{label}</p>}
      <pre className="text-[11px] font-mono text-white/60 bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed pr-16">
        {code}
      </pre>
      <motion.button onClick={copy} whileTap={{ scale: 0.95 }}
        className="absolute top-6 right-2.5 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/40 text-[10px] hover:bg-white/[0.10] transition-colors">
        <AnimatePresence mode="wait">
          {copied
            ? <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-emerald-400"><Check size={9} />done</motion.span>
            : <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Copy size={9} />copy</motion.span>
          }
        </AnimatePresence>
      </motion.button>
    </div>
  )
}

type FW = 'next' | 'react' | 'express' | 'html' | 'wp'

const FW_LABELS: Record<FW, string> = {
  next: 'Next.js', react: 'React', express: 'Express', html: 'HTML', wp: 'WordPress',
}

const CLI_FILES: Record<FW, { file: string; note: string }[]> = {
  next:    [{ file: 'middleware.ts', note: 'server-side kill before render' }, { file: 'public/sw.js', note: 'client fallback' }, { file: '.env.local', note: 'stores your token' }],
  react:   [{ file: 'src/main.tsx', note: 'root wrapped in provider' }, { file: 'public/sw.js', note: 'client fallback' }, { file: '.env', note: 'stores your token' }],
  express: [{ file: '.env', note: 'stores your token' }],
  html:    [{ file: 'sw.js', note: 'worker stub — save to domain root' }],
  wp:      [{ file: 'sw.js', note: 'worker stub — save to domain root' }],
}

function SnippetSection({ siteId }: { siteId: string }) {
  const { data, isLoading } = useSiteSnippet(siteId)
  const [tab, setTab] = useState<'cli' | 'manual'>('cli')
  const [fw,  setFw]  = useState<FW>('next')

  const token   = data?.siteToken ?? ''
  const srcUrl  = data?.tag?.match(/src="([^"]+)"/)?.[1] ?? ''

  const manualCode: Record<FW, string> = {
    next:    `// middleware.ts\nimport { withSpecter } from '@rcti/noir/next'\n\nexport default withSpecter({\n  token: process.env.SPECTER_TOKEN!,\n  apiUrl: process.env.SPECTER_API_URL,\n})\n\nexport const config = {\n  matcher: ['/((?!_next|api|favicon).*)'],\n}`,
    react:   `// src/main.tsx\nimport { SpecterProvider } from '@rcti/noir/react'\n\n// Wrap your root render:\n<SpecterProvider\n  token={import.meta.env.VITE_SPECTER_TOKEN}\n  apiUrl={import.meta.env.VITE_SPECTER_API_URL}\n>\n  <App />\n</SpecterProvider>`,
    express: `// app.ts — before your routes\nimport { specterMiddleware } from '@rcti/noir/node'\n\napp.use(specterMiddleware({\n  token: process.env.SPECTER_TOKEN,\n  apiUrl: process.env.SPECTER_API_URL,\n}))`,
    html:    data?.tag ?? '',
    wp:      `// functions.php\nfunction noir_tag() {\n  echo '${data?.tag ?? ''}';\n}\nadd_action('wp_head', 'noir_tag', 1);`,
  }

  const swHint: Record<FW, string> = {
    next:    'Save as public/sw.js — Next.js serves /public as root.',
    react:   'Save as public/sw.js — Vite / CRA serve /public as root.',
    express: 'Save to your static files root.',
    html:    'Upload to your domain root via FTP or file manager.',
    wp:      'Upload to your WordPress domain root via FTP.',
  }

  const cliFiles = CLI_FILES[fw]

  return (
    <div className="glass rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between gap-3">
        <h3 className="text-white font-semibold">Install</h3>
        <div className="flex gap-1">
          {(['cli', 'manual'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all ${
                tab === t
                  ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                  : 'text-white/30 hover:text-white/60'
              }`}>
              {t === 'cli' ? <><Terminal size={10} />Auto</> : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={16} className="text-white/25 animate-spin" />
        </div>
      ) : tab === 'cli' ? (

        /* ── CLI tab ─────────────────────────────────────────────────── */
        <div className="p-4 space-y-4">

          {/* Step 1 — token */}
          <div>
            <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest mb-1.5">1 · Copy your token</p>
            <CopyBlock code={token} />
          </div>

          {/* Step 2 — command */}
          <div>
            <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest mb-1.5">2 · Run in your project</p>
            <CopyBlock code="npx @rcti/noir@latest init" />
          </div>

          {/* Framework selector + what gets created */}
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 space-y-3">
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(FW_LABELS) as FW[]).map(f => (
                <button key={f} onClick={() => setFw(f)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all ${
                    fw === f
                      ? 'bg-white/[0.1] text-white border border-white/[0.15]'
                      : 'text-white/30 border border-white/[0.05] hover:text-white/60'
                  }`}>
                  {FW_LABELS[f]}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-white/25 text-[10px] font-mono uppercase tracking-widest">Creates</p>
              {cliFiles.map(({ file, note }) => (
                <div key={file} className="flex items-center gap-2">
                  <Check size={9} className="text-emerald-400 shrink-0" />
                  <span className="text-white/60 text-[11px] font-mono">{file}</span>
                  <span className="text-white/20 text-[10px]">— {note}</span>
                </div>
              ))}
              {fw === 'express' && (
                <div className="flex items-center gap-2">
                  <Check size={9} className="text-white/20 shrink-0" />
                  <span className="text-white/30 text-[11px]">shows the 1-line app.use() to add</span>
                </div>
              )}
            </div>
            <p className="text-white/30 text-[11px] leading-relaxed pt-0.5">
              Paste your token when prompted. The CLI auto-detects your framework.
            </p>
          </div>

          <p className="text-white/20 text-[10px]">
            No npm?{' '}
            <button className="underline text-white/35 hover:text-white/60 transition-colors"
              onClick={() => setTab('manual')}>
              Switch to Manual
            </button>
          </p>
        </div>

      ) : (

        /* ── Manual tab ─────────────────────────────────────────────── */
        <div className="p-4 space-y-4">

          {/* Framework selector */}
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(FW_LABELS) as FW[]).map(f => (
              <button key={f} onClick={() => setFw(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                  fw === f
                    ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                    : 'text-white/25 hover:text-white/55'
                }`}>
                {FW_LABELS[f]}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={fw} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
              className="space-y-4">

              {(fw === 'html' || fw === 'wp') ? (
                <>
                  {/* SW stub */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[10px] text-white/40 font-mono">1</div>
                      <p className="text-white/60 text-xs font-semibold">Add worker file to domain root</p>
                    </div>
                    <CopyBlock code={data?.swStub ?? ''} label="save as /sw.js" />
                    <p className="text-white/20 text-[10px] mt-1.5">{swHint[fw]}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/[0.05]" />
                    <span className="text-white/15 text-[10px] font-mono">then</span>
                    <div className="flex-1 h-px bg-white/[0.05]" />
                  </div>

                  {/* Tag / function */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[10px] text-white/40 font-mono">2</div>
                      <p className="text-white/60 text-xs font-semibold">
                        {fw === 'wp' ? 'Add to functions.php' : 'Paste in <head> on any page'}
                      </p>
                    </div>
                    <CopyBlock code={manualCode[fw]} />
                    <p className="text-white/20 text-[10px] mt-1.5">
                      The worker covers all pages once registered — only needed on one page.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* npm install */}
                  <div>
                    <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest mb-1.5">1 · Install</p>
                    <CopyBlock code="npm install @rcti/noir" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/[0.05]" />
                    <span className="text-white/15 text-[10px] font-mono">then</span>
                    <div className="flex-1 h-px bg-white/[0.05]" />
                  </div>

                  {/* Code snippet */}
                  <div>
                    <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest mb-1.5">2 · Add to your project</p>
                    <CopyBlock code={manualCode[fw]} />
                    {fw !== 'express' && (
                      <p className="text-white/20 text-[10px] mt-1.5">{swHint[fw]}</p>
                    )}
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>

        </div>
      )}
    </div>
  )
}

export default function SiteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const siteId = params.id as string

  const { data: site, isLoading } = useSite(siteId)
  const { data: eventsData } = useSiteEvents(siteId)
  const kill = useKillSite(siteId)
  const restore = useRestoreSite(siteId)
  const deleteSite = useDeleteSite()

  const [selectedMode, setSelectedMode] = useState<SiteMode | null>(null)
  const [modeConfig, setModeConfig] = useState<Record<string, any>>({})
  const [showConfirm, setShowConfirm] = useState(false)

  if (isLoading || !site) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    )
  }

  const isKilled = site.isKilled
  const activeMode = (selectedMode ?? site.killMode ?? 'freeze') as SiteMode
  const events = eventsData?.events ?? site.events ?? []

  function handleToggle() { setShowConfirm(true) }

  function handleConfirm() {
    setShowConfirm(false)
    if (isKilled) {
      restore.mutate()
    } else {
      const config = activeMode === 'none' ? {} : modeConfig
      kill.mutate({ mode: activeMode === 'none' ? 'freeze' : activeMode, config })
    }
  }

  const busy = kill.isPending || restore.isPending

  return (
    <div className="space-y-0">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div animate={{ opacity: isKilled ? 1 : 0 }} transition={{ duration: 0.8 }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,45,85,0.07) 0%, transparent 70%)' }} />
      </div>

      {/* Breadcrumb header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm">
          <ArrowLeft size={15} />
          Sites
        </button>
        <span className="text-white/15">/</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isKilled ? 'bg-red-500' : 'bg-emerald-400'}`}
            style={{ boxShadow: isKilled ? '0 0 6px rgba(255,45,85,0.8)' : '0 0 6px rgba(52,211,153,0.8)' }} />
          <span className="text-white font-semibold text-sm font-mono">{site.domain}</span>
        </div>
        <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono ${
          isKilled
            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
            : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
        }`}>
          {isKilled ? 'KILLED' : 'LIVE'}
        </div>
        <a href={`https://${site.domain}`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-white/25 hover:text-white/60 transition-colors text-xs">
          <ExternalLink size={12} />
        </a>
        <button onClick={() => deleteSite.mutate(siteId, { onSuccess: () => router.push('/dashboard/sites') })}
          className="p-1.5 rounded-lg text-white/20 hover:text-red-400 transition-colors"
          title="Delete site">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* LEFT */}
        <div className="space-y-6">

          {/* Kill switch hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-10 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: isKilled
                  ? 'radial-gradient(ellipse at 50% 0%, rgba(255,45,85,0.06) 0%, transparent 60%)'
                  : 'transparent',
                transition: 'background 0.6s ease',
              }} />

            <p className="text-white/30 text-xs uppercase tracking-widest mb-8 font-mono">Kill Switch</p>

            {/* The button */}
            <div className="relative mb-8">
              <AnimatePresence>
                {isKilled && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.2, 0.4] }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full border-2 border-red-500/30"
                    style={{ width: 140, height: 140 }} />
                )}
              </AnimatePresence>

              <motion.button
                onClick={handleToggle}
                disabled={busy}
                whileTap={{ scale: 0.92 }}
                className={`w-[110px] h-[110px] rounded-full flex items-center justify-center transition-all duration-500 disabled:opacity-60 ${
                  isKilled
                    ? 'border-2 border-red-500/50 bg-red-500/10'
                    : 'border-2 border-white/10 bg-white/[0.03]'
                }`}
                style={{
                  boxShadow: isKilled
                    ? '0 0 40px rgba(255,45,85,0.25), inset 0 0 30px rgba(255,45,85,0.05)'
                    : '0 0 20px rgba(255,255,255,0.04)',
                }}>
                {busy ? (
                  <Loader2 size={36} className="text-white/50 animate-spin" />
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v9M18.36 5.64A9 9 0 1 1 5.64 5.64"
                      stroke={isKilled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'}
                      strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                )}
              </motion.button>
            </div>

            <motion.div key={String(isKilled)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
              <span className={`text-2xl font-bold ${isKilled ? 'text-red-400' : 'text-emerald-400'}`}>
                {isKilled ? 'Site is Killed' : 'Site is Live'}
              </span>
            </motion.div>
            <p className="text-white/30 text-sm">
              {isKilled ? `Mode: ${activeMode} — click to restore` : 'Click the switch to kill the site'}
            </p>
            {events.length > 0 && (
              <p className="text-white/20 text-xs mt-4 flex items-center gap-1 font-mono">
                <Clock size={11} />
                Last action {formatDistanceToNow(new Date(events[0].activatedAt), { addSuffix: true })}
              </p>
            )}
          </motion.div>

          {/* Mode selector */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-white font-semibold">Kill Mode</h3>
              <p className="text-white/40 text-xs mt-0.5">What happens to visitors when the site is killed.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODES.map(m => {
                const ModeIcon = m.icon
                const isActive = activeMode === m.id
                return (
                  <motion.button key={m.id} onClick={() => { setSelectedMode(m.id); setModeConfig({}) }}
                    whileTap={{ scale: 0.98 }}
                    className={`text-left flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'border-red-500/30 bg-red-500/[0.06]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                    }`}>
                    <div className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-red-400' : m.color}`}>
                      <ModeIcon size={16} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-white/70'}`}>{m.label}</p>
                      <p className="text-white/35 text-xs mt-0.5">{m.description}</p>
                    </div>
                    {isActive && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* Config */}
            <div className="pt-2 border-t border-white/[0.05]">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-4 font-mono">Mode Configuration</p>
              <AnimatePresence mode="wait">
                <motion.div key={activeMode}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                  <ModeConfigPanel mode={activeMode} config={modeConfig} onChange={setModeConfig} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">

          {/* Snippet */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <SnippetSection siteId={siteId} />
          </motion.div>

          {/* Site info */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-5 space-y-3">
            <h3 className="text-white font-semibold text-sm">Site Info</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Name', value: site.name },
                { label: 'Domain', value: site.domain },
                { label: 'Token', value: site.siteToken, mono: true },
                { label: 'Events', value: String(eventsData?.total ?? site._count?.events ?? 0) },
                { label: 'Created', value: format(new Date(site.createdAt), 'MMM d, yyyy') },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-white/35 text-xs">{row.label}</span>
                  <span className={`text-white/75 text-xs ${row.mono ? 'font-mono bg-white/5 px-1.5 py-0.5 rounded text-[10px]' : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Event history */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
            className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Event History</h3>
              <span className="text-white/30 text-xs font-mono">{eventsData?.total ?? events.length} events</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-white/25 text-sm text-center py-10">No events yet.</p>
              ) : (
                events.map((event: any, i: number) => (
                  <motion.div key={event.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex gap-3 px-5 py-4 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        event.deactivatedAt ? 'bg-emerald-400' : 'bg-red-500'
                      }`} />
                      {i < events.length - 1 && <div className="w-px flex-1 mt-1 bg-white/6 min-h-[24px]" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${event.deactivatedAt ? 'text-emerald-400' : 'text-red-400'}`}>
                          {event.deactivatedAt ? 'Restored' : 'Killed'}
                        </span>
                        {event.mode && event.mode !== 'none' && (
                          <span className="text-white/30 text-[10px] px-1.5 py-0.5 rounded bg-white/5 font-mono uppercase">
                            {event.mode}
                          </span>
                        )}
                      </div>
                      <p className="text-white/25 text-xs mt-1 font-mono">
                        {formatDistanceToNow(new Date(event.activatedAt), { addSuffix: true })}
                      </p>
                      {event.deactivatedAt && (
                        <p className="text-white/15 text-xs">
                          Restored {formatDistanceToNow(new Date(event.deactivatedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal isKilled={isKilled} onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)} busy={busy} />
        )}
      </AnimatePresence>
    </div>
  )
}
