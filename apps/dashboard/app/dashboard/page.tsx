'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Globe,
  Plus,
  Power,
  ChevronRight,
  Clock,
  Activity,
  Shield,
  Zap,
  Loader2,
  AlertTriangle,
  Radio,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSites, useMe, useKillSite, useRestoreSite } from '@/lib/hooks'
import { PageHeader } from '@/components/hud/PageHeader'
import { StatCard } from '@/components/hud/StatCard'
import { NeonButton } from '@/components/hud/NeonButton'
import { StatusBadge } from '@/components/hud/StatusBadge'

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
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-red-400/50 animate-spin" />
        <span className="hud-label">Initializing command matrix…</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      <PageHeader
        label={me ? `Operator // ${me.name.split(' ')[0]}` : 'Command Center'}
        title="Control Matrix"
        subtitle="Real-time oversight of your deployed kill-switch fleet. Activate, monitor, and restore sites from a single interface."
        action={
          <NeonButton onClick={() => router.push('/dashboard/sites/new')}>
            <Plus size={15} />
            Deploy Site
          </NeonButton>
        }
      />

      {/* Threat / system panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="hud-card p-5 sm:p-6 relative overflow-hidden"
      >
        <div className="hud-corner hud-corner-tl" />
        <div className="hud-corner hud-corner-tr" />
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-red-500/5 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: killed > 0 ? 'rgba(255,45,85,0.12)' : 'rgba(52,211,153,0.08)',
                border: `1px solid ${killed > 0 ? 'rgba(255,45,85,0.3)' : 'rgba(52,211,153,0.2)'}`,
                boxShadow: killed > 0 ? '0 0 32px rgba(255,45,85,0.15)' : '0 0 24px rgba(52,211,153,0.1)',
              }}
            >
              {killed > 0 ? (
                <AlertTriangle size={24} className="text-red-400" />
              ) : (
                <Shield size={24} className="text-emerald-400" />
              )}
            </div>
            <div>
              <p className="hud-label mb-1">Fleet status</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {killed > 0 ? `${killed} site${killed > 1 ? 's' : ''} neutralized` : 'All systems operational'}
              </p>
              <p className="text-white/35 text-sm mt-1">
                {live} live · {killed} killed · {me?.sitesLimit ?? '—'} site capacity
              </p>
            </div>
          </div>

          <div className="lg:w-72 w-full">
            <div className="flex justify-between items-center mb-2">
              <span className="hud-label text-[9px]">Threat index</span>
              <span className="font-mono text-xs text-white/50">{threatLevel}%</span>
            </div>
            <div className="threat-meter">
              <div
                className="threat-meter-fill"
                style={{
                  width: `${threatLevel}%`,
                  background: threatLevel > 50
                    ? 'linear-gradient(90deg, #FF2D55, #ff6b85)'
                    : threatLevel > 0
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #34d399, #22d3ee)',
                  boxShadow: `0 0 12px ${threatLevel > 0 ? 'rgba(255,45,85,0.5)' : 'rgba(52,211,153,0.4)'}`,
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Globe}
          label="Fleet size"
          value={sites.length}
          sub={`${me?.sitesLimit ?? '—'} site limit on ${me?.plan ?? 'FREE'}`}
          accent="cyan"
          delay={0.15}
        />
        <StatCard
          icon={Zap}
          label="Neutralized"
          value={killed}
          sub={`${live} sites still live`}
          accent="red"
          delay={0.2}
        />
        <StatCard
          icon={Activity}
          label="Event log"
          value={totalEvents}
          sub="Total kill & restore events"
          accent="green"
          delay={0.25}
        />
      </div>

      {/* Sites */}
      <div>
        <div className="section-header">
          <Radio size={14} className="text-red-400/60" />
          <h2 className="hud-label">Deployed sites</h2>
          <span className="font-mono text-[10px] text-white/20">{sites.length} nodes</span>
        </div>

        {sites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hud-card p-16 flex flex-col items-center justify-center gap-4 cursor-pointer group"
            onClick={() => router.push('/dashboard/sites/new')}
          >
            <div className="w-16 h-16 rounded-2xl border border-dashed border-white/10 flex items-center justify-center group-hover:border-red-500/30 group-hover:bg-red-500/5 transition-all">
              <Plus size={24} className="text-white/20 group-hover:text-red-400/60 transition-colors" />
            </div>
            <p className="text-white/40 text-sm font-mono">No sites deployed — initialize your first node</p>
            <NeonButton variant="ghost" onClick={() => router.push('/dashboard/sites/new')}>
              Begin deployment
            </NeonButton>
          </motion.div>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: sites.length * 0.05 }}
              onClick={() => router.push('/dashboard/sites/new')}
              className="hud-card border-dashed min-h-[160px] flex flex-col items-center justify-center gap-3 cursor-pointer opacity-60 hover:opacity-100 transition-opacity group"
            >
              <div className="w-10 h-10 rounded-xl border border-dashed border-white/10 flex items-center justify-center group-hover:border-cyan-400/30 transition-colors">
                <Plus size={16} className="text-white/25 group-hover:text-cyan-400/60" />
              </div>
              <p className="text-[10px] text-white/25 font-mono tracking-widest">ADD NODE</p>
            </motion.div>
          </div>
        )}
      </div>

      <RecentActivity sites={sites} />
    </div>
  )
}

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="hud-card p-5 cursor-pointer group relative overflow-hidden"
      onClick={onClick}
      whileHover={{ y: -2 }}
    >
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-br" />

      {site.isKilled && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #FF2D55, transparent)' }}
        />
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: site.isKilled ? 'rgba(255,45,85,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${site.isKilled ? 'rgba(255,45,85,0.2)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <Globe size={16} className={site.isKilled ? 'text-red-400/70' : 'text-white/40'} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{site.name}</p>
            <p className="text-[11px] text-white/30 truncate font-mono">{site.domain}</p>
          </div>
        </div>
        <StatusBadge status={site.isKilled ? 'dead' : 'live'} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {site.killMode && site.killMode !== 'none' && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white/40 uppercase tracking-wider">
              {site.killMode}
            </span>
          )}
          <span className="text-[10px] text-white/20 font-mono flex items-center gap-1">
            <Clock size={9} />
            {formatDistanceToNow(new Date(site.updatedAt), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <motion.button
            onClick={() => {
              if (site.isKilled) restore.mutate()
              else kill.mutate({ mode: site.killMode !== 'none' ? site.killMode : 'freeze' })
            }}
            disabled={busy}
            whileTap={{ scale: 0.9 }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider border transition-all disabled:opacity-50 ${
              site.isKilled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15'
                : 'bg-red-500/10 text-red-400 border-red-500/25 hover:bg-red-500/15'
            }`}
          >
            {busy ? <Loader2 size={10} className="animate-spin" /> : <Power size={10} />}
            {site.isKilled ? 'Restore' : 'Kill'}
          </motion.button>
          <ChevronRight size={14} className="text-white/10 group-hover:text-white/40 transition-colors" />
        </div>
      </div>
    </motion.div>
  )
}

function RecentActivity({ sites }: { sites: { id: string; domain: string; isKilled: boolean; killMode: string; updatedAt: string }[] }) {
  const recentSites = [...sites]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  return (
    <div>
      <div className="section-header">
        <Activity size={14} className="text-cyan-400/60" />
        <h2 className="hud-label">Signal feed</h2>
      </div>

      <div className="hud-card overflow-hidden relative">
        <div className="scan-line" />
        {recentSites.length === 0 ? (
          <p className="text-white/20 text-sm text-center py-12 font-mono">Awaiting telemetry…</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recentSites.map((site, i) => (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors data-stream"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${site.isKilled ? 'bg-red-500' : 'bg-emerald-400'}`}
                  style={{
                    boxShadow: site.isKilled
                      ? '0 0 10px rgba(255,45,85,0.9)'
                      : '0 0 10px rgba(52,211,153,0.8)',
                  }}
                />
                <div className="flex-1 min-w-0 font-mono text-[13px]">
                  <span className="text-white/60">{site.domain}</span>
                  <span className="text-white/20 mx-2">→</span>
                  <span className={site.isKilled ? 'text-red-400' : 'text-emerald-400'}>
                    {site.isKilled ? 'NEUTRALIZED' : 'OPERATIONAL'}
                  </span>
                  {site.isKilled && site.killMode && site.killMode !== 'none' && (
                    <span className="text-white/20 text-[9px] ml-2 px-1.5 py-0.5 rounded border border-white/[0.06] uppercase">
                      {site.killMode}
                    </span>
                  )}
                </div>
                <p className="text-white/20 text-[10px] font-mono shrink-0">
                  {formatDistanceToNow(new Date(site.updatedAt), { addSuffix: true })}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
