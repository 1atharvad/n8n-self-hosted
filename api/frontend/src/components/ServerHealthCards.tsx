import type { MonitorPoint } from '@/api/worker-monitor';
import { cn } from '@/lib/utils';
import { Server } from 'lucide-react';

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {names.map((name) => {
        const points = servers[name];
        const latest = points[points.length - 1];
        if (!latest) return null;

        const ageSec = Date.now() / 1000 - latest.ts;
        const stale = ageSec > 90;
        const warn = ageSec > 60;
        const hot = latest.cpu_effective >= latest.threshold;
        const isSelected = name === selectedServer;

        const accentBorder = stale
          ? 'border-t-destructive'
          : warn
          ? 'border-t-yellow-400'
          : 'border-t-green-400';

        const statusDot = stale
          ? 'bg-destructive'
          : warn
          ? 'bg-yellow-400'
          : 'bg-green-400';

        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className={cn(
              'text-left bg-card border border-t-2 rounded-2xl px-6 py-6 flex flex-col gap-5 transition-colors hover:border-primary/60',
              accentBorder,
              isSelected ? 'border-primary' : 'border-border',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-lg bg-secondary shrink-0">
                  <Server className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium truncate">{name}</span>
              </div>
              <span className={cn('h-2 w-2 rounded-full shrink-0', statusDot)} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">CPU</p>
                <p className={cn('text-2xl font-bold tabular-nums leading-none', hot ? 'text-destructive' : 'text-primary')}>
                  {latest.cpu_effective.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Active</p>
                <p className="text-2xl font-bold tabular-nums leading-none text-green-400">{latest.active}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Gate</p>
                <p className="text-2xl font-bold tabular-nums leading-none text-muted-foreground">{latest.threshold}%</p>
              </div>
            </div>

            <p className={cn('text-[10px]', stale ? 'text-destructive' : 'text-muted-foreground')}>
              {stale ? 'offline · ' : ''}{ageFmt(latest.ts)}
            </p>
          </button>
        );
      })}
    </div>
  );
};
