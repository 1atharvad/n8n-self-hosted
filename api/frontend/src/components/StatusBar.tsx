import { useLogStore } from '@/store/useLogStore'
import { cn } from '@/lib/utils'

const TIME_LABELS: Record<string, string> = {
  '15m': 'Last 15 min',
  '1h': 'Last 1 hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
}

export function StatusBar() {
  const paused = useLogStore((s) => s.paused)
  const filters = useLogStore((s) => s.filters)

  return (
    <div className="flex flex-wrap items-center gap-4 px-3.5 py-1.5 bg-card border-t border-border text-[11px] text-muted-foreground shrink-0">
      <span className={cn(paused ? 'text-muted-foreground' : 'text-[#3fb950]')}>
        {paused ? '⏸ Paused' : '● Live'}
      </span>
      {filters.search && (
        <span>
          Search: <strong className="text-foreground">{filters.search}</strong>
        </span>
      )}
      {filters.containers.length > 0 && <span>{filters.containers.join(', ')}</span>}
      <span className="ml-auto">Refresh every 5s · {TIME_LABELS[filters.range]}</span>
    </div>
  )
}
