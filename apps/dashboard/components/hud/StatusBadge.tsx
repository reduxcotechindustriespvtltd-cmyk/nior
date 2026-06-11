'use client'

type Status = 'live' | 'dead' | 'idle'

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const config = {
    live: { text: label ?? 'LIVE', class: 'status-badge-live' },
    dead: { text: label ?? 'KILLED', class: 'status-badge-dead' },
    idle: { text: label ?? 'IDLE', class: 'status-badge-idle' },
  }[status]

  return (
    <span className={`status-badge ${config.class}`}>
      <span className="status-badge-dot" />
      {config.text}
    </span>
  )
}
