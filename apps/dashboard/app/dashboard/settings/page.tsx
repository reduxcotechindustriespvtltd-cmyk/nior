'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Key, Shield, Loader2, Check, Copy, Trash2, Plus,
  Eye, EyeOff, AlertTriangle, ChevronRight, Zap, Calendar,
  Activity, Lock,
} from 'lucide-react'
import { useMe } from '@/lib/hooks'
import { api } from '@/lib/auth'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'

interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="relative">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black font-mono select-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,45,85,0.2) 0%, rgba(255,45,85,0.06) 100%)',
          border: '1px solid rgba(255,45,85,0.25)',
          boxShadow: '0 0 30px rgba(255,45,85,0.12)',
          color: '#FF2D55',
        }}
      >
        {initials}
      </div>
      <div
        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 bg-emerald-400"
        style={{ borderColor: 'var(--bg)', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }}
      />
    </div>
  )
}

// ─── Plan badge ───────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const isPro = plan !== 'FREE'
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider"
      style={{
        background: isPro ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.05)',
        border: isPro ? '1px solid rgba(250,204,21,0.25)' : '1px solid rgba(255,255,255,0.08)',
        color: isPro ? '#facc15' : 'rgba(255,255,255,0.35)',
        boxShadow: isPro ? '0 0 12px rgba(250,204,21,0.1)' : 'none',
      }}
    >
      {isPro && <Zap size={9} />}
      {plan}
    </span>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text, size = 13 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <motion.button
      onClick={copy}
      whileTap={{ scale: 0.9 }}
      className="p-1.5 rounded-lg text-theme-faint hover:text-theme-muted transition-colors"
    >
      <AnimatePresence mode="wait">
        {copied
          ? <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={size} className="text-emerald-400" /></motion.span>
          : <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy size={size} /></motion.span>
        }
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  subtitle,
  accent,
  action,
  children,
  delay = 0,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  accent?: string
  action?: React.ReactNode
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="hud-card overflow-hidden"
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: accent ?? 'linear-gradient(90deg, transparent, rgba(255,45,85,0.3) 50%, transparent)' }}
      />
      <div className="px-6 py-4 border-b border-theme flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.15)' }}
          >
            <Icon size={14} style={{ color: 'rgba(255,45,85,0.7)' }} />
          </div>
          <div>
            <h3 className="text-theme font-semibold text-sm">{title}</h3>
            {subtitle && <p className="text-theme-faint text-[11px] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="hud-label text-[9px] block mb-2">{label}</label>
      {children}
      {hint && <p className="text-theme-faint text-[11px] mt-1.5">{hint}</p>}
    </div>
  )
}

// ─── Password input ───────────────────────────────────────────────────────────
function PasswordInput({
  value, onChange, placeholder, autoComplete,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="sp-input w-full pr-10"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-faint hover:text-theme-muted transition-colors"
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  )
}

// ─── Password strength ────────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const len = password.length
  const hasUpper = /[A-Z]/.test(password)
  const hasNum = /\d/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)
  const score = [len >= 8, len >= 12, hasUpper, hasNum, hasSpecial].filter(Boolean).length

  const label = score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : score <= 4 ? 'Good' : 'Strong'
  const color = score <= 1 ? '#FF2D55' : score <= 3 ? '#facc15' : score <= 4 ? '#60a5fa' : '#34d399'
  const bars = 5

  if (!password) return null

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              background: i < score ? color : 'rgba(255,255,255,0.06)',
              boxShadow: i < score ? `0 0 6px ${color}60` : 'none',
            }}
          />
        ))}
      </div>
      <p className="text-[10px] font-mono" style={{ color }}>{label}</p>
    </div>
  )
}

