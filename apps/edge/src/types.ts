export interface SiteState {
  kill: boolean
  mode: 'freeze' | 'overlay' | 'redirect' | 'ghost' | 'timebomb' | 'none'
  config: Record<string, unknown>
  updatedAt: number
}

export interface Env {
  SPECTER_KV: KVNamespace
  SIGNING_SECRET: string
  ENVIRONMENT: string
}

export interface StateUpdateBody {
  siteToken: string
  kill: boolean
  mode: SiteState['mode']
  config?: Record<string, unknown>
  ttl?: number
}

export interface RateLimitEntry {
  count: number
  windowStart: number
}
