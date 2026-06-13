import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, RefreshCw, RotateCcw, Server } from 'lucide-react';
import { Header } from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { useWorkerMonitorStore } from '@/store/useWorkerMonitorStore';
import { fetchServerHealth, restartContainer } from '@/api/infrastructure';
import type { ServiceStatus } from '@/api/health';
import type { MonitorPoint } from '@/api/worker-monitor';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ageFmt = (ts: number, now: number): string => {
  const sec = Math.floor(now / 1000 - ts);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
};

// Maps health-check service name → keyword to match against container names
const SERVICE_KEYWORDS: Record<string, string> = {
  'n8n': 'n8n',
  'PostgreSQL': 'postgres',
  'Redis': 'redis',
  'MinIO': 'minio',
  'media-api': 'media',
  'nginx': 'nginx',
  'Loki': 'loki',
  'Promtail': 'promtail',
};

const findContainer = (serviceName: string, containers: string[]): string | undefined => {
  const keyword = (SERVICE_KEYWORDS[serviceName] ?? serviceName).toLowerCase();
  const matches = containers.filter((c) => c.toLowerCase().includes(keyword));
  // prefer shortest match (avoids matching n8n-worker when looking for n8n)
  return matches.sort((a, b) => a.length - b.length)[0];
};

// ─── Groups ───────────────────────────────────────────────────────────────────

const GROUPS: { label: string; services: string[] }[] = [
  { label: 'Core', services: ['n8n', 'PostgreSQL', 'Redis', 'MinIO'] },
  { label: 'API', services: ['media-api', 'nginx'] },
  { label: 'Observability', services: ['Loki', 'Promtail'] },
];

// ─── Status dot ───────────────────────────────────────────────────────────────

const StatusDot = ({ up }: { up: boolean }) => (
  <span className="relative flex h-2.5 w-2.5 shrink-0">
    {up && (
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
    )}
    <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', up ? 'bg-green-400' : 'bg-destructive')} />
  </span>
);

// ─── Service card ─────────────────────────────────────────────────────────────

