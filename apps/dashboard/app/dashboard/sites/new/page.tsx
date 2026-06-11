'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Globe, Zap, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useCreateSite, useMe, useSites } from '@/lib/hooks'

function isValidDomain(domain: string): boolean {
  const trimmed = domain.trim().replace(/^https?:\/\//, '')
  return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(trimmed)
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
}

export default function NewSitePage() {
  const router = useRouter()
  const { data: me } = useMe()
  const { data: sites = [] } = useSites()
  const createSite = useCreateSite()

  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [domainError, setDomainError] = useState('')
  const [newSiteId, setNewSiteId] = useState('')
  const [success, setSuccess] = useState(false)

  const planLimit = me?.sitesLimit ?? 1
  const currentCount = sites.length
  const atLimit = currentCount >= planLimit
  const isFormValid = name.trim().length > 0 && domain.trim().length > 0 && !domainError && !atLimit

  function handleDomainChange(val: string) {
    setDomain(val)
    if (!val.trim()) { setDomainError(''); return }
    const normalized = normalizeDomain(val)
    setDomainError(isValidDomain(normalized) ? '' : 'Enter a valid domain (e.g. example.com)')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isFormValid) return
    const normalized = normalizeDomain(domain)
    if (!isValidDomain(normalized)) { setDomainError('Enter a valid domain (e.g. example.com)'); return }

    createSite.mutate({ name: name.trim(), domain: normalized }, {
      onSuccess: (res) => {
        setNewSiteId(res.data.site.id)
        setSuccess(true)
        toast.success(`${name} added successfully!`)
      },
    })
  }

  return (
    <div className="min-h-[80vh]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm">
          <ArrowLeft size={15} />
          Back
        </button>
        <span className="text-white/15">/</span>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#FF2D55] flex items-center justify-center">
            <Zap size={12} className="text-white" fill="white" />
          </div>
          <span className="text-white font-semibold text-sm">Add New Site</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center text-center py-20 max-w-sm mx-auto">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-6">
              <CheckCircle size={36} className="text-emerald-400" />
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-3xl font-bold text-white mb-3">Site added!</motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="text-white/40 mb-8 max-w-sm">
              <strong className="text-white">{name}</strong> is ready. Open the site to grab your token and connect it.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex gap-3">
              <button onClick={() => router.push('/dashboard')}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors">
                Back to Dashboard
              </button>
              <motion.button onClick={() => router.push(`/dashboard/sites/${newSiteId}`)} whileTap={{ scale: 0.97 }}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors shadow-lg flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #FF2D55, #CC1A3A)', boxShadow: '0 4px 20px rgba(255,45,85,0.3)' }}>
                Get install command
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="form"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-xl mx-auto">

            {/* Page title */}
            <div className="mb-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#FF2D55]/10 border border-[#FF2D55]/20 flex items-center justify-center mx-auto mb-5">
                <Globe size={24} className="text-[#FF2D55]" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Add a new site</h1>
              <p className="text-white/40 text-sm">Connect your domain to the kill-switch.</p>
            </div>

            {/* Plan limit warning */}
            <AnimatePresence>
              {atLimit && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-400/8 border border-yellow-400/20 text-yellow-300">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">Plan limit reached</p>
                      <p className="text-xs text-yellow-300/70 mt-0.5">
                        You&apos;ve used {currentCount} of {planLimit} sites on your {me?.plan} plan.{' '}
                        <button onClick={() => router.push('/dashboard/billing')} className="underline hover:text-yellow-200">
                          Upgrade to add more
                        </button>
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Usage meter */}
            <div className="mb-6 glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/40 text-xs">Sites used</span>
                <span className="text-white/60 text-xs font-mono">{currentCount} / {planLimit}</span>
              </div>
              <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((currentCount / planLimit) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  className={`h-full rounded-full ${currentCount / planLimit > 0.8 ? 'bg-yellow-400' : 'bg-[#FF2D55]'}`}
                />
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-6">
              <div>
                <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Site Name</label>
                <input
                  type="text"
                  className="sp-input w-full"
                  placeholder="Acme Corp, Startup Portal..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={createSite.isPending || atLimit}
                  maxLength={60}
                  autoFocus
                />
                <p className="text-white/20 text-xs mt-1.5">A friendly name to identify this site in your dashboard.</p>
              </div>

              <div>
                <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Domain</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    type="text"
                    className={`sp-input w-full pl-9 ${domainError ? '!border-[#FF2D55]/60' : ''}`}
                    placeholder="example.com"
                    value={domain}
                    onChange={e => handleDomainChange(e.target.value)}
                    disabled={createSite.isPending || atLimit}
                    maxLength={120}
                  />
                </div>
                <AnimatePresence>
                  {domainError && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[#FF2D55]/80 text-xs mt-1.5 overflow-hidden">
                      {domainError}
                    </motion.p>
                  )}
                </AnimatePresence>
                {!domainError && domain && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/20 text-xs mt-1.5">
                    Will register: <span className="font-mono text-white/40">{normalizeDomain(domain)}</span>
                  </motion.p>
                )}
                {!domain && <p className="text-white/20 text-xs mt-1.5">Do not include https:// or trailing slash.</p>}
              </div>

              <div className="pt-2">
                <motion.button
                  type="submit"
                  disabled={!isFormValid || createSite.isPending}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: isFormValid ? 'linear-gradient(135deg, #FF2D55, #CC1A3A)' : 'rgba(255,255,255,0.06)',
                    boxShadow: isFormValid ? '0 4px 20px rgba(255,45,85,0.3)' : 'none',
                  }}
                  whileTap={isFormValid ? { scale: 0.98 } : {}}>
                  {createSite.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Creating site...</>
                  ) : (
                    <><Zap size={16} fill="white" /> Add Site to Specter</>
                  )}
                </motion.button>
              </div>
            </form>

            {/* What happens next */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="mt-8 space-y-3">
              <p className="text-white/25 text-xs uppercase tracking-widest text-center mb-4">What happens next</p>
              {[
                { step: '1', text: 'Your site is registered and a unique token is generated.' },
                { step: '2', text: 'Run npx @rcti/noir@latest init in your project — it sets everything up automatically.' },
                { step: '3', text: 'Flip the kill switch from your dashboard. Visitors see your configured mode instantly.' },
              ].map(item => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 text-xs text-white/30 font-mono">
                    {item.step}
                  </div>
                  <p className="text-white/35 text-sm">{item.text}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
