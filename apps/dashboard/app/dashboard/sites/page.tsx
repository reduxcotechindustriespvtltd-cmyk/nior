'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Globe, Plus, Power, Trash2, Search, Loader2, ChevronRight, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSites, useKillSite, useRestoreSite, useDeleteSite } from '@/lib/hooks'
import { PageHeader } from '@/components/hud/PageHeader'
import { NeonButton } from '@/components/hud/NeonButton'
import { StatusBadge } from '@/components/hud/StatusBadge'

function DeleteConfirm({ name, onConfirm, onCancel, loading }: {
  name: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative glass rounded-2xl p-8 max-w-sm w-full z-10 border border-red-500/20">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto bg-red-500/10 border border-red-500/20">
          <Trash2 size={22} className="text-red-400" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-2">Delete Site?</h2>
        <p className="text-white/50 text-sm text-center mb-8">
          <span className="text-white font-semibold">{name}</span> and all its event history will be permanently deleted.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <motion.button onClick={onConfirm} disabled={loading} whileTap={{ scale: 0.97 }}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-red-500/20">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Delete
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function SitesPage() {
  const router = useRouter()
  const { data: sites = [], isLoading } = useSites()
  const deleteSite = useDeleteSite()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const filtered = sites.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.domain.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">

      <PageHeader
        label="Fleet Control"
        title="Site Nodes"
        subtitle="Manage, search, and execute kill-switch operations across your entire deployment fleet."
        action={
          <NeonButton onClick={() => router.push('/dashboard/sites/new')}>
            <Plus size={15} />
            Deploy Site
          </NeonButton>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
        <input
          type="text"
          placeholder="Search sites..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sp-input w-full pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-6 hud-card px-5 py-4">
        {[
          { label: 'Total nodes', value: sites.length, color: 'text-cyan-400' },
          { label: 'Neutralized', value: sites.filter(s => s.isKilled).length, color: 'text-red-400' },
          { label: 'Operational', value: sites.filter(s => !s.isKilled).length, color: 'text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-3">
            <span className={`text-3xl font-bold font-mono tracking-tighter ${stat.color}`}>{stat.value}</span>
            <span className="hud-label text-[9px]">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Sites table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="text-white/30 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-16 flex flex-col items-center gap-4 text-center">
          {search ? (
            <>
              <Search size={28} className="text-white/15" />
              <p className="text-white/40 text-sm">No sites match <span className="font-mono text-white/60">"{search}"</span></p>
            </>
          ) : (
            <>
              <Globe size={28} className="text-white/15" />
              <p className="text-white/40 text-sm">No sites yet.</p>
              <motion.button onClick={() => router.push('/dashboard/sites/new')} whileTap={{ scale: 0.97 }}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all">
                <Plus size={14} />
                Add your first site
              </motion.button>
            </>
          )}
        </motion.div>
      ) : (
        <div className="hud-card overflow-hidden">
          {/* Table head */}
          <div className="hidden sm:grid grid-cols-[1fr_160px_120px_100px_100px] gap-4 px-5 py-3 border-b border-white/[0.05] text-[11px] font-mono text-white/25 uppercase tracking-widest">
            <span>Site</span>
            <span>Domain</span>
            <span>Mode</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filtered.map((site, i) => (
              <SiteRow
                key={site.id}
                site={site}
                index={i}
                onView={() => router.push(`/dashboard/sites/${site.id}`)}
                onDelete={() => setDeleteTarget({ id: site.id, name: site.name })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delete modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirm
            name={deleteTarget.name}
            loading={deleteSite.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
              deleteSite.mutate(deleteTarget.id, {
                onSuccess: () => setDeleteTarget(null),
              })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function SiteRow({ site, index, onView, onDelete }: {
  site: any
  index: number
  onView: () => void
  onDelete: () => void
}) {
  const kill = useKillSite(site.id)
  const restore = useRestoreSite(site.id)
  const busy = kill.isPending || restore.isPending

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px_100px_100px] gap-4 items-center px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer group"
      onClick={onView}>

      {/* Site name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center shrink-0">
          <Globe size={13} className="text-white/40" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{site.name}</p>
          <p className="text-[11px] text-white/30 font-mono sm:hidden truncate">{site.domain}</p>
          <p className="text-[10px] text-white/20 font-mono flex items-center gap-1 mt-0.5">
            <Clock size={9} />
            {formatDistanceToNow(new Date(site.updatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Domain */}
      <p className="hidden sm:block text-[13px] text-white/40 font-mono truncate">{site.domain}</p>

      {/* Mode */}
      <div className="hidden sm:flex items-center">
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-white/40 uppercase">
          {site.killMode === 'none' ? '—' : site.killMode}
        </span>
      </div>

      <div className="hidden sm:flex items-center">
        <StatusBadge status={site.isKilled ? 'dead' : 'live'} />
      </div>

      {/* Actions */}
      <div className="hidden sm:flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
        <motion.button
          onClick={() => site.isKilled ? restore.mutate() : kill.mutate({ mode: site.killMode !== 'none' ? site.killMode : 'freeze' })}
          disabled={busy}
          whileTap={{ scale: 0.9 }}
          title={site.isKilled ? 'Restore' : 'Kill'}
          className={`p-1.5 rounded-lg border transition-all disabled:opacity-50 ${
            site.isKilled
              ? 'bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
              : 'bg-red-500/[0.08] text-red-400 border-red-500/20 hover:bg-red-500/15'
          }`}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
        </motion.button>

        <motion.button onClick={onDelete} whileTap={{ scale: 0.9 }}
          title="Delete site"
          className="p-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/30 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.08] transition-all">
          <Trash2 size={12} />
        </motion.button>

        <ChevronRight size={13} className="text-white/15 group-hover:text-white/40 transition-colors" />
      </div>
    </motion.div>
  )
}
