'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Globe,
  CreditCard,
  Settings,
  LogOut,
  Plus,
  Zap,
  Radio,
  Cpu,
  Sun,
  Moon,
} from 'lucide-react'
import { isAuthenticated, clearToken } from '@/lib/auth'
import { useMe } from '@/lib/hooks'
import { useTheme } from '@/lib/theme'

const NAV = [
  { href: '/dashboard', label: 'Command', desc: 'System overview', icon: LayoutDashboard },
  { href: '/dashboard/sites', label: 'Sites', desc: 'Fleet control', icon: Globe },
  { href: '/dashboard/billing', label: 'Billing', desc: 'Plans & access', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', desc: 'Keys & profile', icon: Settings },
]

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-[11px] text-theme-muted tabular-nums">{time}</span>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: me } = useMe()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/auth/login')
  }, [router])

  function logout() {
    clearToken()
    router.push('/auth/login')
  }

  const pageTitle = NAV.find(
    n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
  )?.label ?? 'Nior'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Background layers */}
      <div className="aurora-bg">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
      </div>
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-60" />
      <div className="fixed inset-0 bg-grid-perspective pointer-events-none" />

      {/* Sidebar */}
      <aside
        className="relative z-20 w-[240px] shrink-0 flex flex-col border-r border-theme"
        style={{ background: 'var(--bg-sidebar)', backdropFilter: 'blur(48px)' }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,45,85,0.2), rgba(255,45,85,0.05))',
                border: '1px solid rgba(255,45,85,0.3)',
                boxShadow: '0 0 24px rgba(255,45,85,0.2)',
              }}
            >
              <Zap size={18} className="text-white relative z-10" fill="white" />
              <div className="absolute inset-0 data-stream opacity-50" />
            </div>
            <div>
              <span
                className="text-white font-bold text-lg tracking-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Nior
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="status-badge-dot bg-emerald-400" style={{ width: 5, height: 5, boxShadow: '0 0 6px rgba(52,211,153,0.9)' }} />
                <span className="system-readout text-emerald-400/80">SYS ONLINE</span>
              </div>
            </div>
          </div>
        </div>

        {/* System readout */}
        <div className="px-5 py-3 border-b border-white/[0.04] hidden lg:block">
          <div className="system-readout space-y-0.5">
            <div className="flex justify-between">
              <span>NODE</span>
              <span className="text-cyan-400/70">EDGE-01</span>
            </div>
            <div className="flex justify-between">
              <span>PLAN</span>
              <span className="text-white/50">{me?.plan ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>LIMIT</span>
              <span className="text-white/50">{me?.sitesLimit ?? '—'} sites</span>
            </div>
          </div>
        </div>

        {/* New site CTA */}
        <div className="px-3 py-3">
          <Link
            href="/dashboard/sites/new"
            className="group flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-dashed border-white/10 text-white/40 text-sm hover:border-red-500/30 hover:text-white/70 hover:bg-red-500/[0.04] transition-all"
          >
            <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-red-500/30 group-hover:bg-red-500/10 transition-all">
              <Plus size={12} />
            </div>
            <span className="text-xs font-medium">Deploy new site</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-1">
          {NAV.map(({ href, label, desc, icon: Icon }) => {
            const active =
              pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                  active ? 'nav-item-active text-white' : 'text-white/35 hover:text-white/70 hover:bg-white/[0.03]'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-glow"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-full"
                    style={{ background: 'linear-gradient(to bottom, #FF2D55, #22d3ee)' }}
                  />
                )}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    active
                      ? 'bg-red-500/15 border border-red-500/25'
                      : 'bg-white/[0.03] border border-white/[0.06] group-hover:border-white/10'
                  }`}
                >
                  <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] leading-tight">{label}</p>
                  <p className="text-[10px] text-white/25 font-mono truncate">{desc}</p>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 pt-2 border-t border-white/[0.05] space-y-2">
          {me && (
            <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-white/80 text-xs font-medium truncate">{me.name}</p>
              <p className="text-white/25 text-[10px] font-mono truncate">{me.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
          >
            <LogOut size={13} />
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Top command bar */}
        <header className="command-bar shrink-0 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 text-white/30">
              <Radio size={12} className="text-red-400/70 animate-pulse" />
              <span className="hud-label text-[9px] hidden sm:inline">COMMAND INTERFACE</span>
            </div>
            <span className="text-white/15 hidden sm:inline">/</span>
            <span
              className="text-white/70 text-sm font-semibold truncate"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {pageTitle}
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-theme bg-theme-surface text-theme-muted hover:text-theme transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme">
              <Cpu size={11} className="text-cyan-400/60" />
              <span className="system-readout text-white/30">LATENCY 12ms</span>
            </div>
            <LiveClock />
            {me && (
              <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400/90 uppercase tracking-wider hidden sm:inline">
                {me.plan}
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
