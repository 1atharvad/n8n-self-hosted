import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { AutoscalerPoint } from '@/api/autoscaler';

interface ScaleEvent {
  ts: number;
  from: number;
  to: number;
}

interface ActiveContainersSectionProps {
  metrics: AutoscalerPoint[];
  fallbackContainers: string[];
  loading: boolean;
}

const fmt = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const ActiveContainersSection = ({
  metrics,
  fallbackContainers,
  loading,
}: ActiveContainersSectionProps) => {
  const latest = metrics[metrics.length - 1];

  const runningContainers = useMemo(() => {
    if (!latest?.container_cpu) return null;
    return Object.entries(latest.container_cpu).sort((a, b) => b[1] - a[1]);
  }, [latest]);

  const scaleEvents = useMemo((): ScaleEvent[] => {
    const events: ScaleEvent[] = [];
    for (let i = 1; i < metrics.length; i++) {
      const prev = metrics[i - 1];
      const curr = metrics[i];
      if (curr.workers !== prev.workers) {
        events.push({ ts: curr.ts, from: prev.workers, to: curr.workers });
      }
    }
    return events.slice(-8).reverse();
  }, [metrics]);

  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Active containers</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {runningContainers ? 'Running Docker containers with live CPU' : 'Services with log activity in Loki'}
        </p>
      </div>

      <div className="px-6 py-4">
        {loading && !runningContainers ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : runningContainers && runningContainers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {runningContainers.map(([name, cpu]) => (
              <span
                key={name}
                className="font-mono text-xs px-2 py-1 rounded bg-secondary text-foreground border border-border flex items-center gap-1.5"
              >
                <span>{name}</span>
                <span className="text-muted-foreground">{cpu.toFixed(1)}%</span>
              </span>
            ))}
          </div>
        ) : fallbackContainers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {fallbackContainers.map((c) => (
              <span
                key={c}
                className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground border border-border"
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No containers found.</p>
        )}
      </div>

      {scaleEvents.length > 0 && (
        <div className="border-t border-border px-6 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent scale events</p>
          <div className="flex flex-col gap-1.5">
            {scaleEvents.map((e, i) => {
              const up = e.to > e.from;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {up ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  )}
                  <span className={up ? 'text-green-400' : 'text-yellow-400'}>
                    {up ? 'Scale up' : 'Scale down'}
                  </span>
                  <span className="text-muted-foreground">{e.from} → {e.to} workers</span>
                  <span className="text-muted-foreground ml-auto tabular-nums">{fmt(e.ts)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
