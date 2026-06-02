import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { Header } from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { AlertCircle, Zap, ChevronDown, GitBranch, CheckCircle2, XCircle, Activity, X, Clock3 } from 'lucide-react';
import { BentoStatCard } from '@/components/BentoStatCard';
import { cn } from '@/lib/utils';
import type { WorkflowExecution, FolderDailyRaw, N8nWorkflow } from '@/api/n8n';
import { fetchRunningWorkflows, fetchWorkflowExecutions, fetchFolderDailyExecutions } from '@/api/n8n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  success:  'text-green-500',
  error:    'text-red-400',
  crashed:  'text-red-400',
  running:  'text-blue-400',
  waiting:  'text-amber-400',
  canceled: 'text-muted-foreground',
};

const STATUS_LABEL: Record<string, string> = {
  success: 'Success', error: 'Error', crashed: 'Crashed',
  running: 'Running', waiting: 'Waiting', canceled: 'Canceled',
};

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const fmtDuration = (ms: number | null): string => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
};

const fmtExecDate = (iso: string): string =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });


const LINE_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

type FolderDayPoint = Record<string, number | string>;

const buildFolderChartData = (
  raw: FolderDailyRaw[],
  workflows: N8nWorkflow[],
  numDays: number,
  granularity: 'hour' | 'day',
): FolderDayPoint[] => {
  const buckets: string[] = [];
  const now = new Date();
  if (granularity === 'hour') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() - i);
      buckets.push(d.toISOString().slice(0, 13));
    }
  } else {
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push(d.toISOString().slice(0, 10));
    }
  }
  const lookup: Record<string, Record<string, number>> = {};
  for (const row of raw) {
    const key = row.bucket.slice(0, granularity === 'hour' ? 13 : 10);
    lookup[key] ??= {};
    lookup[key][row.workflowName] = row.runs;
  }
  return buckets.map((bucket) => {
    const point: FolderDayPoint = { bucket };
    for (const wf of workflows) {
      point[wf.name] = lookup[bucket]?.[wf.name] ?? 0;
    }
    return point;
  });
};

