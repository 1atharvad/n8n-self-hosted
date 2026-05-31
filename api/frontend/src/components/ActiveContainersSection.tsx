import { useMemo } from 'react';
import type { MonitorPoint } from '@/api/worker-monitor';

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
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Active containers</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {fromDocker ? 'Running Docker containers with live CPU' : 'Services with log activity in Loki'}
        </p>
      </div>

      <div className="px-6 py-4">
        {loading && !fromDocker ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : runningContainers && runningContainers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {runningContainers.map((name) => {
              const cpu = latest?.container_cpu?.[name];
              return (
                <span
                  key={name}
                  className="font-mono text-xs px-2 py-1 rounded bg-secondary text-foreground border border-border flex items-center gap-1.5"
                >
                  <span>{name}</span>
                  {cpu !== undefined && (
                    <span className="text-muted-foreground">{cpu.toFixed(1)}%</span>
                  )}
                </span>
              );
            })}
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
    </section>
  );
};
