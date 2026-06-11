'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  Zap,
  Crown,
  Building2,
  Loader2,
  Sparkles,
  Shield,
  IndianRupee,
} from 'lucide-react'
import { usePlans, useMe } from '@/lib/hooks'
import { api } from '@/lib/auth'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/hud/PageHeader'

const PLAN_ICONS: Record<string, React.ElementType> = {
  FREE: Zap,
  STARTER: Zap,
  PRO: Crown,
  AGENCY: Building2,
  ENTERPRISE: Building2,
}

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function annualSavings(monthly: number, annual: number) {
  const fullYear = monthly * 12
  if (fullYear <= 0) return 0
  return Math.round(((fullYear - annual) / fullYear) * 100)
}

export default function BillingPage() {
  const { data: plans = [], isLoading: plansLoading } = usePlans()
  const { data: me, isLoading: meLoading } = useMe()
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const currentPlan = me?.plan ?? 'FREE'

  async function handleUpgrade(planId: string) {
    if (planId === 'ENTERPRISE') {
      toast('Contact us at billing@nior.app for enterprise pricing.')
      return
    }
    if (planId === 'FREE') {
      toast('Contact support to downgrade your plan.')
      return
    }

    setLoadingPlan(planId)
    try {
      const res = await api.post('/billing/checkout', { planId, interval })
      if (res.data?.url) {
        window.location.href = res.data.url
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message ?? 'Failed to start checkout')
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

  const paidPlans = plans.filter(p => p.id !== 'FREE' && p.id !== 'ENTERPRISE')

  return (
    <div className="space-y-8 max-w-6xl mx-auto">

      <PageHeader
        label="Access Control"
        title="Power Tiers"
        subtitle="Scale your kill-switch coverage as you grow. Pay securely with UPI, cards, or net banking via PhonePe."
      />

      {/* Current plan */}
      {me && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="hud-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Shield size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest font-mono">Current plan</p>
              <p className="text-white text-xl font-bold">{currentPlan}</p>
              {me.currentPeriodEnd && (
                <p className="text-white/30 text-xs mt-0.5">
                  Renews {new Date(me.currentPeriodEnd).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30 font-mono">
            <IndianRupee size={12} />
            <span>Prices in INR · GST as applicable</span>
          </div>
        </motion.div>
      )}

      {/* Interval toggle */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          {(['monthly', 'annual'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setInterval(opt)}
              className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                interval === opt ? 'text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {interval === opt && (
                <motion.div
                  layoutId="billing-interval"
                  className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.1]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {opt === 'monthly' ? 'Monthly' : 'Annual'}
                {opt === 'annual' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Save ~17%
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {plans.map((plan, i) => {
            const Icon = PLAN_ICONS[plan.id] ?? Zap
            const isHighlighted = plan.id === 'PRO'
            const isCurrent = plan.id === currentPlan
            const isFree = plan.priceMonthly === 0
            const isEnterprise = plan.priceMonthly == null && plan.id === 'ENTERPRISE'

            const price =
              interval === 'annual'
                ? plan.priceAnnual
                : plan.priceMonthly

            const savings =
              plan.priceMonthly && plan.priceAnnual
                ? annualSavings(plan.priceMonthly, plan.priceAnnual)
                : 0

            return (
              <motion.div
                key={plan.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative rounded-2xl p-6 flex flex-col overflow-hidden transition-all hud-card ${
                  isHighlighted ? 'border-red-500/35' : ''
                }`}
                style={isHighlighted ? { boxShadow: '0 0 48px rgba(255,45,85,0.1)' } : undefined}
              >
                {isHighlighted && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-widest">
                    <Sparkles size={10} />
                    Popular
                  </div>
                )}

                <div className="mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    isHighlighted
                      ? 'bg-red-500/15 border border-red-500/25'
                      : 'bg-white/[0.05] border border-white/[0.07]'
                  }`}>
                    <Icon size={18} className={isHighlighted ? 'text-red-400' : 'text-white/50'} />
                  </div>
                  <p className="text-white font-bold text-lg">{plan.name}</p>
                  <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{plan.description}</p>
                </div>

                <div className="mb-5 min-h-[4rem]">
                  {isEnterprise ? (
                    <p className="text-white text-3xl font-bold">Custom</p>
                  ) : isFree ? (
                    <p className="text-white text-3xl font-bold">Free</p>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <p className="text-white text-3xl font-bold tracking-tight">
                          {formatInr(price ?? 0)}
                        </p>
                        <p className="text-white/30 text-sm pb-1">
                          /{interval === 'annual' ? 'yr' : 'mo'}
                        </p>
                      </div>
                      {interval === 'annual' && savings > 0 && (
                        <p className="text-emerald-400/80 text-xs mt-1 font-mono">
                          Save {savings}% vs monthly
                        </p>
                      )}
                    </>
                  )}
                  {plan.sitesLimit != null && (
                    <p className="text-white/30 text-xs mt-2 font-mono">
                      {plan.sitesLimit >= 999999
                        ? 'Unlimited sites'
                        : `Up to ${plan.sitesLimit} site${plan.sitesLimit === 1 ? '' : 's'}`}
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/55">
                      <Check size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <motion.button
                  onClick={() => !isCurrent && handleUpgrade(plan.id)}
                  disabled={isCurrent || loadingPlan === plan.id}
                  whileTap={!isCurrent ? { scale: 0.98 } : {}}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-white/[0.06] text-white/40 border border-white/[0.06] cursor-default'
                      : isHighlighted
                      ? 'text-white'
                      : 'bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white'
                  }`}
                  style={isHighlighted && !isCurrent ? {
                    background: 'linear-gradient(135deg, #FF2D55, #CC1A3A)',
                    boxShadow: '0 4px 24px rgba(255,45,85,0.35)',
                  } : undefined}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isCurrent ? (
                    'Current plan'
                  ) : isEnterprise ? (
                    'Contact sales'
                  ) : isFree ? (
                    'Included'
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </motion.button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Trust row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="hud-card p-5"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="text-white/70 text-sm font-medium">Secure payments by PhonePe</p>
            <p className="text-white/30 text-xs mt-1">
              UPI · Cards · Net Banking · Instant activation after payment
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {['UPI', 'Visa', 'Mastercard', 'Net Banking'].map(tag => (
              <span
                key={tag}
                className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Compare strip */}
      {paidPlans.length > 0 && (
        <p className="text-center text-white/20 text-xs font-mono pb-4">
          All paid plans include a 7-day money-back guarantee · Cancel anytime from settings
        </p>
      )}
    </div>
  )
}
