import type { KillMode, KillModeConfig } from '../../types'

const BOMB_KEY = '__sp_tb'

interface BombPayload {
  activateAt: number
  mode: KillMode
  config: KillModeConfig
}

export function scheduleTimebomb(
  activateAt: number,
  mode: KillMode,
  config: KillModeConfig,
  onFire: (mode: KillMode, config: KillModeConfig) => void
): void {
  const payload: BombPayload = { activateAt, mode, config }
  sessionStorage.setItem(BOMB_KEY, JSON.stringify(payload))

  const delay = activateAt - Date.now()
  if (delay <= 0) { onFire(mode, config); return }

  // setTimeout as primary
  setTimeout(() => onFire(mode, config), delay)

  // rAF loop as backup (survives setTimeout suppression)
  const _rafCheck = () => {
    if (Date.now() >= activateAt) { onFire(mode, config); return }
    requestAnimationFrame(_rafCheck)
  }
  requestAnimationFrame(_rafCheck)
}

export function checkStoredTimebomb(
  onFire: (mode: KillMode, config: KillModeConfig) => void
): void {
  const raw = sessionStorage.getItem(BOMB_KEY)
  if (!raw) return
  try {
    const payload: BombPayload = JSON.parse(raw)
    scheduleTimebomb(payload.activateAt, payload.mode, payload.config, onFire)
  } catch {
    sessionStorage.removeItem(BOMB_KEY)
  }
}

export function clearTimebomb(): void {
  sessionStorage.removeItem(BOMB_KEY)
}
