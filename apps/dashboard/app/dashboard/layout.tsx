'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LayoutDashboard, Globe, CreditCard, Settings, LogOut, Plus, Zap } from 'lucide-react'
import { isAuthenticated, clearToken } from '@/lib/auth'

const NAV = [
  { href: '/dashboard',          label: 'Overview',  icon: LayoutDashboard },
  { href: '/dashboard/sites',    label: 'Sites',     icon: Globe },
  { href: '/dashboard/billing',  label: 'Billing',   icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings',  icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/auth/login')
  }, [router])

  function logout() {
    clearToken()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen bg-black noise overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-100" />
      {/* Ambient glow */}
      <div className="fixed top-0 left-64 w-[600px] h-[400px] bg-white/[0.015] rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-red-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="relative z-20 w-56 shrink-0 flex flex-col border-r border-white/[0.06]"
        style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(40px)' }}>

        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center"
              style={{ boxShadow: '0 0 20px rgba(255,45,85,0.2)' }}>
              <Zap size={14} className="text-white" fill="white" />
            </div>
            <div>
              <span className="text-white font-bold text-base tracking-tight">Specter</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="dot dot-live" style={{ width: 5, height: 5 }} />
                <span className="text-[10px] text-white/30 font-mono">SYSTEM ONLINE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Add Site */}
        <div className="px-3 py-3 border-b border-white/[0.05]">
          <Link href="/dashboard/sites/new"
            className="group flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-white/10 text-white/40 text-sm hover:border-white/20 hover:text-white/70 hover:bg-white/[0.03] transition-all">
            <Plus size={13} />
            <span className="text-xs">New Site</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? 'text-white bg-white/[0.07] border border-white/[0.08]'
                    : 'text-white/35 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
                style={active ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' } : {}}>
                {active && (
                  <motion.div layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full"
                    style={{ background: 'linear-gradient(to bottom, #FF2D55, #ff6b85)' }} />
                )}
                <Icon size={14} strokeWidth={active ? 2 : 1.5} />
                <span className="font-medium text-[13px]">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-2 pb-4 border-t border-white/[0.05] pt-3 space-y-1">
          <button onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all">
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