// ─── API Keys section ─────────────────────────────────────────────────────────
function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.get('/auth/api-keys')
      .then(r => setKeys(r.data.keys ?? []))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false))
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
      toast.success('Key revoked')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to revoke key')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      icon={Key}
      title="API Keys"
      subtitle="Authenticate with the Specter REST API"
      delay={0.2}
      action={
        <motion.button
          onClick={() => setShowCreate(v => !v)}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all ${
            showCreate
              ? 'bg-red-500/10 text-red-400 border border-red-500/25'
              : 'border border-theme bg-theme-surface text-theme-muted hover:text-theme'
          }`}
        >
          <Plus size={11} className={`transition-transform ${showCreate ? 'rotate-45' : ''}`} />
          {showCreate ? 'Cancel' : 'New Key'}
        </motion.button>
      }
    >
      {/* Create row */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-theme bg-theme-surface/50 flex gap-3">
              <input
                type="text"
                autoFocus
                className="sp-input flex-1 text-sm"
                placeholder="Name this key (e.g. CI/CD, Local Dev)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createKey()}
              />
              <motion.button
                onClick={createKey}
                disabled={!newKeyName.trim() || creating}
                whileTap={{ scale: 0.96 }}
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold font-mono disabled:opacity-40 flex items-center gap-2 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, #FF2D55, #cc1a3a)',
                  boxShadow: '0 0 20px rgba(255,45,85,0.25)',
                }}
              >
                {creating ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Create
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New key reveal */}
      <AnimatePresence>
        {newKeyValue && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="px-6 py-4 border-b border-theme"
              style={{
                background: 'rgba(52,211,153,0.04)',
                borderLeft: '2px solid rgba(52,211,153,0.4)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} className="text-emerald-400" />
                <p className="text-emerald-400 text-xs font-semibold font-mono">
                  Copy now — this key won&apos;t be shown again
                </p>
              </div>
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(52,211,153,0.15)' }}
              >
                <code className="text-emerald-300/80 text-[11px] font-mono flex-1 break-all">{newKeyValue}</code>
                <CopyBtn text={newKeyValue} />
              </div>
              <button
                onClick={() => setNewKeyValue(null)}
                className="text-theme-faint text-[11px] mt-2 hover:text-theme-muted transition-colors font-mono"
              >
                Dismiss ↑
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key list */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={16} className="text-theme-faint animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Key size={18} className="text-theme-faint/50" />
            <p className="text-theme-faint text-[11px] font-mono tracking-widest">NO KEYS ISSUED</p>
          </div>
        ) : (
          <div className="divide-y divide-theme">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-2.5 bg-theme-surface/30">
              <span className="hud-label text-[9px]">Key</span>
              <span className="hud-label text-[9px] text-right">Created</span>
              <span className="hud-label text-[9px] w-8" />
            </div>
            {keys.map((key, i) => (
              <motion.div
                key={key.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-6 py-4 hover:bg-theme-surface/50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-theme text-sm font-medium truncate">{key.name}</p>
                  <p
                    className="text-[11px] font-mono mt-0.5"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    {key.prefix}
                    <span style={{ letterSpacing: '0.05em' }}>{'•'.repeat(16)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-theme-faint text-[11px] font-mono">
                    {format(new Date(key.createdAt), 'MMM d, yyyy')}
                  </p>
                  <p className="text-theme-faint/60 text-[10px] mt-0.5">
                    {key.lastUsedAt
                      ? `Used ${formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}`
                      : 'Never used'}
                  </p>
                </div>
                <motion.button
                  onClick={() => deleteKey(key.id)}
                  disabled={deletingId === key.id}
                  whileTap={{ scale: 0.88 }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-faint hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  style={{ ':hover': { background: 'rgba(255,45,85,0.08)' } } as any}
                  title="Revoke key"
                >
                  {deletingId === key.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />
                  }
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

// ─── Main settings page ───────────────────────────────────────────────────────
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
      toast.error(e.response?.data?.message ?? 'Failed to update')
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
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="relative">
          <Loader2 size={24} className="text-red-400/40 animate-spin" />
          <div className="absolute inset-0 blur-xl animate-pulse" style={{ background: 'rgba(255,45,85,0.2)' }} />
        </div>
        <p className="hud-label tracking-[0.3em] animate-pulse">LOADING OPERATOR DATA</p>
      </div>
    )
  }

  const canSavePassword = currentPassword.length > 0 && newPassword.length >= 8

  return (
    <div className="space-y-8 max-w-2xl relative">
      {/* Ambient */}
      <div
        className="fixed top-0 right-0 w-[500px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(255,45,85,0.04) 0%, transparent 60%)' }}
      />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="hud-label text-[9px] mb-1.5 tracking-[0.3em]">OPERATOR</p>
          <h1 className="text-4xl font-black font-mono leading-none text-theme">Settings</h1>
        </div>
        <PlanBadge plan={me.plan} />
      </motion.div>

      {/* ── Profile hero ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="hud-card p-6 relative overflow-hidden"
      >
        <div className="scan-line" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top left, rgba(255,45,85,0.04) 0%, transparent 60%)' }}
        />

        <div className="flex items-center gap-5">
          <Avatar name={me.name} email={me.email} />
          <div className="flex-1 min-w-0">
            <p className="text-theme font-bold text-lg leading-tight truncate">{me.name}</p>
            <p className="text-theme-muted text-sm font-mono mt-0.5 truncate">{me.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-theme-faint font-mono flex items-center gap-1">
                <Calendar size={9} />
                Member since {format(new Date(me.createdAt), 'MMM yyyy')}
              </span>
              <span className="text-theme-border">·</span>
              <span className="text-[10px] text-theme-faint font-mono flex items-center gap-1">
                <Activity size={9} />
                {me.sitesLimit} site limit
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Profile form ──────────────────────────────────────────────── */}
      <Section icon={User} title="Profile" subtitle="Update your display name" delay={0.1}>
        <form onSubmit={saveProfile} className="p-6 space-y-5">
          <Field label="Display Name">
            <input
              type="text"
              className="sp-input w-full"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
            />
          </Field>
          <Field
            label="Email Address"
            hint="Email changes require contacting support."
          >
            <input
              type="email"
              className="sp-input w-full opacity-40 cursor-not-allowed select-none"
              value={me.email}
              disabled
            />
          </Field>
          <div className="flex items-center justify-end pt-1">
            <motion.button
              type="submit"
              disabled={savingProfile || !name.trim() || name === me.name}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold font-mono disabled:opacity-35 transition-all"
              style={{
                background: 'linear-gradient(135deg, #FF2D55, #cc1a3a)',
                boxShadow: '0 0 20px rgba(255,45,85,0.2)',
              }}
            >
              {savingProfile ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Save Changes
            </motion.button>
          </div>
        </form>
      </Section>

      {/* ── Security ──────────────────────────────────────────────────── */}
      <Section icon={Shield} title="Security" subtitle="Change your password" delay={0.15}>
        <form onSubmit={savePassword} className="p-6 space-y-5">
          <Field label="Current Password">
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          </Field>
          <Field label="New Password">
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
            <PasswordStrength password={newPassword} />
          </Field>
          <div className="flex items-center justify-end pt-1">
            <motion.button
              type="submit"
              disabled={savingPassword || !canSavePassword}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-mono border transition-all disabled:opacity-35"
              style={{
                background: canSavePassword ? 'rgba(255,45,85,0.08)' : 'transparent',
                borderColor: canSavePassword ? 'rgba(255,45,85,0.3)' : 'rgba(255,255,255,0.08)',
                color: canSavePassword ? 'rgba(255,45,85,0.9)' : 'rgba(255,255,255,0.3)',
              }}
            >
              {savingPassword ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
              Change Password
            </motion.button>
          </div>
        </form>
      </Section>

      {/* ── API Keys ──────────────────────────────────────────────────── */}
      <ApiKeysSection />

      {/* ── Account details ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="hud-card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-theme">
          <h3 className="text-theme font-semibold text-sm">Account Details</h3>
        </div>
        <div className="divide-y divide-theme">
          {[
            { label: 'User ID',      value: me.id,                                           mono: true  },
            { label: 'Member Since', value: format(new Date(me.createdAt), 'MMMM d, yyyy'),  mono: false },
            { label: 'Plan',         value: me.plan,                                          badge: true },
            { label: 'Sites Limit',  value: String(me.sitesLimit),                            mono: false },
            { label: 'Subscription', value: me.subscriptionStatus,                            mono: false },
          ].map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.04 }}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-theme-surface/40 transition-colors"
            >
              <span className="text-theme-faint text-[11px] font-mono uppercase tracking-widest">{row.label}</span>
              {row.badge ? (
                <PlanBadge plan={row.value} />
              ) : row.mono ? (
                <div className="flex items-center gap-1.5">
                  <code className="text-theme-secondary text-[10px] font-mono bg-theme-surface px-2 py-1 rounded border border-theme truncate max-w-[160px]">
                    {row.value}
                  </code>
                  <CopyBtn text={row.value} size={11} />
                </div>
              ) : (
                <span className="text-theme-secondary text-xs font-mono">{row.value}</span>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}