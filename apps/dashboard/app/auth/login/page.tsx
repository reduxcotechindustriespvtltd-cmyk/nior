'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import {
  Eye, EyeOff, Zap, ArrowRight, Loader2, Shield, Lock,
  ChevronRight, Power, Globe, Wifi, WifiOff,
} from 'lucide-react'
import { api, setToken } from '@/lib/auth'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Node {
  id: number
  label: string
  angle: number
  radius: number
  killed: boolean
  speed: number
  size: 'sm' | 'md' | 'lg'
}

// ─── Static node config (stable across renders) ───────────────────────────────
const NODES: Node[] = [
  { id: 1,  label: 'api.acme.io',         angle: 0,    radius: 120, killed: true,  speed: 0.4,  size: 'md' },
  { id: 2,  label: 'shop.verve.co',        angle: 72,   radius: 120, killed: false, speed: 0.4,  size: 'md' },
  { id: 3,  label: 'dashboard.nova.app',   angle: 144,  radius: 120, killed: true,  speed: 0.4,  size: 'md' },
  { id: 4,  label: 'portal.flux.io',       angle: 216,  radius: 120, killed: false, speed: 0.4,  size: 'md' },
  { id: 5,  label: 'app.drift.co',         angle: 288,  radius: 120, killed: false, speed: 0.4,  size: 'md' },
  { id: 6,  label: 'beta.orion.dev',       angle: 30,   radius: 200, killed: false, speed: 0.22, size: 'sm' },
  { id: 7,  label: 'cdn.apex.io',          angle: 100,  radius: 200, killed: true,  speed: 0.22, size: 'sm' },
  { id: 8,  label: 'admin.crest.app',      angle: 175,  radius: 200, killed: true,  speed: 0.22, size: 'sm' },
  { id: 9,  label: 'legacy.peak.co',       angle: 250,  radius: 200, killed: false, speed: 0.22, size: 'sm' },
  { id: 10, label: 'staging.bolt.dev',     angle: 320,  radius: 200, killed: false, speed: 0.22, size: 'sm' },
  { id: 11, label: 'web.pulse.io',         angle: 55,   radius: 280, killed: true,  speed: 0.14, size: 'lg' },
  { id: 12, label: 'app.tide.co',          angle: 160,  radius: 280, killed: false, speed: 0.14, size: 'lg' },
  { id: 13, label: 'monitor.veil.app',     angle: 265,  radius: 280, killed: true,  speed: 0.14, size: 'lg' },
]

// ─── Orbit ring ───────────────────────────────────────────────────────────────
function OrbitRing({ radius, delay = 0 }: { radius: number; delay?: number }) {
  return (
    <motion.div
      className="absolute rounded-full border pointer-events-none"
      style={{
        width: radius * 2,
        height: radius * 2,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderColor: 'rgba(255,45,85,0.08)',
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    />
  )
}

// ─── Orbiting node ────────────────────────────────────────────────────────────
function OrbitNode({ node, tick }: { node: Node; tick: number }) {
  const angle = ((node.angle + tick * node.speed) % 360) * (Math.PI / 180)
  const x = Math.cos(angle) * node.radius
  const y = Math.sin(angle) * node.radius

  const dotSize = node.size === 'lg' ? 10 : node.size === 'md' ? 8 : 6
  const color = node.killed ? '#FF2D55' : '#34d399'

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
      }}
    >
      {/* Dot */}
      <div
        className="rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          background: color,
          boxShadow: `0 0 ${node.killed ? 10 : 8}px ${color}${node.killed ? 'cc' : '99'}`,
          transform: 'translate(-50%, -50%)',
        }}
      />
      {/* Pulse ring for live nodes */}
      {!node.killed && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: dotSize + 8,
            height: dotSize + 8,
            border: `1px solid ${color}`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  )
}

