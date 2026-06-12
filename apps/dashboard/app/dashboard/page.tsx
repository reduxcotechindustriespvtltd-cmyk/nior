'use client'

import { motion, AnimatePresence, useMotionValue, useSpring, animate } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Globe,
  Plus,
  Power,
  ChevronRight,
  Clock,
  Activity,
  Zap,
  Loader2,
  Radio,
  Shield,
  Skull,
  RefreshCw,
  TrendingUp,
  AlertOctagon,
  Terminal,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSites, useMe, useKillSite, useRestoreSite } from '@/lib/hooks'
import { PageHeader } from '@/components/hud/PageHeader'
import { NeonButton } from '@/components/hud/NeonButton'
import { StatusBadge } from '@/components/hud/StatusBadge'

// ─── Animated counter ────────────────────────────────────────────────────────
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setDisplay(Math.round(v)),
    })
    return controls.stop
  }, [value])
  return <span className={className}>{display}</span>
}

// ─── Glitch text ─────────────────────────────────────────────────────────────
function GlitchText({ children, active = true }: { children: string; active?: boolean }) {
  const [glitching, setGlitching] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setGlitching(true)
      setTimeout(() => setGlitching(false), 120)
    }, 4000 + Math.random() * 3000)
    return () => clearInterval(id)
  }, [active])
  return (
    <span className={`relative inline-block ${glitching ? 'animate-glitch' : ''}`}>
      {children}
      {glitching && (
        <>
          <span className="absolute inset-0 text-red-400/70 translate-x-[2px] -translate-y-[1px] pointer-events-none select-none" aria-hidden>
            {children}
          </span>
          <span className="absolute inset-0 text-cyan-400/50 -translate-x-[2px] translate-y-[1px] pointer-events-none select-none" aria-hidden>
            {children}
          </span>
        </>
      )}
    </span>
  )
}

