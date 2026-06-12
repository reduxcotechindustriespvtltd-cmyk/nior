'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface NeonButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  className?: string
}

export function NeonButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
}: NeonButtonProps) {
  const base =
    'relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden'

  const variants = {
    primary: 'neon-btn-primary text-white',
    ghost: 'neon-btn-ghost text-theme-secondary hover:text-theme',
    danger: 'neon-btn-danger text-red-300',
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  )
}
