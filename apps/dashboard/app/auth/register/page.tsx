'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Zap, ArrowRight, Check } from 'lucide-react'
import { api, setToken } from '@/lib/auth'
import toast from 'react-hot-toast'

const PERKS = ['1 site free forever', 'All 5 kill modes included', 'CLI + API access']

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      setToken(data.accessToken)
      toast.success('Account created')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black noise flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-[380px]"
      >
        <div className="glass-strong rounded-2xl p-8 relative overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px rgba(0,0,0,0.8)' }}>

          <div className="absolute top-0 left-8 right-8 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />

          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/[0.06] flex items-center justify-center"
              style={{ boxShadow: '0 0 20px rgba(255,45,85,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              <Zap size={16} className="text-white" fill="white" />
            </div>
            <div>
              <p className="text-white font-bold text-base tracking-tight leading-none">Specter</p>
              <p className="text-[10px] text-white/25 font-mono mt-0.5">NEW ACCOUNT</p>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white leading-tight">Create account</h1>
            <p className="text-sm text-white/35 mt-1.5">Free forever. No credit card needed.</p>
          </div>

          {/* Perks */}
          <div className="flex flex-col gap-1.5 mb-6 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {PERKS.map(p => (
              <div key={p} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center shrink-0">
                  <Check size={9} className="text-white/50" />
                </div>
                <span className="text-[12px] text-white/40">{p}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-white/30 uppercase tracking-wider">Name</label>
              <input type="text" required value={form.name} onChange={set('name')}
                placeholder="Jane Smith" className="sp-input" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-white/30 uppercase tracking-wider">Email</label>
              <input type="email" required value={form.email} onChange={set('email')}
                placeholder="you@example.com" className="sp-input" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-white/30 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} required value={form.password}
                  onChange={set('password')} placeholder="Min. 8 characters" className="sp-input pr-10" />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="group w-full mt-1 py-3 rounded-xl text-sm font-semibold text-white border border-white/10 bg-white/[0.06] hover:bg-white/[0.1] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 20px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              {loading ? (
                <span className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Get started
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-white/25 mt-5">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-white/50 hover:text-white transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
