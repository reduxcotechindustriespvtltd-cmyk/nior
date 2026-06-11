'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface PageHeaderProps {
  label: string
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ label, title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2"
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="hud-label">{label}</span>
          <span className="hud-pulse-line" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold hud-title tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-white/35 text-sm mt-2 max-w-xl leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  )
}