const fmtBucket = (bucket: string, granularity: 'hour' | 'day'): string => {
  if (granularity === 'hour') {
    return new Date(bucket + ':00:00Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const [y, m, d] = bucket.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const execColor = (status: string): string => {
  if (status === 'success') return '#22c55e';
  if (status === 'error' || status === 'crashed') return '#ef4444';
  return '#94a3b8';
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ProjectSummary = ({ workflows, loading }: { workflows: N8nWorkflow[]; loading: boolean }) => {
  const active = workflows.filter((w) => w.active).length;
  const runs24h = workflows.reduce((s, w) => s + w.runs24h, 0);
  const errors24h = workflows.reduce((s, w) => s + w.errors24h, 0);
  const successRate = runs24h > 0 ? `${Math.round(((runs24h - errors24h) / runs24h) * 100)}%` : '—';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <BentoStatCard
        label="Active workflows"
        value={`${active} / ${workflows.length}`}
        icon={<GitBranch className="h-4 w-4" />}
        accent="border-t-violet-500"
        iconBg="bg-violet-500/10"
        iconColor="text-violet-500"
        loading={loading}
      />
      <BentoStatCard
        label="Runs (24h)"
        value={runs24h}
        icon={<Activity className="h-4 w-4" />}
        accent="border-t-blue-500"
        iconBg="bg-blue-500/10"
        iconColor="text-blue-400"
        loading={loading}
      />
      <BentoStatCard
        label="Errors (24h)"
        value={errors24h}
        icon={<XCircle className="h-4 w-4" />}
        accent="border-t-red-500"
        iconBg="bg-red-500/10"
        iconColor="text-red-400"
        loading={loading}
      />
      <BentoStatCard
        label="Success rate (24h)"
        value={successRate}
        icon={<CheckCircle2 className="h-4 w-4" />}
        accent="border-t-green-500"
        iconBg="bg-green-500/10"
        iconColor="text-green-500"
        loading={loading}
      />
    </div>
  );
};

const RANGE_OPTIONS = [
  { label: '24h', days: 1 },
  { label: '7d',  days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
];

const FolderLineChart = ({
  workflows,
  workflowIds,
}: {
  workflows: N8nWorkflow[];
  workflowIds: string[];
}) => {
  const [days, setDays] = useState(14);
  const [granularity, setGranularity] = useState<'hour' | 'day'>('day');
  const [data, setData] = useState<FolderDayPoint[] | null | 'loading'>('loading');
  const idsKey = workflowIds.join(',');

  useEffect(() => {
    setData('loading');
    fetchFolderDailyExecutions(workflowIds, days)
      .then(({ data: raw, granularity: g }) => {
        setGranularity(g);
        setData(buildFolderChartData(raw, workflows, days, g));
      })
      .catch(() => setData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, idsKey]);

  const hasData = Array.isArray(data) && data.some((d) => workflows.some((wf) => (d[wf.name] as number) > 0));

  return (
    <div className="px-5 pt-4 pb-4 border-b border-border/60">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Runs per workflow</p>
        <div className="flex items-center gap-0.5 bg-secondary/60 rounded-lg p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors',
                days === opt.days
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {data === 'loading' && (
        <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">Loading…</div>
      )}
      {data === null && (
        <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">Failed to load data.</div>
      )}
      {Array.isArray(data) && !hasData && (
        <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">No executions in this period.</div>
      )}
      {hasData && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="bucket"
              tickFormatter={(v: string) => fmtBucket(v, granularity)}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
              labelFormatter={(v) => fmtBucket(String(v ?? ''), granularity)}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
            {workflows.map((wf, i) => (
              <Line
                key={wf.id}
                type="monotone"
                dataKey={wf.name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

const WorkflowChart = ({
  data,
}: {
  data: WorkflowExecution[] | null | 'loading' | undefined;
}) => {
  if (data === 'loading' || data === undefined) {
    return <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">Loading chart…</div>;
  }
  if (data === null) {
    return <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">Failed to load execution data.</div>;
  }
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">No executions recorded yet.</div>;
  }

  const chartData = data.map((e) => ({ ...e, durationSec: +(e.durationMs / 1000).toFixed(2) }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} barCategoryGap="20%" margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="startedAt"
          tickFormatter={fmtExecDate}
          tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => `${v}s`}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 2 }}
          itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
          labelFormatter={(iso) => `Ran at ${fmtExecDate(String(iso ?? ''))}`}
          formatter={(value, _name, props: { payload?: WorkflowExecution & { durationSec: number } }) => [
            `${value ?? 0}s — ${props.payload?.status ?? ''}`,
            'Duration',
          ]}
        />
        <Bar dataKey="durationSec" radius={[3, 3, 0, 0]} maxBarSize={24}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={execColor(entry.status)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const TABLE_COLS = 7;

const TABLE_HEADER = (
  <thead>
    <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
      <th className="px-5 py-2 text-left font-semibold w-[260px]">Name</th>
      <th className="px-4 py-2 text-left font-semibold">Last run</th>
      <th className="px-4 py-2 text-left font-semibold">Result</th>
      <th className="px-4 py-2 text-left font-semibold">Duration</th>
      <th className="px-4 py-2 text-right font-semibold">24h runs</th>
      <th className="px-4 py-2 text-right font-semibold">24h errors</th>
      <th className="px-3 py-2 w-6" />
    </tr>
  </thead>
);

interface ExecutionHistoryModalProps {
  wfName: string;
  executions: WorkflowExecution[];
  onClose: () => void;
}

const ExecutionHistoryModal = ({ wfName, executions, onClose }: ExecutionHistoryModalProps) => {
  const sorted = [...executions].reverse();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card border border-border rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Execution History</p>
            <h2 className="text-base font-bold text-foreground">{wfName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">No executions recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground sticky top-0 bg-card">
                  <th className="px-6 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Started at</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((exec, i) => {
                  const color = STATUS_COLOR[exec.status] ?? 'text-muted-foreground';
                  const label = STATUS_LABEL[exec.status] ?? exec.status;
                  return (
                    <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-2.5 text-xs tabular-nums text-muted-foreground">{sorted.length - i}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock3 className="h-3 w-3 shrink-0" />
                          {fmtDate(exec.startedAt)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={cn('font-medium', color)}>{label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-right text-muted-foreground">
                        {fmtDuration(exec.durationMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-3 border-t border-border shrink-0 text-[10px] text-muted-foreground">
          Showing last {sorted.length} executions
        </div>
      </div>
    </div>
  );
};

interface WorkflowRowProps {
  wf: N8nWorkflow;
  running: boolean;
  expanded: boolean;
  onToggle: () => void;
  chartData: WorkflowExecution[] | null | 'loading' | undefined;
  onOpenHistory: (wf: N8nWorkflow, executions: WorkflowExecution[]) => void;
}

const WorkflowRow = ({ wf, running, expanded, onToggle, chartData, onOpenHistory }: WorkflowRowProps) => {
  const statusColor = STATUS_COLOR[wf.lastStatus ?? ''];
  const statusLabel = STATUS_LABEL[wf.lastStatus ?? ''];

  return (
    <>
      <tr
        className={cn(
          'border-b border-border/60 cursor-pointer select-none transition-colors',
          'hover:bg-secondary/30',
          expanded && 'bg-secondary/20',
        )}
        onClick={onToggle}
      >
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-2.5 max-w-[240px]">
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', wf.active ? 'bg-green-500' : 'bg-muted-foreground/30')} />
            <span className="truncate text-sm font-medium">{wf.name}</span>
            {running && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" title="Running" />}
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(wf.lastRunAt)}</td>
        <td className="px-4 py-2.5 text-xs">
          {statusLabel
            ? <span className={cn('font-medium', statusColor)}>{statusLabel}</span>
            : <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">{fmtDuration(wf.lastDurationMs)}</td>
        <td className="px-4 py-2.5 text-xs tabular-nums text-right text-muted-foreground">{wf.runs24h || '—'}</td>
        <td className="px-4 py-2.5 text-xs tabular-nums text-right">
          {wf.errors24h > 0
            ? <span className="text-red-400 font-medium">{wf.errors24h}</span>
            : <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-3 py-2.5">
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200', expanded && 'rotate-180')} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/60 bg-secondary/10">
          <td colSpan={TABLE_COLS} className="px-5 pt-3 pb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Execution duration — last 50 runs
              </p>
              {Array.isArray(chartData) && chartData.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenHistory(wf, chartData); }}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  View history
                </button>
              )}
            </div>
            <div className="w-full">
              <WorkflowChart data={chartData} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

interface FolderHeaderProps {
  name: string;
  items: N8nWorkflow[];
  collapsed: boolean;
  onToggle: () => void;
}

const FolderHeader = ({ name, items, collapsed, onToggle }: FolderHeaderProps) => {
  const runs24h = items.reduce((s, w) => s + w.runs24h, 0);
  const errors24h = items.reduce((s, w) => s + w.errors24h, 0);
  const active = items.filter((w) => w.active).length;
  const successRate = runs24h > 0 ? Math.round(((runs24h - errors24h) / runs24h) * 100) : null;

  return (
    <div
      className={cn(
        'px-8 pt-6 pb-6 flex flex-col gap-5 cursor-pointer select-none hover:bg-secondary/20 transition-colors',
        !collapsed && 'border-b border-border/60',
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground/50 transition-transform duration-200 shrink-0', collapsed && '-rotate-90')} />
        <span className="text-lg font-bold tracking-tight text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground font-medium">{items.length} workflow{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-8 pl-7">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Active</p>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {active}<span className="text-sm font-normal text-muted-foreground ml-1">/ {items.length}</span>
          </p>
        </div>
        <div className="w-px h-9 bg-border/60" />
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Runs (24h)</p>
          <p className="text-2xl font-bold tabular-nums leading-none">{runs24h || <span className="text-muted-foreground">—</span>}</p>
        </div>
        <div className="w-px h-9 bg-border/60" />
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Errors (24h)</p>
          <p className={cn('text-2xl font-bold tabular-nums leading-none', errors24h > 0 ? 'text-red-400' : 'text-muted-foreground')}>
            {errors24h || '—'}
          </p>
        </div>
        <div className="w-px h-9 bg-border/60" />
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Success rate</p>
          <p className={cn('text-2xl font-bold tabular-nums leading-none',
            successRate === null ? 'text-muted-foreground' :
            successRate === 100 ? 'text-green-500' :
            successRate >= 80   ? 'text-amber-400' : 'text-red-400',
          )}>
            {successRate !== null ? `${successRate}%` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type ChartCache = Record<string, WorkflowExecution[] | null | 'loading'>;

const WorkflowsPage = () => {
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('workflows');
  const { workflows, apiError, loading, error, load } = useWorkflowStore();
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [chartCache, setChartCache] = useState<ChartCache>({});
  const [historyState, setHistoryState] = useState<{ wf: N8nWorkflow; executions: WorkflowExecution[] } | null>(null);
  const requested = useRef<Set<string>>(new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const poll = () => fetchRunningWorkflows().then(setRunningIds).catch(() => {});
    poll();
    const id = setInterval(poll, 5_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    expandedIds.forEach((id) => {
      if (requested.current.has(id)) return;
      requested.current.add(id);
      setChartCache((prev) => ({ ...prev, [id]: 'loading' }));
      fetchWorkflowExecutions(id)
        .then((data) => setChartCache((prev) => ({ ...prev, [id]: data })))
        .catch(() => setChartCache((prev) => ({ ...prev, [id]: null })));
    });
  }, [expandedIds]);

  const toggleRow = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const toggleFolder = useCallback((key: string) => {
    setExpandedFolder((prev) => (prev === key ? null : key));
  }, []);

  const grouped = new Map<string, N8nWorkflow[]>();
  for (const wf of workflows) {
    const key = wf.folderName ?? '';
    grouped.set(key, [...(grouped.get(key) ?? []), wf]);
  }
  const general = grouped.get('') ?? [];
  const folders = [...grouped.entries()].filter(([k]) => k !== '').sort(([a], [b]) => a.localeCompare(b));

  const openHistory = useCallback((wf: N8nWorkflow, executions: WorkflowExecution[]) => {
    setHistoryState({ wf, executions });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {historyState && (
        <ExecutionHistoryModal
          wfName={historyState.wf.name}
          executions={historyState.executions}
          onClose={() => setHistoryState(null)}
        />
      )}
      <Header title="Workflows" />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />
        <main className="flex-1 overflow-y-auto px-10 py-8">

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          <div className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor n8n workflow health and execution trends.</p>
          </div>

          {apiError && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Zap className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Failed to load workflows</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{apiError}</p>
            </div>
          )}

          {!apiError && (
            <>
              <ProjectSummary workflows={workflows} loading={loading && workflows.length === 0} />

              <div className="flex flex-col gap-5">
                {loading && workflows.length === 0 && (
                  <div className="bg-card border border-border rounded-2xl px-6 py-10 text-center text-xs text-muted-foreground">Loading…</div>
                )}

                {folders.map(([name, items]) => {
                  const expanded = expandedFolder === name;
                  const ids = items.map((w) => w.id);
                  return (
                    <div key={name} className="bg-card border border-border rounded-2xl overflow-hidden">
                      <FolderHeader name={name} items={items} collapsed={!expanded} onToggle={() => toggleFolder(name)} />
                      {expanded && (
                        <>
                          <FolderLineChart workflows={items} workflowIds={ids} />
                          <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            {TABLE_HEADER}
                            <tbody>
                              {items.map((wf) => (
                                <WorkflowRow
                                  key={wf.id}
                                  wf={wf}
                                  running={runningIds.has(wf.id)}
                                  expanded={expandedIds.has(wf.id)}
                                  onToggle={() => toggleRow(wf.id)}
                                  onOpenHistory={openHistory}
                                  chartData={chartCache[wf.id]}
                                />
                              ))}
                            </tbody>
                          </table>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {general.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <FolderHeader name="General" items={general} collapsed={expandedFolder !== '__general__'} onToggle={() => toggleFolder('__general__')} />
                    {expandedFolder === '__general__' && (
                      <>
                        <FolderLineChart workflows={general} workflowIds={general.map((w) => w.id)} />
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          {TABLE_HEADER}
                          <tbody>
                            {general.map((wf) => (
                              <WorkflowRow
                                key={wf.id}
                                wf={wf}
                                running={runningIds.has(wf.id)}
                                expanded={expandedIds.has(wf.id)}
                                onToggle={() => toggleRow(wf.id)}
                                onOpenHistory={openHistory}
                                chartData={chartCache[wf.id]}
                              />
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!loading && workflows.length === 0 && (
                  <div className="bg-card border border-border rounded-2xl px-6 py-10 text-center text-xs text-muted-foreground">No workflows found.</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default WorkflowsPage;
