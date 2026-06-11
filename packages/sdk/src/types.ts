export type KillMode = 'freeze' | 'overlay' | 'redirect' | 'ghost' | 'timebomb' | 'none'

export interface KillConfig {
  url?: string           // redirect
  title?: string         // overlay
  message?: string       // overlay
  returnTime?: string    // overlay
  maintenanceMessage?: string // freeze
  detonateAt?: string    // timebomb
  [key: string]: unknown
}

export interface KillState {
  isKilled: boolean
  killMode: KillMode
  config: KillConfig
}

export interface SpecterOptions {
  /** Your site token from the Specter dashboard */
  token: string
  /**
   * Base URL of your Specter API.
   * @default 'https://api.noir.app'
   */
  apiUrl?: string
  /**
   * How often (ms) to re-poll the kill state in the browser.
   * @default 30000
   */
  pollInterval?: number
  /**
   * Path to the service worker stub file on the user's domain.
   * @default '/specter-sw.js'
   */
  swPath?: string
}
