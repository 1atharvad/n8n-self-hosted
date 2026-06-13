import { useState } from 'react';
import { Boxes, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { restartContainer } from '@/api/infrastructure';

interface ContainerRowProps {
  name: string;
  cpu?: number;
  server: string;
}

const ContainerRow = ({ name, cpu, server }: ContainerRowProps) => {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleRestart = async () => {
    setState('loading');
    try {
      await restartContainer(server, name);
      setState('done');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border/40 last:border-b-0 group">
      <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
      <span className="font-mono text-xs text-foreground flex-1 truncate">{name}</span>
      {cpu !== undefined && (
        <span className="text-xs font-mono tabular-nums text-muted-foreground/50 shrink-0 w-14 text-right">
          {cpu.toFixed(1)}%
        </span>
      )}
      <button
        onClick={handleRestart}
        disabled={state === 'loading'}
        title={`Restart ${name}`}
        className={cn(
          'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100',
          state === 'done' && 'opacity-100 text-green-400',
          state === 'error' && 'opacity-100 text-destructive',
          state === 'idle' && 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          state === 'loading' && 'opacity-100 text-muted-foreground',
        )}
      >
        {state === 'loading'
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <RotateCcw className="h-3 w-3" />
        }
        {state === 'done' ? 'Restarted' : state === 'error' ? 'Failed' : 'Restart'}
      </button>
    </div>
  );
};

interface ActiveContainersSectionProps {
  metrics: import('@/api/worker-monitor').MonitorPoint[];
  fallbackContainers: string[];
  loading: boolean;
  serverName: string;
}

export const ActiveContainersSection = ({
  metrics,
  fallbackContainers,
  loading,
  serverName,
}: ActiveContainersSectionProps) => {
  const latest = metrics[metrics.length - 1];

  const containers: { name: string; cpu?: number }[] = (() => {
    if (latest?.containers?.length) {
      const cpuMap = latest.container_cpu ?? {};
      return [...latest.containers]
        .sort((a, b) => (cpuMap[b] ?? -1) - (cpuMap[a] ?? -1))
        .map((name) => ({ name, cpu: cpuMap[name] }));
    }
    if (fallbackContainers.length) {
      return fallbackContainers.map((name) => ({ name }));
    }
    return [];
  })();

  const fromDocker = Boolean(latest?.containers?.length);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-secondary">
          <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Active containers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fromDocker ? 'Running Docker containers · hover to restart' : 'Services with log activity in Loki'}
          </p>
        </div>
      </div>

      <div className="py-1">
        {loading && !containers.length ? (
          <p className="px-6 py-4 text-xs text-muted-foreground">Loading…</p>
        ) : containers.length > 0 ? (
          containers.map(({ name, cpu }) => (
            <ContainerRow key={name} name={name} cpu={cpu} server={serverName} />
          ))
        ) : (
          <p className="px-6 py-4 text-xs text-muted-foreground italic">No containers found.</p>
        )}
      </div>
    </div>
  );
};
