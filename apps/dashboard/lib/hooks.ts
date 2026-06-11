import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './auth'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Site {
  id: string
  name: string
  domain: string
  siteToken: string
  killMode: string
  killState: Record<string, unknown> | null
  isKilled: boolean
  createdAt: string
  updatedAt: string
  _count?: { events: number }
  events?: KillEvent[]
}

export interface KillEvent {
  id: string
  siteId: string
  triggeredBy: string
  mode: string
  config: Record<string, unknown> | null
  activatedAt: string
  deactivatedAt: string | null
}

export interface User {
  id: string
  name: string
  email: string
  createdAt: string
  plan: string
  sitesLimit: number
  subscriptionStatus: string
  currentPeriodEnd: string | null
}

export interface Plan {
  id: string
  name: string
  description: string
  priceMonthly: number | null
  priceAnnual: number | null
  sitesLimit: number | null
  features: string[]
}

// ── Sites ─────────────────────────────────────────────────────────────────────

export function useSites() {
  return useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data.sites),
  })
}

export function useSite(id: string) {
  return useQuery<Site>({
    queryKey: ['site', id],
    queryFn: () => api.get(`/sites/${id}`).then(r => r.data.site),
    refetchInterval: 15_000,
  })
}

export function useSiteEvents(id: string) {
  return useQuery<{ events: KillEvent[]; total: number }>({
    queryKey: ['site-events', id],
    queryFn: () => api.get(`/sites/${id}/events`).then(r => r.data),
  })
}

export function useSiteSnippet(id: string) {
  return useQuery<{ tag: string; swStub: string; siteToken: string }>({
    queryKey: ['snippet', id],
    queryFn: () => api.get(`/sites/${id}/snippet`).then(r => r.data),
    staleTime: Infinity,
  })
}

export function useKillSite(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { mode: string; config?: Record<string, unknown> }) =>
      api.post(`/sites/${id}/kill`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['site', id] })
      qc.invalidateQueries({ queryKey: ['site-events', id] })
      toast.success('Kill switch activated')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to activate'),
  })
}

export function useRestoreSite(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/sites/${id}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['site', id] })
      qc.invalidateQueries({ queryKey: ['site-events', id] })
      toast.success('Site restored')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to restore'),
  })
}

export function useDeleteSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sites/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      toast.success('Site deleted')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete'),
  })
}

export function useCreateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; domain: string }) => api.post('/sites', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create site'),
  })
}

// ── User ─────────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then(r => r.data.user),
  })
}

// ── Billing ───────────────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api.get('/billing/plans').then(r => r.data.plans),
    staleTime: Infinity,
  })
}
