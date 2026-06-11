'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, XCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/auth'
import { useQueryClient } from '@tanstack/react-query'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()
  const orderId = searchParams.get('orderId')
  const isMock = searchParams.get('mock') === '1'

  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'failed'>('loading')
  const [plan, setPlan] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!orderId) {
      setStatus('failed')
      setMessage('Missing payment reference.')
      return
    }

    let attempts = 0
    const maxAttempts = 8

    async function verify() {
      try {
        const res = await api.post('/billing/verify', {
          merchantOrderId: orderId,
          mock: isMock,
        })

        if (res.data.status === 'COMPLETED') {
          setStatus('success')
          setPlan(res.data.plan ?? null)
          setMessage(res.data.message ?? 'Your subscription is now active.')
          qc.invalidateQueries({ queryKey: ['me'] })
          return
        }

        setStatus('pending')
        setMessage(res.data.message ?? 'Payment is being processed.')
      } catch (e: unknown) {
        const err = e as { response?: { status?: number; data?: { message?: string; status?: string } } }
        if (err.response?.data?.status === 'FAILED' || err.response?.status === 402) {
          setStatus('failed')
          setMessage(err.response?.data?.message ?? 'Payment failed.')
          return
        }
        if (attempts < maxAttempts) {
          attempts++
          setTimeout(verify, 2000)
          return
        }
        setStatus('pending')
        setMessage('Payment verification is taking longer than expected. Check back in a few minutes.')
      }
    }

    verify()
  }, [orderId, isMock, qc])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-8 max-w-md w-full text-center border border-white/[0.08]"
      >
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="text-red-400 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Confirming payment</h1>
            <p className="text-white/40 text-sm">Please wait while we verify your transaction with PhonePe…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Payment successful</h1>
            {plan && (
              <p className="text-red-400 font-mono text-sm mb-2">{plan} plan activated</p>
            )}
            <p className="text-white/40 text-sm mb-6">{message}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, #FF2D55, #CC1A3A)',
              }}
            >
              Go to dashboard
              <ArrowRight size={14} />
            </Link>
          </>
        )}

        {status === 'pending' && (
          <>
            <Loader2 size={40} className="text-amber-400 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Payment pending</h1>
            <p className="text-white/40 text-sm mb-6">{message}</p>
            <button
              onClick={() => router.refresh()}
              className="text-sm text-white/60 hover:text-white underline"
            >
              Refresh status
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Payment failed</h1>
            <p className="text-white/40 text-sm mb-6">{message}</p>
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white"
            >
              Try again
            </Link>
          </>
        )}
      </motion.div>
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
