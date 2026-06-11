'use client'

import { motion } from 'framer-motion'
import { XCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function BillingCancelPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 max-w-md w-full text-center border border-white/[0.08]"
      >
        <XCircle size={48} className="text-white/30 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Payment cancelled</h1>
        <p className="text-white/40 text-sm mb-6">
          No charges were made. You can return to plans and try again whenever you&apos;re ready.
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to plans
        </Link>
      </motion.div>
    </div>
  )
}
