'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Globe, Layers, Navigation, Ghost, Lock, Bomb,
  Copy, Check, Zap, Clock, ExternalLink, Loader2, Trash2, Terminal,
  Power, RefreshCw, AlertTriangle, Shield, Activity, ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  useSite, useSiteEvents, useSiteSnippet, useKillSite, useRestoreSite, useDeleteSite,
} from '@/lib/hooks'
import { StatusBadge } from '@/components/hud/StatusBadge'

type SiteMode = 'freeze' | 'overlay' | 'redirect' | 'ghost' | 'timebomb' | 'none'

const MODES: {
  id: SiteMode
  label: string
  icon: React.ElementType
  description: string
  color: string
  glow: string
}[] = [
  { id: 'freeze',   label: 'Freeze',   icon: Lock,       description: 'Return 503. Site appears fully down.',      color: '#60a5fa', glow: 'rgba(96,165,250,0.15)'  },
  { id: 'overlay',  label: 'Overlay',  icon: Layers,     description: 'Show a branded maintenance page.',           color: '#a78bfa', glow: 'rgba(167,139,250,0.15)' },
  { id: 'redirect', label: 'Redirect', icon: Navigation, description: 'Send all visitors to another URL.',           color: '#facc15', glow: 'rgba(250,204,21,0.15)'  },
  { id: 'ghost',    label: 'Ghost',    icon: Ghost,      description: 'Site loads but is fully read-only.',          color: '#22d3ee', glow: 'rgba(34,211,238,0.15)'  },
  { id: 'timebomb', label: 'Timebomb', icon: Bomb,       description: 'Automatically detonate at a scheduled time.', color: '#fb923c', glow: 'rgba(251,146,60,0.15)'  },
]