// ─── Threat ring ──────────────────────────────────────────────────────────────
function ThreatRing({ percent }: { percent: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setProgress(percent), 300)
    return () => clearTimeout(t)
  }, [percent])

  const offset = circumference - (progress / 100) * circumference
  const color =
    percent === 0
      ? '#34d399'
      : percent < 30
      ? '#facc15'
      : percent < 70
      ? '#f97316'
      : '#FF2D55'

  const label =
    percent === 0
      ? 'ALL CLEAR'
      : percent < 30
      ? 'LOW'
      : percent < 70
      ? 'ELEVATED'
      : 'CRITICAL'

  return (
    <div className="relative flex items-center justify-center w-36 h-36 shrink-0">
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-700"
        style={{ background: color }}
      />
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
        {/* Track */}
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        {/* Progress */}
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1), stroke 0.6s ease', filter: `drop-shadow(0 0 8px ${color})` }}
        />
        {/* Tick marks */}
        {Array.from({ length: 20 }).map((_, i) => {
          const angle = (i / 20) * 360
          const rad = (angle * Math.PI) / 180
          const x1 = 64 + 46 * Math.cos(rad)
          const y1 = 64 + 46 * Math.sin(rad)
          const x2 = 64 + 50 * Math.cos(rad)
          const y2 = 64 + 50 * Math.sin(rad)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        })}
      </svg>
      <div className="relative text-center">
        <p className="text-2xl font-black font-mono tabular-nums" style={{ color }}>
          <AnimatedNumber value={percent} />%
        </p>
        <p className="text-[9px] font-mono tracking-[0.2em] mt-0.5" style={{ color }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delay = 0,
}: {
  icon: React.ElementType
  label: string
  value: number
  sub: string
  accent: 'cyan' | 'red' | 'green'
  delay?: number
}) {
  const colors = {
    cyan: { text: '#22d3ee', glow: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.12)', bg: 'rgba(34,211,238,0.05)' },
    red:  { text: '#FF2D55', glow: 'rgba(255,45,85,0.15)',  border: 'rgba(255,45,85,0.12)',  bg: 'rgba(255,45,85,0.05)'  },
    green:{ text: '#34d399', glow: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.12)', bg: 'rgba(52,211,153,0.05)' },
  }[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="hud-card p-5 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-200"
      style={{ borderColor: colors.border }}
    >
      {/* Gradient sweep on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${colors.glow} 0%, transparent 70%)` }}
      />
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.text}55, transparent)` }} />

      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
        >
          <Icon size={17} style={{ color: colors.text }} />
        </div>
        <TrendingUp size={12} className="text-theme-faint mt-1" />
      </div>

      <p className="text-3xl font-black font-mono tabular-nums mb-1" style={{ color: colors.text }}>
        <AnimatedNumber value={value} />
      </p>
      <p className="text-[11px] font-semibold text-theme uppercase tracking-widest mb-1">{label}</p>
      <p className="text-[10px] text-theme-faint font-mono">{sub}</p>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { data: sites = [], isLoading: sitesLoading } = useSites()
  const { data: me } = useMe()

  const killed = sites.filter(s => s.isKilled).length
  const live = sites.length - killed
  const totalEvents = sites.reduce((a, s) => a + (s._count?.events ?? 0), 0)
  const threatLevel = sites.length === 0 ? 0 : Math.round((killed / sites.length) * 100)

  if (sitesLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="relative">
          <Loader2 size={28} className="text-red-400/40 animate-spin" />
          <div className="absolute inset-0 blur-md animate-pulse" style={{ background: 'rgba(255,45,85,0.3)' }} />
        </div>
        <p className="hud-label animate-pulse tracking-[0.3em]">INITIALIZING COMMAND MATRIX</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        label={me ? `OPERATOR // ${me.name.split(' ')[0].toUpperCase()}` : 'COMMAND CENTER'}
        title={<GlitchText>Control Matrix</GlitchText> as any}
        subtitle="Real-time oversight of your deployed kill-switch fleet. Activate, monitor, and restore sites from a single interface."
        action={
          <NeonButton onClick={() => router.push('/dashboard/sites/new')}>
            <Plus size={15} />
            Deploy Site
          </NeonButton>
        }
      />

      {/* ── Overview strip ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hud-card p-6 relative overflow-hidden"
      >
        {/* Animated scan line */}
        <div className="scan-line" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(255,45,85,0.04) 0%, transparent 70%)' }}
        />

        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <p className="hud-label tracking-[0.25em]">THREAT LEVEL</p>
            <ThreatRing percent={threatLevel} />
            <p className="text-[9px] text-theme-faint font-mono">
              {killed}/{sites.length} SITES NEUTRALIZED
            </p>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Globe}     label="Fleet Size"   value={sites.length}  sub={`${me?.sitesLimit ?? '—'} site limit · ${me?.plan ?? 'FREE'} plan`} accent="cyan"  delay={0.1} />
            <StatCard icon={Skull}     label="Neutralized"  value={killed}         sub={`${live} ${live === 1 ? 'site' : 'sites'} still operational`}       accent="red"   delay={0.15} />
            <StatCard icon={Activity}  label="Event Log"    value={totalEvents}    sub="Kill & restore events recorded"                                      accent="green" delay={0.2} />
          </div>
        </div>
      </motion.div>

      {/* ── Site grid ──────────────────────────────────────────────────────── */}
      <div>
        <div className="section-header mb-4">
          <Radio size={13} className="text-red-400/60" />
          <h2 className="hud-label">Deployed Nodes</h2>
          <div className="flex items-center gap-1.5 ml-auto">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
              style={{ boxShadow: '0 0 8px rgba(52,211,153,0.8)' }}
            />
            <span className="font-mono text-[10px] text-theme-faint">{sites.length} ONLINE</span>
          </div>
        </div>

        {sites.length === 0 ? (
          <EmptyFleet onDeploy={() => router.push('/dashboard/sites/new')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sites.map((site, i) => (
              <SiteCard
                key={site.id}
                site={site}
                index={i}
                onClick={() => router.push(`/dashboard/sites/${site.id}`)}
              />
            ))}
            {/* Add node tile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: sites.length * 0.06 + 0.1 }}
              onClick={() => router.push('/dashboard/sites/new')}
              className="hud-card border-dashed min-h-[180px] flex flex-col items-center justify-center gap-3 cursor-pointer group transition-all hover:border-cyan-400/20"
            >
              <div className="w-10 h-10 rounded-xl border border-dashed border-theme flex items-center justify-center group-hover:border-cyan-400/30 group-hover:bg-cyan-400/5 transition-all">
                <Plus size={16} className="text-theme-faint group-hover:text-cyan-400/60 transition-colors" />
              </div>
              <p className="text-[9px] text-theme-faint font-mono tracking-[0.3em] group-hover:text-cyan-400/50 transition-colors">
                INITIALIZE NODE
              </p>
            </motion.div>
          </div>
        )}
      </div>

      {/* ── Signal feed ────────────────────────────────────────────────────── */}
      <SignalFeed sites={sites} />
    </div>
  )
}

