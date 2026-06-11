'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub: string
  accent?: 'default' | 'red' | 'green' | 'cyan'
  delay?: number
}

const ACCENTS = {
  default: { icon: 'text-white/50', glow: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)' },
  red: { icon: 'text-red-400', glow: 'rgba(255,45,85,0.12)', border: 'rgba(255,45,85,0.25)' },
  green: { icon: 'text-emerald-400', glow: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
  cyan: { icon: 'text-cyan-400', glow: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.2)' },
}

export function StatCard({ icon: Icon, label, value, sub, accent = 'default', delay = 0 }: StatCardProps) {
  const a = ACCENTS[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="hud-card group relative overflow-hidden p-5 sm:p-6"
      style={{ '--card-glow': a.glow, '--card-border': a.border } as React.CSSProperties}
    >
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />

      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 hud-card-shine" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <span className="hud-label text-[10px]">{label}</span>
          <div className={`p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] ${a.icon}`}>
            <Icon size={15} strokeWidth={1.75} />
          </div>
        </div>
        <p className="text-4xl sm:text-5xl font-bold text-white leading-none mb-2 font-mono tracking-tighter">
          {value}
        </p>
        <p className="text-xs text-white/30 font-mono">{sub}</p>
      </div>
    </motion.div>
  )
}