const ServiceCard = ({
  service,
  cpu,
  containerName,
  server,
}: {
  service: ServiceStatus;
  cpu?: number;
  containerName?: string;
  server: string;
}) => {
  const up = service.status === 'up';
  const [restartState, setRestartState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleRestart = async () => {
    if (!containerName) return;
    setRestartState('loading');
    try {
      await restartContainer(server, containerName);
      setRestartState('done');
      setTimeout(() => setRestartState('idle'), 3000);
    } catch {
      setRestartState('error');
      setTimeout(() => setRestartState('idle'), 3000);
    }
  };

  return (
    <div className={cn(
      'group bg-background/60 border border-l-[3px] rounded-xl p-4 flex flex-col gap-2',
      up ? 'border-border border-l-green-500/60' : 'border-border border-l-destructive/70',
    )}>
      {/* Name + restart icon + dot */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-semibold truncate">{service.name}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {containerName && (
            <button
              onClick={handleRestart}
              disabled={restartState === 'loading'}
              title={`Restart ${service.name}`}
              className={cn(
                'p-1.5 rounded transition-all',
                'opacity-0 group-hover:opacity-100',
                restartState === 'done' && '!opacity-100 text-green-400',
                restartState === 'error' && '!opacity-100 text-destructive',
                restartState === 'loading' && '!opacity-100 text-muted-foreground',
                restartState === 'idle' && 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {restartState === 'loading'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RotateCcw className="h-3.5 w-3.5" />}
            </button>
          )}
          <StatusDot up={up} />
        </div>
      </div>

      {/* Message + latency + cpu */}
      <div className="flex items-end justify-between gap-1">
        <p
          className="text-[11px] text-muted-foreground truncate leading-tight"
          title={service.message}
        >
          {service.message}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {cpu !== undefined && (
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70">
              {cpu.toFixed(1)}%
            </span>
          )}
          <span className={cn(
            'text-[10px] font-mono tabular-nums',
            up ? 'text-muted-foreground/70' : 'text-destructive',
          )}>
            {service.latency_ms}ms
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Extra container chip ─────────────────────────────────────────────────────

const ExtraContainerChip = ({ name, cpu, server }: { name: string; cpu?: number; server: string }) => {
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
    <div className="group flex items-center gap-2 bg-background/60 border border-border rounded-lg px-3 py-2">
      <span className="h-1.5 w-1.5 rounded-full bg-green-400/60 shrink-0" />
      <span className="font-mono text-xs truncate max-w-[160px]">{name}</span>
      {cpu !== undefined && (
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70">{cpu.toFixed(1)}%</span>
      )}
      <button
        onClick={handleRestart}
        disabled={state === 'loading'}
        title={`Restart ${name}`}
        className={cn(
          'p-1.5 rounded ml-auto opacity-0 group-hover:opacity-100 transition-all',
          state === 'done' && '!opacity-100 text-green-400',
          state === 'error' && '!opacity-100 text-destructive',
          state === 'loading' && '!opacity-100 text-muted-foreground',
          state === 'idle' && 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
      >
        {state === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

// ─── Service health section ───────────────────────────────────────────────────

const ServiceHealthSection = ({
  services,
  containers,
  containerCpu,
  server,
  onRefresh,
  refreshing,
}: {
  services: ServiceStatus[];
  containers: string[];
  containerCpu: Record<string, number>;
  server: string;
  onRefresh: () => void;
  refreshing: boolean;
}) => {
  const byName = Object.fromEntries(services.map((s) => [s.name, s]));
  const downCount = services.filter((s) => s.status === 'down').length;
  const allUp = services.length > 0 && downCount === 0;

  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.services.map((n) => byName[n]).filter(Boolean),
  })).filter((g) => g.items.length > 0);

  // Containers not matched to any health-checked service
  const matchedContainers = new Set(
    services.map((s) => findContainer(s.name, containers)).filter(Boolean),
  );
  const extraContainers = containers.filter((c) => !matchedContainers.has(c));

  return (
    <div className="px-5 py-4 border-t border-border/40">
      {/* Status banner */}
      <div className={cn(
        'rounded-xl border px-4 py-3 mb-4 flex items-center gap-2.5',
        allUp ? 'border-green-500/20 bg-green-500/5' : 'border-destructive/20 bg-destructive/5',
      )}>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh health status"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 shrink-0"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
        <StatusDot up={allUp} />
        <div>
          <p className={cn('text-xs font-semibold', allUp ? 'text-green-400' : 'text-destructive')}>
            {allUp ? 'All systems operational' : `${downCount} service${downCount > 1 ? 's' : ''} down`}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            {services.length} services · hover a card to restart
          </p>
        </div>
      </div>

      {/* Grouped service cards */}
      <div className="flex flex-col gap-4">
        {visibleGroups.map((group) => {
          const downInGroup = group.items.filter((s) => s.status === 'down').length;
          return (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/30 font-semibold">
                  {group.label}
                </p>
                {downInGroup > 0 && (
                  <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                    {downInGroup} down
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {group.items.map((s) => {
                  const containerName = findContainer(s.name, containers);
                  return (
                    <ServiceCard
                      key={s.name}
                      service={s}
                      cpu={containerName !== undefined ? containerCpu[containerName] : undefined}
                      containerName={containerName}
                      server={server}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Extra containers not in any health-check group */}
        {extraContainers.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/30 font-semibold mb-2">
              Other
            </p>
            <div className="flex flex-wrap gap-2">
              {extraContainers.map((c) => (
                <ExtraContainerChip
                  key={c}
                  name={c}
                  cpu={containerCpu[c]}
                  server={server}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Server section ────────────────────────────────────────────────────────────

interface ServerSectionProps {
  name: string;
  points: MonitorPoint[];
  health: ServiceStatus[];
  onHealthRefresh: () => void;
  healthRefreshing: boolean;
}

const ServerSection = ({ name, points, health, onHealthRefresh, healthRefreshing }: ServerSectionProps) => {
  const latest = points[points.length - 1];
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  if (!latest) return null;

  const ageSec = Math.floor(now / 1000 - latest.ts);
  const offline = ageSec > 90;
  const warn = ageSec > 60;
  const statusColor = offline ? 'bg-destructive' : warn ? 'bg-yellow-400' : 'bg-green-400';
  const hot = latest.cpu_effective >= latest.threshold;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header — click anywhere to collapse */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="p-1.5 rounded-lg bg-secondary shrink-0">
          <Server className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full shrink-0', statusColor)} />
            <span className="text-sm font-semibold text-foreground">{name}</span>
            {offline && <span className="text-[10px] text-destructive font-medium">OFFLINE</span>}
          </div>
          <p className="text-xs text-muted-foreground/50 mt-0.5">{ageFmt(latest.ts, now)}</p>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/50 mb-0.5">CPU</p>
            <p className={cn('text-lg font-bold tabular-nums leading-none', hot ? 'text-destructive' : 'text-primary')}>
              {latest.cpu_effective.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/50 mb-0.5">Active</p>
            <p className="text-lg font-bold tabular-nums leading-none text-green-400">{latest.active}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/50 mb-0.5">Gate</p>
            <p className="text-lg font-bold tabular-nums leading-none text-muted-foreground">{latest.threshold}%</p>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground/50 transition-transform', !expanded && '-rotate-90')} />
        </div>
      </button>

      {/* Service health + restart */}
      {expanded && health.length > 0 && (
        <ServiceHealthSection
          services={health}
          containers={latest.containers ?? []}
          containerCpu={latest.container_cpu ?? {}}
          server={name}
          onRefresh={onHealthRefresh}
          refreshing={healthRefreshing}
        />
      )}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

const InfrastructurePage = () => {
  const { servers, serverNames, loading, load } = useWorkerMonitorStore();
  const [asideOpen, setAsideOpen] = useState(false);
  const [serverHealth, setServerHealth] = useState<Record<string, ServiceStatus[]>>({});
  const [healthRefreshing, setHealthRefreshing] = useState<Record<string, boolean>>({});
  const navSections = useNavSections('infrastructure');
  const serverNamesRef = useRef<string[]>([]);
  useEffect(() => {
    serverNamesRef.current = serverNames;
  }, [serverNames]);

  const fetchAllHealth = useCallback(async (names: string[], silent = false) => {
    if (!names.length) return;
    if (!silent) setHealthRefreshing((prev) => ({ ...prev, ...Object.fromEntries(names.map((n) => [n, true])) }));
    const results = await Promise.allSettled(
      names.map(async (name) => {
        const services = await fetchServerHealth(name);
        return [name, services] as [string, ServiceStatus[]];
      }),
    );
    const map: Record<string, ServiceStatus[]> = {};
    for (const r of results) {
      if (r.status === 'fulfilled') map[r.value[0]] = r.value[1];
    }
    setServerHealth((prev) => ({ ...prev, ...map }));
    if (!silent) setHealthRefreshing((prev) => ({ ...prev, ...Object.fromEntries(names.map((n) => [n, false])) }));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (serverNames.length) fetchAllHealth(serverNames);
  }, [serverNames, fetchAllHealth]);

  useEffect(() => {
    const id = setInterval(() => {
      load();
      fetchAllHealth(serverNamesRef.current, true);
    }, 30_000);
    return () => clearInterval(id);
  }, [load, fetchAllHealth]);

  const orderedNames = [...serverNames].sort((a, b) =>
    a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b),
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header title="Infrastructure" />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />
        <main className="flex-1 overflow-y-auto px-10 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure</h1>
            <p className="text-sm text-muted-foreground mt-1">Per-server health, containers, and remote actions.</p>
          </div>

          <div className="flex flex-col gap-5">
            {loading && orderedNames.length === 0 ? (
              <div className="py-16 text-center">
                <Loader2 className="h-6 w-6 text-muted-foreground/30 mx-auto mb-3 animate-spin" />
              </div>
            ) : orderedNames.length === 0 ? (
              <div className="py-16 text-center">
                <Server className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No servers reporting yet.</p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  Worker monitor data appears here once a node comes online.
                </p>
              </div>
            ) : (
              orderedNames.map((name) => (
                <ServerSection
                  key={name}
                  name={name}
                  points={servers[name] ?? []}
                  health={serverHealth[name] ?? []}
                  onHealthRefresh={() => fetchAllHealth([name])}
                  healthRefreshing={healthRefreshing[name] ?? false}
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default InfrastructurePage;