// ─── Floating status cards ────────────────────────────────────────────────────
const FLOAT_CARDS = [
  { label: 'api.acme.io',      status: 'KILLED',   mode: 'freeze',  x: '10%',  y: '18%',  delay: 0.6  },
  { label: 'shop.verve.co',    status: 'LIVE',      mode: null,      x: '62%',  y: '12%',  delay: 1.0  },
  { label: 'admin.crest.app',  status: 'KILLED',   mode: 'overlay', x: '68%',  y: '75%',  delay: 1.4  },
  { label: 'web.pulse.io',     status: 'KILLED',   mode: 'redirect',x: '5%',   y: '72%',  delay: 1.8  },
]

function FloatCard({ card }: { card: typeof FLOAT_CARDS[0] }) {
  const isKilled = card.status === 'KILLED'
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: card.x, top: card.y }}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
      transition={{
        opacity: { delay: card.delay, duration: 0.5 },
        scale:   { delay: card.delay, duration: 0.5 },
        y:       { delay: card.delay + 0.5, duration: 4, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <div
        className="rounded-xl px-3 py-2 flex items-center gap-2 whitespace-nowrap"
        style={{
          background: isKilled ? 'rgba(255,45,85,0.08)' : 'rgba(52,211,153,0.06)',
          border: isKilled ? '1px solid rgba(255,45,85,0.18)' : '1px solid rgba(52,211,153,0.15)',
          backdropFilter: 'blur(12px)',
          boxShadow: isKilled
            ? '0 4px 20px rgba(255,45,85,0.1)'
            : '0 4px 20px rgba(52,211,153,0.08)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: isKilled ? '#FF2D55' : '#34d399',
            boxShadow: isKilled ? '0 0 6px rgba(255,45,85,0.8)' : '0 0 6px rgba(52,211,153,0.8)',
          }}
        />
        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {card.label}
        </span>
        <span
          className="text-[9px] font-mono font-bold"
          style={{ color: isKilled ? '#FF2D55' : '#34d399' }}
        >
          {card.status}
        </span>
        {card.mode && (
          <span
            className="text-[8px] font-mono px-1 py-0.5 rounded uppercase tracking-wider"
            style={{
              background: 'rgba(255,45,85,0.1)',
              border: '1px solid rgba(255,45,85,0.15)',
              color: 'rgba(255,45,85,0.5)',
            }}
          >
            {card.mode}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Radar sweep ──────────────────────────────────────────────────────────────
function RadarSweep() {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        width: 320,
        height: 320,
        marginTop: -160,
        marginLeft: -160,
        transformOrigin: 'center',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
    >
      <svg width="320" height="320" viewBox="0 0 320 320" className="absolute inset-0">
        <defs>
          <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,45,85,0.0)" />
            <stop offset="100%" stopColor="rgba(255,45,85,0.0)" />
          </radialGradient>
          <mask id="sweepMask">
            <path
              d="M160,160 L160,0 A160,160 0 0,1 310,130 Z"
              fill="white"
            />
          </mask>
        </defs>
        {/* Sweep wedge */}
        <path
          d="M160,160 L160,0 A160,160 0 0,1 310,130 Z"
          fill="url(#sweepGrad)"
          style={{
            fill: 'rgba(255,45,85,0.04)',
          }}
        />
        {/* Leading edge line */}
        <line
          x1="160" y1="160"
          x2="160" y2="5"
          stroke="rgba(255,45,85,0.35)"
          strokeWidth="1"
        />
      </svg>
    </motion.div>
  )
}

// ─── Left panel ───────────────────────────────────────────────────────────────
function LeftPanel() {
  const [tick, setTick] = useState(0)
  const [killedCount, setKilledCount] = useState(
    NODES.filter(n => n.killed).length,
  )

  useEffect(() => {
    let frame = 0
    let raf: number
    const loop = () => {
      frame++
      setTick(frame)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const liveCount = NODES.length - killedCount

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,45,85,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,45,85,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Horizontal scan sweep */}
      <motion.div
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,45,85,0.25), transparent)' }}
        animate={{ y: ['-100vh', '100vh'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
      />

      {/* Orbit rings */}
      {[120, 200, 280].map((r, i) => (
        <OrbitRing key={r} radius={r} delay={i * 0.2} />
      ))}

      {/* Radar sweep */}
      <RadarSweep />

      {/* Center power icon */}
      <motion.div
        className="absolute z-10"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          animate={{ boxShadow: ['0 0 30px rgba(255,45,85,0.3)', '0 0 60px rgba(255,45,85,0.5)', '0 0 30px rgba(255,45,85,0.3)'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(255,45,85,0.2) 0%, rgba(255,45,85,0.06) 100%)',
            border: '1px solid rgba(255,45,85,0.4)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v9" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,45,85,0.9))' }} />
            <path d="M18.36 5.64A9 9 0 1 1 5.64 5.64" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,45,85,0.9))' }} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Orbiting nodes */}
      {NODES.map(node => (
        <OrbitNode key={node.id} node={node} tick={tick} />
      ))}

      {/* Floating status cards */}
      {FLOAT_CARDS.map(card => (
        <FloatCard key={card.label} card={card} />
      ))}

      {/* Bottom brand block */}
      <motion.div
        className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        {/* Live stats strip */}
        <div
          className="flex items-center gap-6 px-5 py-2.5 rounded-xl"
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 8px rgba(52,211,153,0.8)' }} />
            <span className="text-[11px] font-mono text-emerald-400">{liveCount} LIVE</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"
              style={{ boxShadow: '0 0 8px rgba(255,45,85,0.8)' }} />
            <span className="text-[11px] font-mono text-red-400">{killedCount} KILLED</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              style={{ boxShadow: '0 0 6px rgba(34,211,238,0.8)' }}
            />
            <span className="text-[11px] font-mono text-cyan-400/70">MONITORING</span>
          </div>
        </div>

        <div className="text-center space-y-0.5">
          <p className="text-white/60 text-sm font-semibold">Kill-switch infrastructure</p>
          <p className="text-white/20 text-[11px] font-mono tracking-widest">POWERED BY SPECTER</p>
        </div>
      </motion.div>
    </div>
  )
}

// ─── HUD corner brackets ──────────────────────────────────────────────────────
function HudCorners() {
  const s = 16
  return (
    <>
      {[
        { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
        { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5 },
        { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
        { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
      ].map((style, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            ...style,
            width: s,
            height: s,
            borderColor: 'rgba(255,45,85,0.4)',
            borderStyle: 'solid',
          }}
        />
      ))}
    </>
  )
}

// ─── Secure indicator ─────────────────────────────────────────────────────────
function SecureIndicator() {
  const [dots, setDots] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setDots(d => (d % 3) + 1), 500)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
        style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)' }}
      />
      <span className="text-[9px] font-mono tracking-widest text-emerald-400/70 uppercase">
        Secure{'.'.repeat(dots)}
      </span>
    </div>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

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

  const inputStyle = (field: string) => ({
    background: 'rgba(255,255,255,0.04)',
    border: focused === field
      ? '1px solid rgba(255,45,85,0.45)'
      : '1px solid rgba(255,255,255,0.07)',
    boxShadow: focused === field
      ? '0 0 20px rgba(255,45,85,0.08), inset 0 0 12px rgba(255,45,85,0.03)'
      : 'none',
    transition: 'all 0.2s ease',
  })

  return (
    <div className="flex flex-col justify-center w-full max-w-sm mx-auto px-4 sm:px-8 py-12">
      {/* Logo — shown on mobile when left panel is hidden */}
      <div className="flex items-center gap-2.5 mb-10 lg:hidden">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: 'rgba(255,45,85,0.12)',
            border: '1px solid rgba(255,45,85,0.25)',
            boxShadow: '0 0 16px rgba(255,45,85,0.15)',
          }}
        >
          <Zap size={14} style={{ color: '#FF2D55' }} fill="#FF2D55" />
        </div>
        <div>
          <p className="text-white font-black text-sm tracking-tight leading-none">SPECTER</p>
          <p className="text-[9px] text-white/20 font-mono tracking-[0.2em] mt-0.5">CONTROL PANEL</p>
        </div>
      </div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10"
      >
        <p className="text-[10px] font-mono tracking-[0.3em] text-white/25 uppercase mb-2">
          Authentication
        </p>
        <h1 className="text-3xl font-black text-white leading-tight">Welcome back</h1>
        <p className="text-sm text-white/35 mt-1.5">Sign in to your control panel</p>
      </motion.div>

      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        className="space-y-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        {/* Email */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest block">
            Email Address
          </label>
          <div className="relative">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="operator@example.com"
              className="w-full px-4 py-3 rounded-xl text-sm font-mono text-white placeholder:text-white/15 outline-none"
              style={inputStyle('email')}
            />
            <AnimatePresence>
              {focused === 'email' && (
                <motion.div
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                  className="absolute bottom-0 left-4 right-4 h-[1px] rounded-full"
                  style={{ background: 'rgba(255,45,85,0.5)', transformOrigin: 'left' }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              Password
            </label>
            <Link href="/auth/forgot"
              className="text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              required
              value={pass}
              onChange={e => setPass(e.target.value)}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 pr-11 rounded-xl text-sm font-mono text-white placeholder:text-white/20 outline-none"
              style={inputStyle('pass')}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors p-0.5">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <AnimatePresence>
              {focused === 'pass' && (
                <motion.div
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                  className="absolute bottom-0 left-4 right-4 h-[1px] rounded-full"
                  style={{ background: 'rgba(255,45,85,0.5)', transformOrigin: 'left' }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={loading || !email || !pass}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full py-3.5 rounded-xl text-sm font-bold text-white font-mono tracking-wide disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #FF2D55 0%, #CC1A3A 100%)',
            boxShadow: loading || !email || !pass
              ? 'none'
              : '0 0 30px rgba(255,45,85,0.35), 0 4px 15px rgba(255,45,85,0.2)',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          {/* Shimmer */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.1) 50%, transparent 65%)' }}
          />
          <span className="relative flex items-center justify-center gap-2">
            {loading
              ? <Loader2 size={15} className="animate-spin" />
              : <>
                  <Lock size={13} />
                  Authenticate
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </>
            }
          </span>
        </motion.button>
      </motion.form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-7">
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <span className="text-[10px] text-white/15 font-mono tracking-widest">OR</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* Register */}
      <Link
        href="/auth/register"
        className="group flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-sm text-white/35 group-hover:text-white/55 transition-colors">
          No account?{' '}
          <span className="text-white/55 font-semibold group-hover:text-white/80 transition-colors">
            Create one free
          </span>
        </span>
        <ChevronRight size={14}
          className="text-white/20 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all" />
      </Link>

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 mt-8 text-white/15">
        <Shield size={10} />
        <span className="text-[9px] font-mono tracking-widest uppercase">End-to-end encrypted</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black flex overflow-hidden">

      {/* ── Left panel (hidden below lg) ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative shrink-0">
        {/* Vertical divider */}
        <div
          className="absolute right-0 top-0 bottom-0 w-px z-10"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,45,85,0.2) 30%, rgba(255,45,85,0.2) 70%, transparent)' }}
        />
        <LeftPanel />

        {/* Top-left logo */}
        <motion.div
          className="absolute top-8 left-8 flex items-center gap-2.5 z-20"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(255,45,85,0.12)',
              border: '1px solid rgba(255,45,85,0.25)',
              boxShadow: '0 0 16px rgba(255,45,85,0.15)',
            }}
          >
            <Zap size={14} style={{ color: '#FF2D55' }} fill="#FF2D55" />
          </div>
          <div>
            <p className="text-white font-black text-sm tracking-tight leading-none">SPECTER</p>
            <p className="text-[9px] text-white/20 font-mono tracking-[0.2em] mt-0.5">CONTROL PANEL</p>
          </div>
        </motion.div>

        {/* Top-right secure badge */}
        <motion.div
          className="absolute top-9 right-8 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <SecureIndicator />
        </motion.div>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">
        {/* Subtle bg */}
        <div className="absolute inset-0 noise opacity-20 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 60% 40%, rgba(255,45,85,0.04) 0%, transparent 60%)',
          }}
        />

        {/* Vertical center */}
        <div className="flex-1 flex items-center">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}