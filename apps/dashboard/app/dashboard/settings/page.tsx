'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Key, Shield, Loader2, Check, Copy, Trash2, Plus } from 'lucide-react'
import { useMe } from '@/lib/hooks'
import { api } from '@/lib/auth'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy}
      className="p-1.5 rounded text-white/30 hover:text-white/70 transition-colors">
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  )
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.get('/auth/api-keys').then(r => setKeys(r.data.keys ?? [])).catch(() => setKeys([])).finally(() => setLoading(false))
  }, [])

  async function createKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/auth/api-keys', { name: newKeyName.trim() })
      setNewKeyValue(res.data.key)
      setKeys(prev => [res.data.apiKey, ...prev])
      setNewKeyName('')
      setShowCreate(false)
      toast.success('API key created')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(id: string) {
    setDeletingId(id)
    try {
      await api.delete(`/auth/api-keys/${id}`)
      setKeys(prev => prev.filter(k => k.id !== id))
      toast.success('API key deleted')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to delete key')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">API Keys</h3>
          <p className="text-white/35 text-xs mt-0.5">Use these to authenticate with the Specter API.</p>
        </div>
        <motion.button onClick={() => setShowCreate(v => !v)} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-white/60 text-xs hover:bg-white/[0.08] transition-all">
          <Plus size={12} />
          New Key
        </motion.button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.02]">
          <div className="flex gap-3">
            <input type="text" className="sp-input flex-1 text-sm"
              placeholder="Key name (e.g. CI/CD, Local Dev)"
              value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKey()} autoFocus />
            <motion.button onClick={createKey} disabled={!newKeyName.trim() || creating} whileTap={{ scale: 0.97 }}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #FF2D55, #CC1A3A)' }}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
            </motion.button>
          </div>
        </motion.div>
      )}

      {newKeyValue && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="px-6 py-4 border-b border-white/[0.05] bg-emerald-500/[0.05] border-l-2 border-l-emerald-500/50">
          <p className="text-emerald-400 text-xs font-semibold mb-2">Copy your key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2 bg-black/30 rounded-lg p-2.5">
            <code className="text-white/80 text-xs font-mono flex-1 break-all">{newKeyValue}</code>
            <CopyBtn text={newKeyValue} />
          </div>
          <button onClick={() => setNewKeyValue(null)} className="text-white/30 text-xs mt-2 hover:text-white/50 transition-colors">
            Dismiss
          </button>
        </motion.div>
      )}

      <div className="divide-y divide-white/[0.04]">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="text-white/25 animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-white/25 text-sm text-center py-10">No API keys yet.</p>
        ) : (
          keys.map(key => (
            <div key={key.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
              <Key size={14} className="text-white/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{key.name}</p>
                <p className="text-white/30 text-xs font-mono">{key.prefix}••••••••••••••••</p>
              </div>
              <div className="text-right mr-3">
                <p className="text-white/25 text-xs">{format(new Date(key.createdAt), 'MMM d, yyyy')}</p>
                {key.lastUsedAt ? (
                  <p className="text-white/15 text-xs">Used {format(new Date(key.lastUsedAt), 'MMM d')}</p>
                ) : (
                  <p className="text-white/15 text-xs">Never used</p>
                )}
              </div>
              <motion.button onClick={() => deleteKey(key.id)} disabled={deletingId === key.id} whileTap={{ scale: 0.9 }}
                className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                {deletingId === key.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </motion.button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { data: me, isLoading, refetch } = useMe()
  const [name, setName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (me) setName(me.name)
  }, [me])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSavingProfile(true)
    try {
      await api.patch('/auth/me', { name: name.trim() })
      await refetch()
      toast.success('Profile updated')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword || !newPassword) return
    setSavingPassword(true)
    try {
      await api.patch('/auth/password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Password changed')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest mb-2">Account</p>
        <h1 className="text-4xl font-bold grad-text leading-none">Settings</h1>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.05] flex items-center gap-3">
          <User size={15} className="text-white/40" />
          <h3 className="text-white font-semibold">Profile</h3>
        </div>
        <form onSubmit={saveProfile} className="p-6 space-y-5">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Display Name</label>
            <input type="text" className="sp-input w-full"
              value={name} onChange={e => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Email</label>
            <input type="email" className="sp-input w-full opacity-50 cursor-not-allowed"
              value={me.email} disabled />
            <p className="text-white/20 text-xs mt-1.5">Email changes require contacting support.</p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${me.plan === 'FREE' ? 'bg-white/30' : 'bg-emerald-400'}`} />
              <span className="text-white/40 text-xs font-mono">{me.plan} plan</span>
            </div>
            <motion.button type="submit" disabled={savingProfile || !name.trim()} whileTap={{ scale: 0.97 }}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #FF2D55, #CC1A3A)' }}>
              {savingProfile ? <Loader2 size={14} className="animate-spin" /> : null}
              Save Changes
            </motion.button>
          </div>
        </form>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.05] flex items-center gap-3">
          <Shield size={15} className="text-white/40" />
          <h3 className="text-white font-semibold">Security</h3>
        </div>
        <form onSubmit={savePassword} className="p-6 space-y-4">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Current Password</label>
            <input type="password" className="sp-input w-full"
              value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" />
          </div>
          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">New Password</label>
            <input type="password" className="sp-input w-full"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 8 characters" autoComplete="new-password" />
          </div>
          <div className="flex justify-end pt-1">
            <motion.button type="submit"
              disabled={savingPassword || !currentPassword || newPassword.length < 8}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white/70 text-sm hover:bg-white/[0.09] transition-all disabled:opacity-40 flex items-center gap-2">
              {savingPassword ? <Loader2 size={14} className="animate-spin" /> : null}
              Change Password
            </motion.button>
          </div>
        </form>
      </motion.div>

      {/* API Keys */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <ApiKeysSection />
      </motion.div>

      {/* Account info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-white font-semibold text-sm">Account Details</h3>
        <div className="space-y-2.5">
          {[
            { label: 'User ID', value: me.id, mono: true },
            { label: 'Member Since', value: format(new Date(me.createdAt), 'MMMM d, yyyy') },
            { label: 'Plan', value: me.plan },
            { label: 'Sites Limit', value: String(me.sitesLimit) },
            { label: 'Subscription', value: me.subscriptionStatus },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-white/35 text-xs">{row.label}</span>
              <span className={`text-white/65 text-xs ${row.mono ? 'font-mono bg-white/5 px-1.5 py-0.5 rounded text-[10px]' : ''}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  )
}