// ─── Empty fleet ─────────────────────────────────────────────────────────────
function EmptyFleet({ onDeploy }: { onDeploy: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="hud-card p-16 flex flex-col items-center justify-center gap-5 cursor-pointer group relative overflow-hidden"
      onClick={onDeploy}
    >
      <div className="scan-line" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.04) 0%, transparent 70%)' }}
      />
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-2xl border border-dashed border-theme flex items-center justify-center group-hover:border-cyan-400/30 group-hover:bg-cyan-500/5 transition-all"
      >
        <Terminal size={28} className="text-theme-faint group-hover:text-cyan-400/60 transition-colors" />
      </motion.div>
      <div className="text-center space-y-1">
        <p className="text-theme-muted text-sm font-mono">No nodes deployed</p>
        <p className="text-[11px] text-theme-faint font-mono">Initialize your first kill-switch site to begin</p>
      </div>
      <NeonButton variant="ghost" onClick={onDeploy}>
        Begin Deployment
      </NeonButton>
    </motion.div>
  )
}

// ─── Site card ────────────────────────────────────────────────────────────────
function SiteCard({
  site,
  index,
  onClick,
}: {
  site: {
    id: string
    name: string
    domain: string
    isKilled: boolean
    killMode: string
    updatedAt: string
  }
  index: number
  onClick: () => void
}) {
  const kill = useKillSite(site.id)
  const restore = useRestoreSite(site.id)
  const busy = kill.isPending || restore.isPending

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="hud-card p-5 cursor-pointer group relative overflow-hidden"
      onClick={onClick}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      {/* Corner brackets */}
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-br" />

      {/* Status bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-500"
        style={{
          background: site.isKilled
            ? 'linear-gradient(90deg, transparent, #FF2D55 30%, #FF2D55 70%, transparent)'
            : 'linear-gradient(90deg, transparent, #34d399 30%, #34d399 70%, transparent)',
          opacity: 0.7,
        }}
      />

      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: site.isKilled
            ? 'radial-gradient(ellipse at top, rgba(255,45,85,0.06) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at top, rgba(52,211,153,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: site.isKilled ? 'rgba(255,45,85,0.08)' : 'rgba(52,211,153,0.06)',
              border: site.isKilled ? '1px solid rgba(255,45,85,0.2)' : '1px solid rgba(52,211,153,0.15)',
            }}
          >
            {site.isKilled ? (
              <WifiOff size={16} className="text-red-400/70" />
            ) : (
              <Wifi size={16} className="text-emerald-400/70" />
            )}
            {/* Pulse ring for live sites */}
            {!site.isKilled && (
              <span className="absolute inset-0 rounded-xl animate-ping opacity-20"
                style={{ border: '1px solid #34d399' }} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-theme truncate leading-tight">{site.name}</p>
            <p className="text-[11px] text-theme-muted truncate font-mono mt-0.5">{site.domain}</p>
          </div>
        </div>
        <StatusBadge status={site.isKilled ? 'dead' : 'live'} />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mb-4">
        {site.killMode && site.killMode !== 'none' && (
          <span className="text-[9px] font-mono px-2 py-1 rounded-md uppercase tracking-wider"
            style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.15)', color: 'rgba(255,45,85,0.7)' }}>
            {site.killMode}
          </span>
        )}
        <span className="text-[10px] text-theme-faint font-mono flex items-center gap-1 ml-auto">
          <Clock size={9} />
          {formatDistanceToNow(new Date(site.updatedAt), { addSuffix: true })}
        </span>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between pt-3 border-t border-theme">
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <motion.button
            onClick={() => {
              if (site.isKilled) restore.mutate()
              else kill.mutate({ mode: site.killMode !== 'none' ? site.killMode : 'freeze' })
            }}
            disabled={busy}
            whileTap={{ scale: 0.92 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider border transition-all disabled:opacity-40 ${
              site.isKilled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                : 'bg-red-500/10 text-red-400 border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40'
            }`}
            style={{
              boxShadow: site.isKilled
                ? '0 0 12px rgba(52,211,153,0.1)'
                : '0 0 12px rgba(255,45,85,0.1)',
            }}
          >
            {busy ? (
              <Loader2 size={10} className="animate-spin" />
            ) : site.isKilled ? (
              <RefreshCw size={10} />
            ) : (
              <Power size={10} />
            )}
            {site.isKilled ? 'Restore' : 'Kill'}
          </motion.button>
        </div>

        <button
          onClick={onClick}
          className="flex items-center gap-1 text-[10px] font-mono text-theme-faint hover:text-theme-muted transition-colors"
        >
          Details
          <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Signal feed ─────────────────────────────────────────────────────────────
function SignalFeed({
  sites,
}: {
  sites: { id: string; domain: string; isKilled: boolean; killMode: string; updatedAt: string }[]
}) {
  const recentSites = [...sites]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)

  return (
    <div>
      <div className="section-header mb-4">
        <Activity size={13} className="text-cyan-400/60" />
        <h2 className="hud-label">Signal Feed</h2>
        <div className="flex items-center gap-1.5 ml-auto">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
            style={{ boxShadow: '0 0 8px rgba(34,211,238,0.8)' }}
          />
          <span className="font-mono text-[10px] text-theme-faint">LIVE</span>
        </div>
      </div>

      <div className="hud-card overflow-hidden relative">
        <div className="scan-line" />

        {/* Header bar */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-theme bg-theme-surface/50">
          <span className="text-[9px] font-mono text-theme-faint tracking-widest uppercase w-20">Status</span>
          <span className="text-[9px] font-mono text-theme-faint tracking-widest uppercase flex-1">Domain</span>
          <span className="text-[9px] font-mono text-theme-faint tracking-widest uppercase w-16 text-right">Mode</span>
          <span className="text-[9px] font-mono text-theme-faint tracking-widest uppercase w-28 text-right">Last updated</span>
        </div>

        {recentSites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Terminal size={20} className="text-theme-faint/50" />
            <p className="text-theme-faint text-[11px] font-mono tracking-widest">AWAITING TELEMETRY</p>
          </div>
        ) : (
          <div className="divide-y divide-theme">
            <AnimatePresence>
              {recentSites.map((site, i) => (
                <motion.div
                  key={site.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35 }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-theme-surface/60 transition-colors group"
                >
                  {/* Status dot */}
                  <div className="flex items-center gap-2 w-20 shrink-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: site.isKilled ? '#FF2D55' : '#34d399',
                        boxShadow: site.isKilled
                          ? '0 0 10px rgba(255,45,85,0.8)'
                          : '0 0 10px rgba(52,211,153,0.7)',
                      }}
                    />
                    <span
                      className="text-[10px] font-mono font-bold uppercase tracking-wider"
                      style={{ color: site.isKilled ? '#FF2D55' : '#34d399' }}
                    >
                      {site.isKilled ? 'DEAD' : 'LIVE'}
                    </span>
                  </div>

                  {/* Domain */}
                  <span className="flex-1 text-[13px] font-mono text-theme-secondary truncate min-w-0">
                    {site.domain}
                  </span>

                  {/* Kill mode */}
                  <div className="w-16 text-right shrink-0">
                    {site.isKilled && site.killMode && site.killMode !== 'none' ? (
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{
                          background: 'rgba(255,45,85,0.08)',
                          border: '1px solid rgba(255,45,85,0.15)',
                          color: 'rgba(255,45,85,0.65)',
                        }}
                      >
                        {site.killMode}
                      </span>
                    ) : (
                      <span className="text-[9px] text-theme-faint font-mono">—</span>
                    )}
                  </div>

                  {/* Time */}
                  <p className="text-theme-faint text-[10px] font-mono w-28 text-right shrink-0">
                    {formatDistanceToNow(new Date(site.updatedAt), { addSuffix: true })}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        {recentSites.length > 0 && (
          <div className="px-5 py-2.5 border-t border-theme bg-theme-surface/30 flex items-center gap-2">
            <span className="text-[9px] text-theme-faint font-mono tracking-widest">
              SHOWING {recentSites.length} OF {sites.length} NODES
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-theme-border to-transparent" />
          </div>
        )}
      </div>
    </div>
  )
}