'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Crown, Building2, Loader2, ExternalLink } from 'lucide-react'
import { usePlans, useMe } from '@/lib/hooks'
import { api } from '@/lib/auth'
import toast from 'react-hot-toast'

const PLAN_ICONS: Record<string, React.ElementType> = {
  FREE: Zap,
  STARTER: Zap,
  PRO: Crown,
  AGENCY: Building2,
  ENTERPRISE: Building2,
}

const PLAN_HIGHLIGHT: Record<string, boolean> = {
  PRO: true,
}

const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function BillingPage() {
  const { data: plans = [], isLoading: plansLoading } = usePlans()
  const { data: me, isLoading: meLoading } = useMe()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const currentPlan = me?.plan ?? 'FREE'

  async function handleUpgrade(planId: string) {
    if (planId === 'ENTERPRISE') {
      toast('Contact us at billing@specter.io for enterprise pricing.')
      return
    }
    setLoadingPlan(planId)
    try {
      const res = await api.post('/billing/checkout', { plan: planId })
      if (res.data?.url) {
        window.location.href = res.data.url
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to start checkout')
    } finally {
      setLoadingPlan(null)
    }
  }

  async function handleManage() {
    setLoadingPlan('portal')
    try {
      const res = await api.post('/billing/portal')
      if (res.data?.url) {
        window.location.href = res.data.url
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to open portal')
    } finally {
      setLoadingPlan(null)
    }
  }

  if (plansLoading || meLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest mb-2">Billing</p>
        <h1 className="text-4xl font-bold grad-text leading-none">Plans</h1>
      </motion.div>

      {/* Current plan summary */}
      {me && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest font-mono mb-1">Current Plan</p>
            <p className="text-white text-2xl font-bold">{currentPlan}</p>
            {me.currentPeriodEnd && (
              <p className="text-white/30 text-xs mt-1">
                Renews {new Date(me.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
          {currentPlan !== 'FREE' && (
            <motion.button
              onClick={handleManage}
              disabled={loadingPlan === 'portal'}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 text-sm hover:bg-white/[0.08] transition-all disabled:opacity-50">
              {loadingPlan === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              Manage Billing
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Plans grid */}
      <motion.div variants={stagger} initial="hidden" animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => {
          const Icon = PLAN_ICONS[plan.id] ?? Zap
          const isHighlighted = PLAN_HIGHLIGHT[plan.id]
          const isCurrent = plan.id === currentPlan
          const isFree = plan.priceMonthly === 0 || plan.priceMonthly === null && plan.id === 'FREE'

          return (
            <motion.div key={plan.id} variants={fadeUp}
              className={`glass rounded-2xl p-6 flex flex-col relative overflow-hidden transition-all ${
                isHighlighted ? 'border border-red-500/30' : 'border border-white/[0.06]'
              }`}
              style={isHighlighted ? { boxShadow: '0 0 40px rgba(255,45,85,0.08)' } : undefined}>

              {isHighlighted && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-widest">
                    Popular
                  </span>
                </div>
              )}

              <div className="mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  isHighlighted ? 'bg-red-500/15 border border-red-500/25' : 'bg-white/[0.05] border border-white/[0.07]'
                }`}>
                  <Icon size={18} className={isHighlighted ? 'text-red-400' : 'text-white/50'} />
                </div>
                <p className="text-white font-bold text-lg">{plan.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{plan.description}</p>
              </div>

              <div className="mb-6">
                {plan.priceMonthly == null ? (
                  <p className="text-white text-3xl font-bold">Custom</p>
                ) : plan.priceMonthly === 0 ? (
                  <p className="text-white text-3xl font-bold">Free</p>
                ) : (
                  <div className="flex items-end gap-1">
                    <p className="text-white text-3xl font-bold">${plan.priceMonthly}</p>
                    <p className="text-white/30 text-sm pb-1">/mo</p>
                  </div>
                )}
                {plan.sitesLimit != null && (
                  <p className="text-white/30 text-xs mt-1 font-mono">
                    {plan.sitesLimit === -1 ? 'Unlimited sites' : `Up to ${plan.sitesLimit} site${plan.sitesLimit === 1 ? '' : 's'}`}
                  </p>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-white/50">
                    <Check size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <motion.button
                onClick={() => !isCurrent && handleUpgrade(plan.id)}
                disabled={isCurrent || loadingPlan === plan.id}
                whileTap={!isCurrent ? { scale: 0.97 } : {}}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-white/[0.06] text-white/40 border border-white/[0.06] cursor-default'
                    : isHighlighted
                    ? 'text-white'
                    : 'bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white'
                }`}
                style={isHighlighted && !isCurrent ? {
                  background: 'linear-gradient(135deg, #FF2D55, #CC1A3A)',
                  boxShadow: '0 4px 20px rgba(255,45,85,0.3)',
                } : undefined}>
                {loadingPlan === plan.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isCurrent ? (
                  'Current Plan'
                ) : plan.id === 'ENTERPRISE' ? (
                  'Contact Sales'
                ) : isFree ? (
                  'Downgrade'
                ) : (
                  'Upgrade'
                )}
              </motion.button>
            </motion.div>
          )
        })}
      </motion.div>

      {/* FAQ note */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="text-center text-white/20 text-xs font-mono">
        All plans include a 14-day free trial. No credit card required for free plan.
        Payments processed securely via Stripe.
      </motion.p>
    </div>
  )
}
