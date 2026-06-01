import { useMemo } from 'react';
import type { MonitorPoint } from '@/api/worker-monitor';
import { Boxes } from 'lucide-react';

interface ActiveContainersSectionProps {
  metrics: MonitorPoint[];
  fallbackContainers: string[];
  loading: boolean;
}

export const ActiveContainersSection = ({
  metrics,
  fallbackContainers,
  loading,
}: ActiveContainersSectionProps) => {
  const latest = metrics[metrics.length - 1];

  const runningContainers = useMemo(() => {
    if (!latest?.containers?.length) return null;
    const cpuMap = latest.container_cpu ?? {};
    return [...latest.containers]
      .sort((a, b) => (cpuMap[b] ?? -1) - (cpuMap[a] ?? -1));
  }, [latest]);

  const fromDocker = runningContainers !== null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-secondary">
          <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Active containers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fromDocker ? 'Running Docker containers with live CPU' : 'Services with log activity in Loki'}
          </p>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading && !fromDocker ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : runningContainers && runningContainers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {runningContainers.map((name) => {
              const cpu = latest?.container_cpu?.[name];
              return (
                <span
                  key={name}
                  className="font-mono text-xs px-3 py-1.5 rounded-xl bg-secondary text-foreground border border-border flex items-center gap-2"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                  <span>{name}</span>
                  {cpu !== undefined && (
                    <span className="text-muted-foreground">{cpu.toFixed(1)}%</span>
                  )}
                </span>
              );
            })}
          </div>
        ) : fallbackContainers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {fallbackContainers.map((c) => (
              <span
                key={c}
                className="font-mono text-xs px-3 py-1.5 rounded-xl bg-secondary text-foreground border border-border flex items-center gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground/30 shrink-0" />
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No containers found.</p>
        )}
      </div>
    </div>
  );
};
