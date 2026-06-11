'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Globe, Plus, Power, ChevronRight, Clock, Activity, Shield, TrendingUp, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSites, useMe, useKillSite, useRestoreSite } from '@/lib/hooks'

const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } } }

export default function DashboardPage() {
  const router = useRouter()
  const { data: sites = [], isLoading: sitesLoading } = useSites()
  const { data: me } = useMe()

  const killed = sites.filter(s => s.isKilled).length
  const totalEvents = sites.reduce((a, s) => a + (s._count?.events ?? 0), 0)

  if (sitesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest mb-2">
            {me ? `Welcome back, ${me.name.split(' ')[0]}` : 'Control Center'}
          </p>
          <h1 className="text-4xl font-bold grad-text leading-none">Overview</h1>
        </div>
        <motion.button
          onClick={() => router.push('/dashboard/sites/new')}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/10 bg-white/[0.05] hover:bg-white/[0.09] hover:border-white/20 transition-all"
          style={{ boxShadow: '0 0 20px rgba(255,255,255,0.04)' }}>
          <Plus size={14} />
          New Site
        </motion.button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-3 gap-4">
        {[
          { icon: Globe, label: 'Total Sites', value: sites.length, sub: `${me?.sitesLimit ?? '—'} site limit`, color: 'text-white/60' },
          { icon: Shield, label: 'Currently Killed', value: killed, sub: `${sites.length - killed} sites live`, color: 'text-red-400' },
          { icon: TrendingUp, label: 'Total Events', value: totalEvents, sub: 'kills + restores', color: 'text-white/60' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <motion.div key={label} variants={fadeUp}
            className="glass glass-hover rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03), transparent 70%)' }} />
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-mono text-white/30 uppercase tracking-widest">{label}</p>
              <Icon size={14} className={color} />
            </div>
            <p className="text-5xl font-bold text-white leading-none mb-1.5 font-mono">{value}</p>
            <p className="text-xs text-white/25">{sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Sites Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-white/30" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider font-mono">Sites</h2>
          </div>
          <span className="text-[11px] text-white/20 font-mono">{sites.length} total</span>
        </div>

        {sites.length === 0 ? (
          <motion.div variants={fadeUp} initial="hidden" animate="visible"
            className="rounded-2xl border border-dashed border-white/[0.07] p-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-white/[0.14] hover:bg-white/[0.02] transition-all"
            onClick={() => router.push('/dashboard/sites/new')}>
            <div className="w-10 h-10 rounded-full border border-white/[0.08] flex items-center justify-center">
              <Plus size={16} className="text-white/25" />
            </div>
            <p className="text-[13px] text-white/30 font-mono">No sites yet — add your first site</p>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sites.map(site => (
              <SiteCard key={site.id} site={site} onClick={() => router.push(`/dashboard/sites/${site.id}`)} />
            ))}
            <motion.div variants={fadeUp}
              onClick={() => router.push('/dashboard/sites/new')}
              className="rounded-2xl border border-dashed border-white/[0.07] p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-white/[0.14] hover:bg-white/[0.02] transition-all min-h-[130px]">
              <div className="w-8 h-8 rounded-full border border-white/[0.08] flex items-center justify-center">
                <Plus size={14} className="text-white/25" />
              </div>
              <p className="text-[11px] text-white/20 font-mono">ADD SITE</p>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Recent Activity */}
      <RecentActivity sites={sites} />

    </div>
  )
}

function SiteCard({ site, onClick }: { site: any; onClick: () => void }) {
  const kill = useKillSite(site.id)
  const restore = useRestoreSite(site.id)
  const busy = kill.isPending || restore.isPending

  return (
    <motion.div
      variants={fadeUp}
      className="glass glass-hover rounded-2xl p-4 cursor-pointer group relative overflow-hidden"
      onClick={onClick}
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>

      {site.isKilled && (
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,45,85,0.5), transparent)' }} />
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center shrink-0">
            <Globe size={13} className="text-white/40" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{site.name}</p>
            <p className="text-[11px] text-white/30 truncate font-mono">{site.domain}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono shrink-0 border ${
          site.isKilled
            ? 'bg-red-500/[0.08] text-red-400 border-red-500/20'
            : 'bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20'
        }`}>
          <span className={`dot ${site.isKilled ? 'dot-dead' : 'dot-live'}`} />
          {site.isKilled ? 'DEAD' : 'LIVE'}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {site.killMode && site.killMode !== 'none' && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-white/40 uppercase">
              {site.killMode}
            </span>
          )}
          <span className="text-[10px] text-white/20 font-mono flex items-center gap-1">
            <Clock size={9} />
            {formatDistanceToNow(new Date(site.updatedAt), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.button
            onClick={e => {
              e.stopPropagation()
              if (site.isKilled) {
                restore.mutate()
              } else {
                kill.mutate({ mode: site.killMode !== 'none' ? site.killMode : 'freeze' })
              }
            }}
            disabled={busy}
            whileTap={{ scale: 0.9 }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-50 ${
              site.isKilled
                ? 'bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
                : 'bg-red-500/[0.08] text-red-400 border-red-500/20 hover:bg-red-500/15'
            }`}>
            {busy ? <Loader2 size={10} className="animate-spin" /> : <Power size={10} />}
            {site.isKilled ? 'Restore' : 'Kill'}
          </motion.button>
          <ChevronRight size={13} className="text-white/15 group-hover:text-white/40 transition-colors" />
        </div>
      </div>
    </motion.div>
  )
}

function RecentActivity({ sites }: { sites: any[] }) {
  // Flatten events from sites (top 5 from the list endpoint's _count, link to site detail)
  const recentSites = [...sites]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={13} className="text-white/30" />
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider font-mono">Recent Activity</h2>
      </div>

      <div className="glass rounded-2xl overflow-hidden relative">
        <div className="scan-line" />
        {recentSites.length === 0 ? (
          <p className="text-white/20 text-sm text-center py-10 font-mono">No activity yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recentSites.map((site, i) => (
              <motion.div key={site.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${site.isKilled ? 'bg-red-500' : 'bg-emerald-400'}`}
                  style={{ boxShadow: site.isKilled ? '0 0 6px rgba(255,45,85,0.8)' : '0 0 6px rgba(52,211,153,0.8)' }} />
                <div className="flex-1 min-w-0">
                  <span className="text-white/70 text-[13px] font-mono">{site.domain}</span>
                  <span className="text-white/30 text-[13px]"> — </span>
                  <span className={`text-[13px] font-semibold ${site.isKilled ? 'text-red-400' : 'text-emerald-400'}`}>
                    {site.isKilled ? 'killed' : 'live'}
                  </span>
                  {site.isKilled && site.killMode && site.killMode !== 'none' && (
                    <span className="text-white/25 text-[10px] ml-2 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] font-mono uppercase">
                      {site.killMode}
                    </span>
                  )}
                </div>
                <p className="text-white/20 text-[11px] font-mono shrink-0">
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
