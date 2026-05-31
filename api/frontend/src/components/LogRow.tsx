import type { LogEntry } from '@/types'
import { LevelBadge } from '@/components/LevelBadge'
import { cn } from '@/lib/utils'

const CONTAINER_PALETTE = ['#79c0ff', '#56d364', '#ffa657', '#d2a8ff', '#ff7b72', '#3fb950']

const containerColor = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff
  return CONTAINER_PALETTE[Math.abs(hash) % CONTAINER_PALETTE.length]
}

const formatTs = (ts: string): string => {
  try {
    const d = new Date(ts)
    return (
      d.toLocaleTimeString('en-US', { hour12: false }) +
      '.' +
      String(d.getMilliseconds()).padStart(3, '0')
    )
  } catch {
    return ts.slice(11, 23)
  }
}

const ROW_BG: Record<string, string> = {
  error: 'bg-[#ff7b7b]/[0.06]',
  critical: 'bg-[#ff7b7b]/[0.06]',
  warning: 'bg-[#ffa657]/[0.05]',
  warn: 'bg-[#ffa657]/[0.05]',
}

export const LogRow = ({ entry }: { entry: LogEntry }) => {
  const level = entry.level.toLowerCase()
  return (
    <div
      className={cn(
        'flex gap-3 px-3 py-0.5 border-b border-border/40 items-start min-w-0 hover:bg-white/[0.02]',
        ROW_BG[level]
      )}
    >
      <span className="text-muted-foreground text-[11px] shrink-0 pt-px min-w-[10ch]">
        {formatTs(entry.ts)}
      </span>
      <span
        className="text-[11px] font-semibold shrink-0 pt-px min-w-[12ch] max-w-[20ch] truncate"
        style={{ color: containerColor(entry.container) }}
      >
        {entry.container}
      </span>
      <LevelBadge level={entry.level} />
      <span className="flex-1 min-w-0 break-words whitespace-pre-wrap text-foreground leading-snug">
        {entry.message}
      </span>
    </div>
  )
}
