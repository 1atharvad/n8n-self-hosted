import type { MonitorPoint } from '@/api/worker-monitor';
import { cn } from '@/lib/utils';

interface ServerHealthCardsProps {
  servers: Record<string, MonitorPoint[]>;
  selectedServer: string | null;
  onSelect: (name: string) => void;
}

const ageFmt = (ts: number): string => {
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
};

export const ServerHealthCards = ({ servers, selectedServer, onSelect }: ServerHealthCardsProps) => {
  const names = Object.keys(servers).sort();
  if (names.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {names.map((name) => {
        const points = servers[name];
        const latest = points[points.length - 1];
        if (!latest) return null;

        const ageSec = Date.now() / 1000 - latest.ts;
        const stale = ageSec > 90;
        const warn = ageSec > 60;
        const hot = latest.cpu_effective >= latest.threshold;
        const isSelected = name === selectedServer;

        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className={cn(
              'text-left bg-card border rounded-lg px-4 py-3 transition-colors hover:border-primary/60',
              isSelected ? 'border-primary' : 'border-border',
              stale && 'border-destructive/50',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium truncate max-w-[75%]">{name}</span>
              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  stale ? 'bg-destructive' : warn ? 'bg-yellow-400' : 'bg-green-400',
                )}
              />
            </div>

            <div className="flex gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground">CPU</p>
                <p className={cn('text-base font-semibold tabular-nums', hot ? 'text-destructive' : 'text-primary')}>
                  {latest.cpu_effective.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Active</p>
                <p className="text-base font-semibold tabular-nums text-green-400">{latest.active}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Gate</p>
                <p className="text-base font-semibold tabular-nums text-muted-foreground">{latest.threshold}%</p>
              </div>
            </div>

            <p className={cn('text-[10px] mt-2', stale ? 'text-destructive' : 'text-muted-foreground')}>
              {stale ? 'offline · ' : ''}{ageFmt(latest.ts)}
            </p>
          </button>
        );
      })}
    </div>
  );
};