// ─── Pulsing kill ring ────────────────────────────────────────────────────────
function KillRings({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <>
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-red-500/20"
              style={{ margin: `-${(i + 1) * 18}px` }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: [0, 0.6, 0], scale: [0.9, 1.08, 1.2] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.4, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Kill power button ────────────────────────────────────────────────────────
function KillButton({
  isKilled,
  busy,
  onClick,
}: {
  isKilled: boolean
  busy: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      {/* Ambient halo */}
      <div
        className="absolute inset-0 rounded-full blur-3xl transition-all duration-700 pointer-events-none"
        style={{
          background: isKilled ? 'rgba(255,45,85,0.25)' : hovered ? 'rgba(255,45,85,0.08)' : 'transparent',
          transform: 'scale(1.4)',
        }}
      />

      {/* Pulse rings */}
      <KillRings active={isKilled} />

      {/* Outer track */}
      <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="70"
          fill="none"
          stroke={isKilled ? 'rgba(255,45,85,0.15)' : 'rgba(255,255,255,0.04)'}
          strokeWidth="1"
          strokeDasharray="4 6"
        />
      </svg>

      {/* The button */}
      <motion.button
        onClick={onClick}
        disabled={busy}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        whileTap={{ scale: 0.92 }}
        className="relative w-28 h-28 rounded-full flex items-center justify-center focus:outline-none disabled:opacity-50 transition-all duration-500"
        style={{
          background: isKilled
            ? 'radial-gradient(circle at center, rgba(255,45,85,0.18) 0%, rgba(255,45,85,0.06) 60%)'
            : 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 60%)',
          border: isKilled
            ? '1.5px solid rgba(255,45,85,0.5)'
            : '1.5px solid rgba(255,255,255,0.1)',
          boxShadow: isKilled
            ? '0 0 60px rgba(255,45,85,0.3), 0 0 20px rgba(255,45,85,0.15), inset 0 0 40px rgba(255,45,85,0.08)'
            : hovered
            ? '0 0 30px rgba(255,45,85,0.12), inset 0 0 20px rgba(255,45,85,0.04)'
            : '0 0 20px rgba(0,0,0,0.3)',
        }}
      >
        {busy ? (
          <Loader2 size={32} className="animate-spin text-white/40" />
        ) : (
          <motion.div
            animate={{ rotate: isKilled ? 0 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v9"
                stroke={isKilled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'}
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ filter: isKilled ? 'drop-shadow(0 0 6px rgba(255,45,85,0.8))' : 'none', transition: 'all 0.4s ease' }}
              />
              <path
                d="M18.36 5.64A9 9 0 1 1 5.64 5.64"
                stroke={isKilled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'}
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ filter: isKilled ? 'drop-shadow(0 0 6px rgba(255,45,85,0.8))' : 'none', transition: 'all 0.4s ease' }}
              />
            </svg>
          </motion.div>
        )}
      </motion.button>
    </div>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({
  isKilled, onConfirm, onCancel, busy,
}: { isKilled: boolean; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        className="relative hud-card p-8 max-w-sm w-full z-10 overflow-hidden"
        style={{ borderColor: isKilled ? 'rgba(52,211,153,0.2)' : 'rgba(255,45,85,0.2)' }}
      >
        {/* Top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: isKilled
              ? 'linear-gradient(90deg, transparent, #34d399 50%, transparent)'
              : 'linear-gradient(90deg, transparent, #FF2D55 50%, transparent)',
          }}
        />

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto relative"
          style={{
            background: isKilled ? 'rgba(52,211,153,0.1)' : 'rgba(255,45,85,0.1)',
            border: isKilled ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(255,45,85,0.25)',
            boxShadow: isKilled ? '0 0 30px rgba(52,211,153,0.12)' : '0 0 30px rgba(255,45,85,0.12)',
          }}
        >
          {isKilled
            ? <RefreshCw size={26} className="text-emerald-400" />
            : <Power size={26} className="text-red-400" />
          }
        </div>

        <h2 className="text-theme text-xl font-bold text-center mb-2 font-mono">
          {isKilled ? 'Restore Site?' : 'Kill Site?'}
        </h2>
        <p className="text-theme-muted text-sm text-center mb-8 leading-relaxed">
          {isKilled
            ? 'The site will go live immediately for all visitors.'
            : 'Visitors will immediately see the kill mode you configured. This action is logged.'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-theme text-theme-muted text-sm hover:bg-theme-surface transition-colors font-mono"
          >
            Cancel
          </button>
          <motion.button
            onClick={onConfirm}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold font-mono flex items-center justify-center gap-2 disabled:opacity-50 transition-all ${
              isKilled
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-red-500 hover:bg-red-600'
            }`}
            style={{
              boxShadow: isKilled ? '0 0 20px rgba(52,211,153,0.25)' : '0 0 20px rgba(255,45,85,0.25)',
            }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {isKilled ? 'Yes, restore' : 'Yes, kill it'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({
  name, onConfirm, onCancel, busy,
}: { name: string; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const [typed, setTyped] = useState('')
  const confirmed = typed.trim().toLowerCase() === 'delete'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 16 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        className="relative hud-card p-8 max-w-sm w-full z-10 overflow-hidden"
        style={{ borderColor: 'rgba(255,45,85,0.25)' }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, #FF2D55 50%, transparent)' }}
        />

        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto"
          style={{
            background: 'rgba(255,45,85,0.08)',
            border: '1px solid rgba(255,45,85,0.2)',
            boxShadow: '0 0 24px rgba(255,45,85,0.1)',
          }}
        >
          <Trash2 size={22} className="text-red-400" />
        </div>

        <h2 className="text-theme text-lg font-bold text-center mb-1 font-mono">Remove Node</h2>
        <p className="text-theme-muted text-sm text-center mb-6 leading-relaxed">
          <span className="text-theme font-semibold font-mono">{name}</span> and all event history will be permanently erased.
        </p>

        <div className="mb-5">
          <p className="text-[11px] text-theme-faint font-mono mb-2 tracking-widest">TYPE "DELETE" TO CONFIRM</p>
          <input
            autoFocus
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            className="w-full bg-theme-surface border border-red-500/20 rounded-xl px-4 py-2.5 text-sm font-mono text-theme focus:outline-none focus:border-red-500/40 transition-colors"
            placeholder="delete"
            style={{ caretColor: '#FF2D55' }}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-theme text-theme-muted text-sm hover:bg-theme-surface transition-colors">
            Cancel
          </button>
          <motion.button
            onClick={onConfirm}
            disabled={busy || !confirmed}
            whileTap={{ scale: 0.97 }}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-30 transition-all"
            style={{
              background: confirmed ? '#dc2626' : 'rgba(220,38,38,0.3)',
              boxShadow: confirmed ? '0 0 20px rgba(220,38,38,0.3)' : 'none',
            }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Remove permanently
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Mode config panel ────────────────────────────────────────────────────────
function ModeConfigPanel({
  mode, config, onChange,
}: { mode: SiteMode; config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  if (mode === 'freeze' || mode === 'ghost' || mode === 'none') {
    return (
      <div className="text-center py-8 rounded-xl border border-dashed border-theme flex flex-col items-center gap-2">
        <Shield size={16} className="text-theme-faint/50" />
        <p className="text-theme-faint text-[11px] font-mono">No configuration required</p>
      </div>
    )
  }
  if (mode === 'redirect') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <label className="hud-label text-[9px]">Redirect URL</label>
        <input type="url" className="sp-input w-full"
          placeholder="https://example.com/maintenance"
          value={config.url ?? ''}
          onChange={e => onChange({ ...config, url: e.target.value })} />
        <p className="text-theme-faint text-[11px]">Visitors receive a 302 redirect to this URL.</p>
      </motion.div>
    )
  }
  if (mode === 'overlay') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {[
          { key: 'title',   label: 'Title',   type: 'text',           placeholder: "We'll be right back" },
          { key: 'message', label: 'Message', type: 'textarea',       placeholder: 'Scheduled maintenance in progress…' },
          { key: 'returnTime', label: 'Return Time', type: 'datetime-local', placeholder: '' },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label className="hud-label text-[9px] block mb-2">{label}</label>
            {type === 'textarea' ? (
              <textarea rows={3} className="sp-input w-full resize-none" placeholder={placeholder}
                value={config[key] ?? ''}
                onChange={e => onChange({ ...config, [key]: e.target.value })} />
            ) : (
              <input type={type} className="sp-input w-full" placeholder={placeholder}
                value={config[key] ?? ''} style={type === 'datetime-local' ? { colorScheme: 'dark' } : {}}
                onChange={e => onChange({ ...config, [key]: e.target.value })} />
            )}
          </div>
        ))}
      </motion.div>
    )
  }
  if (mode === 'timebomb') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <label className="hud-label text-[9px]">Detonate At</label>
        <input type="datetime-local" className="sp-input w-full"
          value={config.detonateAt ?? ''} style={{ colorScheme: 'dark' }}
          onChange={e => onChange({ ...config, detonateAt: e.target.value })} />
        <p className="text-theme-faint text-[11px]">Site will be killed automatically at this UTC time.</p>
      </motion.div>
    )
  }
  return null
}

// ─── Copy block ───────────────────────────────────────────────────────────────
function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative group">
      {label && <p className="hud-label text-[9px] mb-2">{label}</p>}
      <pre
        className="text-[11px] font-mono text-theme-secondary bg-theme-surface border border-theme rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed pr-14"
      >
        {code}
      </pre>
      <motion.button
        onClick={copy}
        whileTap={{ scale: 0.92 }}
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-theme-surface border border-theme text-theme-faint text-[10px] hover:text-theme-muted transition-all opacity-0 group-hover:opacity-100"
      >
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

// ─── Snippet section ──────────────────────────────────────────────────────────
type FW = 'next' | 'react' | 'express' | 'html' | 'wp'
const FW_LABELS: Record<FW, string> = { next: 'Next.js', react: 'React', express: 'Express', html: 'HTML', wp: 'WordPress' }

const CLI_FILES: Record<FW, { file: string; note: string }[]> = {
  next:    [{ file: 'middleware.ts', note: 'server-side intercept' }, { file: 'public/sw.js', note: 'client fallback' }, { file: '.env.local', note: 'token stored here' }],
  react:   [{ file: 'src/main.tsx', note: 'root provider wrap' }, { file: 'public/sw.js', note: 'client fallback' }, { file: '.env', note: 'token stored here' }],
  express: [{ file: '.env', note: 'token stored here' }],
  html:    [{ file: 'sw.js', note: 'save to domain root' }],
  wp:      [{ file: 'sw.js', note: 'save to domain root' }],
}

function SnippetSection({ siteId }: { siteId: string }) {
  const { data, isLoading } = useSiteSnippet(siteId)
  const [tab, setTab] = useState<'cli' | 'manual'>('cli')
  const [fw, setFw] = useState<FW>('next')

  const token = data?.siteToken ?? ''

  const manualCode: Record<FW, string> = {
    next:    `// middleware.ts\nimport { withSpecter } from '@rcti/noir/next'\n\nexport default withSpecter({\n  token: process.env.SPECTER_TOKEN!,\n})\n\nexport const config = {\n  matcher: ['/((?!_next|api|favicon).*)'],\n}`,
    react:   `// src/main.tsx\nimport { SpecterProvider } from '@rcti/noir/react'\n\n<SpecterProvider\n  token={import.meta.env.VITE_SPECTER_TOKEN}\n>\n  <App />\n</SpecterProvider>`,
    express: `// app.ts — before your routes\nimport { specterMiddleware } from '@rcti/noir/node'\n\napp.use(specterMiddleware({\n  token: process.env.SPECTER_TOKEN,\n}))`,
    html:    data?.tag ?? '',
    wp:      `// functions.php\nfunction noir_tag() {\n  echo '${data?.tag ?? ''}';\n}\nadd_action('wp_head', 'noir_tag', 1);`,
  }

  return (
    <div className="hud-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-theme flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-cyan-400/60" />
          <h3 className="text-theme font-semibold text-sm">Install</h3>
        </div>
        <div className="flex gap-1 p-0.5 bg-theme-surface rounded-lg border border-theme">
          {(['cli', 'manual'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-[11px] font-mono transition-all ${
                tab === t ? 'bg-white/[0.08] text-theme border border-white/[0.08]' : 'text-theme-faint hover:text-theme-muted'
              }`}
            >
              {t === 'cli' ? '⚡ Auto' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={16} className="text-theme-faint animate-spin" />
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Framework tabs */}
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(FW_LABELS) as FW[]).map(f => (
              <button
                key={f}
                onClick={() => setFw(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                  fw === f
                    ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                    : 'text-theme-faint border border-theme hover:text-theme-muted'
                }`}
              >
                {FW_LABELS[f]}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${tab}-${fw}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {tab === 'cli' ? (
                <>
                  <CopyBlock code={token} label="1 · Your token" />
                  <CopyBlock code="npx @rcti/noir@latest init" label="2 · Run in your project root" />
                  <div className="rounded-xl border border-theme bg-theme-surface p-4 space-y-3">
                    <p className="hud-label text-[9px]">Files created ({FW_LABELS[fw]})</p>
                    <div className="space-y-2">
                      {CLI_FILES[fw].map(({ file, note }) => (
                        <div key={file} className="flex items-center gap-2">
                          <Check size={9} className="text-emerald-400 shrink-0" />
                          <span className="text-theme-secondary text-[11px] font-mono">{file}</span>
                          <span className="text-theme-faint text-[10px]">— {note}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-theme-faint text-[11px] leading-relaxed">
                      Paste your token when prompted. The CLI auto-detects your framework.
                    </p>
                  </div>
                  <p className="text-theme-faint text-[10px]">
                    No npm?{' '}
                    <button className="underline hover:text-theme-muted transition-colors" onClick={() => setTab('manual')}>
                      Switch to Manual
                    </button>
                  </p>
                </>
              ) : (
                <>
                  {(fw === 'html' || fw === 'wp') ? (
                    <>
                      <CopyBlock code={data?.swStub ?? ''} label="1 · Save as /sw.js (domain root)" />
                      <CopyBlock code={manualCode[fw]} label={fw === 'wp' ? '2 · Add to functions.php' : '2 · Paste in <head>'} />
                    </>
                  ) : (
                    <>
                      <CopyBlock code="npm install @rcti/noir" label="1 · Install package" />
                      <CopyBlock code={manualCode[fw]} label="2 · Add to your project" />
                    </>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (isLoading || !site) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="relative">
          <Loader2 size={24} className="text-red-400/40 animate-spin" />
          <div className="absolute inset-0 blur-xl animate-pulse" style={{ background: 'rgba(255,45,85,0.2)' }} />
        </div>
        <p className="hud-label tracking-[0.3em] animate-pulse">LOADING NODE DATA</p>
      </div>
    )
  }

  const isKilled = site.isKilled
  const activeMode = (selectedMode ?? site.killMode ?? 'freeze') as SiteMode
  const events = eventsData?.events ?? site.events ?? []
  const busy = kill.isPending || restore.isPending

  function handleConfirm() {
    setShowConfirm(false)
    if (isKilled) {
      restore.mutate()
    } else {
      kill.mutate({ mode: activeMode === 'none' ? 'freeze' : activeMode, config: modeConfig })
    }
  }

  const activeModeData = MODES.find(m => m.id === activeMode)

  return (
    <div className="space-y-0 relative">
      {/* Full-page ambient glow */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        animate={{ opacity: isKilled ? 1 : 0 }}
        transition={{ duration: 1 }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
          style={{ background: 'radial-gradient(ellipse at center top, rgba(255,45,85,0.07) 0%, transparent 65%)' }}
        />
      </motion.div>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <motion.button
            onClick={() => router.push('/dashboard/sites')}
            whileTap={{ scale: 0.93 }}
            className="w-9 h-9 rounded-lg border border-theme bg-theme-surface text-theme-muted hover:text-theme flex items-center justify-center shrink-0 transition-colors"
          >
            <ArrowLeft size={15} />
          </motion.button>
          <div className="min-w-0">
            <p className="hud-label text-[9px] mb-0.5">Site Node</p>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-theme font-bold text-lg font-mono truncate">{site.domain}</h1>
              <StatusBadge status={isKilled ? 'dead' : 'live'} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-theme bg-theme-surface text-theme-muted hover:text-theme text-xs transition-colors font-mono"
          >
            <ExternalLink size={12} />
            Open
          </a>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all font-mono"
            style={{
              background: 'rgba(255,45,85,0.05)',
              border: '1px solid rgba(255,45,85,0.15)',
              color: 'rgba(255,45,85,0.7)',
            }}
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      </div>

      {/* ── Status strip ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        className="hud-card px-5 py-3 my-6 flex items-center gap-4 flex-wrap"
        style={{ borderColor: isKilled ? 'rgba(255,45,85,0.15)' : 'rgba(52,211,153,0.1)' }}
      >
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="w-2 h-2 rounded-full"
            style={{
              background: isKilled ? '#FF2D55' : '#34d399',
              boxShadow: isKilled ? '0 0 10px rgba(255,45,85,0.8)' : '0 0 10px rgba(52,211,153,0.7)',
            }}
          />
          <span className="text-[11px] font-mono font-bold" style={{ color: isKilled ? '#FF2D55' : '#34d399' }}>
            {isKilled ? 'NEUTRALIZED' : 'OPERATIONAL'}
          </span>
        </div>
        <div className="h-4 w-px bg-theme-border" />
        <span className="text-[11px] font-mono text-theme-faint">
          Mode: <span className="text-theme-secondary">{activeMode.toUpperCase()}</span>
        </span>
        <div className="h-4 w-px bg-theme-border" />
        <span className="text-[11px] font-mono text-theme-faint flex items-center gap-1">
          <Activity size={10} />
          {eventsData?.total ?? events.length} events
        </span>
        {events[0] && (
          <>
            <div className="h-4 w-px bg-theme-border" />
            <span className="text-[11px] font-mono text-theme-faint flex items-center gap-1">
              <Clock size={10} />
              Last action {formatDistanceToNow(new Date(events[0].activatedAt), { addSuffix: true })}
            </span>
          </>
        )}
      </motion.div>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start pt-5">

        {/* LEFT ─────────────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Kill switch hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="hud-card p-8 sm:p-12 flex flex-col items-center text-center relative overflow-hidden"
            style={{
              borderColor: isKilled ? 'rgba(255,45,85,0.18)' : undefined,
            }}
          >
            {/* Background grid */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />
            {/* Top glow */}
            <div
              className="absolute top-0 left-0 right-0 h-32 pointer-events-none transition-opacity duration-700"
              style={{
                background: isKilled
                  ? 'radial-gradient(ellipse at 50% 0%, rgba(255,45,85,0.1) 0%, transparent 70%)'
                  : 'transparent',
              }}
            />

            <p className="hud-label text-[9px] mb-8 tracking-[0.35em]">KILL SWITCH</p>

            <KillButton isKilled={isKilled} busy={busy} onClick={() => setShowConfirm(true)} />

            <div className="mt-8 space-y-1.5">
              <motion.p
                key={String(isKilled)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-black font-mono"
                style={{ color: isKilled ? '#FF2D55' : '#34d399' }}
              >
                {isKilled ? 'Site Neutralized' : 'Site Operational'}
              </motion.p>
              <p className="text-theme-muted text-sm">
                {isKilled
                  ? `Running in ${activeMode} mode — press to restore`
                  : 'Press the switch to kill this site'}
              </p>
            </div>
          </motion.div>

          {/* Mode selector */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="hud-card p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-theme font-semibold">Kill Mode</h3>
                <p className="text-theme-faint text-[11px] mt-0.5">What visitors experience when the switch is active.</p>
              </div>
              {activeModeData && (
                <span
                  className="text-[10px] font-mono px-2.5 py-1 rounded-lg border uppercase tracking-wider"
                  style={{
                    color: activeModeData.color,
                    background: activeModeData.glow,
                    borderColor: `${activeModeData.color}30`,
                  }}
                >
                  {activeModeData.label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MODES.map(m => {
                const ModeIcon = m.icon
                const isActive = activeMode === m.id
                return (
                  <motion.button
                    key={m.id}
                    onClick={() => { setSelectedMode(m.id); setModeConfig({}) }}
                    whileTap={{ scale: 0.985 }}
                    className={`relative text-left flex items-start gap-3 p-4 rounded-xl border transition-all ${
                      m.id === 'timebomb' ? 'sm:col-span-2' : ''
                    }`}
                    style={{
                      background: isActive ? `${m.glow}` : 'transparent',
                      borderColor: isActive ? `${m.color}35` : 'rgba(255,255,255,0.06)',
                      boxShadow: isActive ? `0 0 20px ${m.glow}` : 'none',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all"
                      style={{
                        background: isActive ? `${m.glow}` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive ? `${m.color}30` : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <ModeIcon size={15} style={{ color: isActive ? m.color : 'rgba(255,255,255,0.3)' }} />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-sm font-semibold text-theme">{m.label}</p>
                      <p className="text-theme-faint text-[11px] mt-0.5 leading-relaxed">{m.description}</p>
                    </div>
                    {isActive && (
                      <div
                        className="absolute top-3.5 right-3.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: m.color }}
                      >
                        <Check size={9} className="text-black" />
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* Config panel */}
            <div className="pt-4 border-t border-theme">
              <p className="hud-label text-[9px] mb-4">Configuration</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeMode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ModeConfigPanel mode={activeMode} config={modeConfig} onChange={setModeConfig} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* RIGHT ─────────────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Install snippet */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <SnippetSection siteId={siteId} />
          </motion.div>

          {/* Site info */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 }}
            className="hud-card overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-theme flex items-center gap-2">
              <Globe size={13} className="text-theme-faint" />
              <h3 className="text-theme font-semibold text-sm">Node Info</h3>
            </div>
            <dl className="p-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3.5 text-xs">
              {[
                { label: 'Name',    value: site.name },
                { label: 'Domain',  value: site.domain, mono: true },
                { label: 'Token',   value: site.siteToken, mono: true, truncate: true },
                { label: 'Events',  value: String(eventsData?.total ?? site._count?.events ?? 0) },
                { label: 'Created', value: format(new Date(site.createdAt), 'MMM d, yyyy') },
              ].map(row => (
                <div key={row.label} className="contents">
                  <dt className="text-theme-faint font-mono uppercase tracking-widest text-[9px] flex items-center">{row.label}</dt>
                  <dd className={`text-theme-secondary text-right ${row.mono ? 'font-mono text-[10px] break-all' : ''} ${row.truncate ? 'truncate' : ''}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* Event timeline */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18 }}
            className="hud-card overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-theme flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-theme-faint" />
                <h3 className="text-theme font-semibold text-sm">Event History</h3>
              </div>
              <span className="hud-label text-[9px]">{eventsData?.total ?? events.length} total</span>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <Terminal size={18} className="text-theme-faint/50" />
                  <p className="text-theme-faint text-[11px] font-mono tracking-widest">NO EVENTS RECORDED</p>
                </div>
              ) : (
                <div className="px-5 py-4 space-y-0">
                  {events.map((event: any, i: number) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="relative flex gap-4 pb-5 last:pb-0"
                    >
                      {/* Timeline line */}
                      {i < events.length - 1 && (
                        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-gradient-to-b from-theme-border to-transparent" />
                      )}

                      {/* Dot */}
                      <div className="relative mt-1 shrink-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full border-2 border-theme-bg flex items-center justify-center"
                          style={{
                            background: event.deactivatedAt ? '#34d399' : '#FF2D55',
                            boxShadow: event.deactivatedAt
                              ? '0 0 8px rgba(52,211,153,0.6)'
                              : '0 0 8px rgba(255,45,85,0.6)',
                          }}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className="text-xs font-bold font-mono"
                            style={{ color: event.deactivatedAt ? '#34d399' : '#FF2D55' }}
                          >
                            {event.deactivatedAt ? 'RESTORED' : 'KILLED'}
                          </span>
                          {event.mode && event.mode !== 'none' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider text-theme-faint border border-theme">
                              {event.mode}
                            </span>
                          )}
                        </div>
                        <p className="text-theme-faint text-[10px] font-mono">
                          {formatDistanceToNow(new Date(event.activatedAt), { addSuffix: true })}
                        </p>
                        {event.deactivatedAt && (
                          <p className="text-theme-faint/60 text-[10px]">
                            Restored {formatDistanceToNow(new Date(event.deactivatedAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal
            isKilled={isKilled}
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
            busy={busy}
          />
        )}
        {showDeleteConfirm && (
          <DeleteConfirmModal
            name={site.name}
            busy={deleteSite.isPending}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={() => {
              deleteSite.mutate(siteId, {
                onSuccess: () => router.push('/dashboard/sites'),
              })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}