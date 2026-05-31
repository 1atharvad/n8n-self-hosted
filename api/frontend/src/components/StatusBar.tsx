import { useLogStore } from '@/store/useLogStore';
import { cn } from '@/lib/utils';

const TIME_LABELS: Record<string, string> = {
  '15m': 'Last 15 min',
  '1h': 'Last 1 hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
};

export function StatusBar() {
  const paused = useLogStore((s) => s.paused);
  const streamConnected = useLogStore((s) => s.streamConnected);
  const filters = useLogStore((s) => s.filters);

  const streamStatus = paused ? '⏸ Paused' : streamConnected ? '● Streaming' : '○ Connecting…';
  const streamColor = paused ? 'text-muted-foreground' : streamConnected ? 'text-[#3fb950]' : 'text-yellow-400';

  return (
    <div className="flex flex-wrap items-center gap-4 px-3.5 py-1.5 bg-card border-t border-border text-[11px] text-muted-foreground shrink-0">
      <span className={cn(streamColor)}>{streamStatus}</span>
      {filters.search && (
        <span>Search: <strong className="text-foreground">{filters.search}</strong></span>
      )}
      {filters.containers.length > 0 && <span>{filters.containers.join(', ')}</span>}
      <span className="ml-auto">History: {TIME_LABELS[filters.range]}</span>
    </div>
  );
}
