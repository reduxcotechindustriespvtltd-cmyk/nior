'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react'
import { api, setToken } from '@/lib/auth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password: pass })
      setToken(data.accessToken)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black noise flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid */}
      <div className="absolute inset-0 bg-grid opacity-100" />

      {/* Ambient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-[380px]"
      >
        {/* Card */}
        <div className="glass-strong rounded-2xl p-8 relative overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px rgba(0,0,0,0.8)' }}>

          {/* Top shimmer line */}
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
              <p className="text-[10px] text-white/25 font-mono mt-0.5">CONTROL PANEL</p>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white leading-tight">Welcome back</h1>
            <p className="text-sm text-white/35 mt-1.5">Sign in to your control panel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-white/30 uppercase tracking-wider">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" className="sp-input" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-white/30 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} required value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••" className="sp-input pr-10" />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="group w-full mt-2 py-3 rounded-xl text-sm font-semibold text-white border border-white/10 bg-white/[0.06] hover:bg-white/[0.1] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 20px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              {loading ? (
                <span className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-white/25 mt-5">
          No account?{' '}
          <Link href="/auth/register" className="text-white/50 hover:text-white transition-colors">
            Create one free
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
