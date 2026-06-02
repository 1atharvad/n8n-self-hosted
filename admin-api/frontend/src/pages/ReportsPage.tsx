import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ShieldCheck, GitBranch, FileDown, Braces, Clock3, User, Zap, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { BentoStatCard } from '@/components/BentoStatCard';
import { cn } from '@/lib/utils';
import { fetchAuditLog, fetchN8nWorkflows, fetchN8nStats } from '@/api/n8n';
import type { AuditEntry, N8nWorkflow, N8nStats } from '@/api/n8n';

type Tab = 'audit' | 'execution';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const csvEscape = (v: string | number | boolean | null | undefined): string => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadAuditCsv = (logs: AuditEntry[]) => {
  const header = ['Time', 'Actor', 'Action', 'Target', 'IP', 'Detail'];
  const rows = logs.map((l) =>
    [l.created_at, l.actor_name, l.action, l.target_name, l.ip_address, l.detail].map(csvEscape).join(',')
  );
  triggerDownload(
    new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' }),
    `audit-report-${new Date().toISOString().slice(0, 10)}.csv`
  );
};

const downloadAuditJson = (logs: AuditEntry[]) =>
  triggerDownload(
    new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }),
    `audit-report-${new Date().toISOString().slice(0, 10)}.json`
  );

const downloadExecCsv = (workflows: N8nWorkflow[]) => {
  const header = ['Workflow', 'Active', 'Total Runs', 'Successes', 'Errors', 'Runs 24h', 'Errors 24h', 'Last Run', 'Last Status'];
  const rows = workflows.map((w) =>
    [w.name, w.active, w.totalRuns, w.successes, w.errors, w.runs24h, w.errors24h, w.lastRunAt ?? '', w.lastStatus ?? '']
      .map(csvEscape).join(',')
  );
  triggerDownload(
    new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' }),
    `execution-report-${new Date().toISOString().slice(0, 10)}.csv`
  );
};

const downloadExecJson = (workflows: N8nWorkflow[]) =>
  triggerDownload(
    new Blob([JSON.stringify(workflows, null, 2)], { type: 'application/json' }),
    `execution-report-${new Date().toISOString().slice(0, 10)}.json`
  );

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const ACTION_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '11px',
};

// ---------------------------------------------------------------------------
// Export dropdown (reused in both tabs)
// ---------------------------------------------------------------------------

interface ExportMenuProps {
  disabled: boolean;
  onCsv: () => void;
  onJson: () => void;
}

const ExportMenu = ({ disabled, onCsv, onJson }: ExportMenuProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
      >
        <FileDown className="h-3.5 w-3.5" />
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
            <button
              onClick={() => { onCsv(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
            >
              <FileDown className="h-3.5 w-3.5 shrink-0" />Export CSV
            </button>
            <button
              onClick={() => { onJson(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
            >
              <Braces className="h-3.5 w-3.5 shrink-0" />Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ReportsPage = () => {
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('reports');
  const [tab, setTab] = useState<Tab>('audit');

  // audit state
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [audit24h, setAudit24h] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  // execution state
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [execStats, setExecStats] = useState<N8nStats | null>(null);
  const [execLoading, setExecLoading] = useState(true);
  const [execError, setExecError] = useState<string | null>(null);

  const loadAudit = useCallback(() => {
    setAuditLoading(true);
    setAuditError(null);
    fetchAuditLog(500)
      .then((d) => { setAuditLogs(d.logs); setAuditTotal(d.total); setAudit24h(d.events_24h); })
      .catch((e: Error) => setAuditError(e.message))
      .finally(() => setAuditLoading(false));
  }, []);

  const loadExec = useCallback(() => {
    setExecLoading(true);
    setExecError(null);
    Promise.all([fetchN8nWorkflows(), fetchN8nStats()])
      .then(([wf, stats]) => { setWorkflows(wf.workflows); setExecStats(stats); })
      .catch((e: Error) => setExecError(e.message))
      .finally(() => setExecLoading(false));
  }, []);

  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => { loadExec(); }, [loadExec]);

  // --- audit derived ---
  const actionCounts = Object.entries(
    auditLogs.reduce<Record<string, number>>((acc, l) => {
      acc[l.action] = (acc[l.action] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([action, count]) => ({ action, count }));

  const uniqueActors = new Set(auditLogs.map((l) => l.actor_name).filter(Boolean)).size;
  const topAction = actionCounts[0]?.action ?? '—';

  const actorCounts = Object.entries(
    auditLogs.reduce<Record<string, number>>((acc, l) => {
      if (l.actor_name) acc[l.actor_name] = (acc[l.actor_name] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // --- execution derived ---
  const activeCount = workflows.filter((w) => w.active).length;
  const totalRuns = workflows.reduce((s, w) => s + w.totalRuns, 0);
  const totalErrors = workflows.reduce((s, w) => s + w.errors, 0);
  const errorRate = totalRuns > 0 ? ((totalErrors / totalRuns) * 100).toFixed(1) : '0.0';

  const topWorkflows = [...workflows]
    .sort((a, b) => b.totalRuns - a.totalRuns)
    .slice(0, 10)
    .map((w) => ({
      name: w.name.length > 22 ? `${w.name.slice(0, 22)}…` : w.name,
      success: w.successes,
      error: w.errors,
    }));

  const sortedWorkflows = [...workflows].sort((a, b) => b.totalRuns - a.totalRuns);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header title="Reports" />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />
        <main className="flex-1 overflow-y-auto px-10 py-8">

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Audit activity and workflow execution summaries — downloadable as CSV or JSON.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-secondary/40 rounded-xl p-1 w-fit">
            {(['audit', 'execution'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                  tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'audit' ? 'Audit Report' : 'Execution Report'}
              </button>
            ))}
          </div>

          {/* ── Audit Report ── */}
          {tab === 'audit' && (
            <div className="space-y-6">
              {auditError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />{auditError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <BentoStatCard label="Total events" value={auditLoading ? '…' : auditTotal} icon={<ShieldCheck className="h-4 w-4" />} accent="border-t-violet-500" iconBg="bg-violet-500/10" iconColor="text-violet-500" loading={auditLoading} />
                <BentoStatCard label="Events (24h)" value={auditLoading ? '…' : audit24h} icon={<Clock3 className="h-4 w-4" />} accent="border-t-blue-500" iconBg="bg-blue-500/10" iconColor="text-blue-400" loading={auditLoading} />
                <BentoStatCard label="Unique actors" value={auditLoading ? '…' : uniqueActors} icon={<User className="h-4 w-4" />} accent="border-t-green-500" iconBg="bg-green-500/10" iconColor="text-green-500" loading={auditLoading} />
                <BentoStatCard label="Top action" value={auditLoading ? '…' : topAction} icon={<Zap className="h-4 w-4" />} accent="border-t-amber-500" iconBg="bg-amber-500/10" iconColor="text-amber-400" loading={auditLoading} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Action breakdown chart */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="text-sm font-semibold mb-4">Action Breakdown</h2>
                  {auditLoading ? (
                    <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
                  ) : actionCounts.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={actionCounts} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="action" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--secondary))' }} />
                        <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}>
                          {actionCounts.map((_, i) => (
                            <Cell key={i} fill={ACTION_COLORS[i % ACTION_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Top actors */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="text-sm font-semibold mb-4">Top Actors</h2>
                  {auditLoading ? (
                    <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
                  ) : actorCounts.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data</div>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {actorCounts.map(([actor, count]) => {
                        const pct = auditTotal > 0 ? (count / auditTotal) * 100 : 0;
                        return (
                          <div key={actor}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-medium">{actor}</span>
                              <span className="text-muted-foreground tabular-nums">{count} events</span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-1.5 bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Export row */}
              <div className="flex justify-end">
                <div className="relative">
                  <ExportMenu
                    disabled={auditLoading || auditLogs.length === 0}
                    onCsv={() => downloadAuditCsv(auditLogs)}
                    onJson={() => downloadAuditJson(auditLogs)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Execution Report ── */}
          {tab === 'execution' && (
            <div className="space-y-6">
              {execError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />{execError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <BentoStatCard label="Active workflows" value={execLoading ? '…' : activeCount} icon={<GitBranch className="h-4 w-4" />} accent="border-t-green-500" iconBg="bg-green-500/10" iconColor="text-green-500" loading={execLoading} />
                <BentoStatCard label="Total runs" value={execLoading ? '…' : totalRuns} icon={<Zap className="h-4 w-4" />} accent="border-t-violet-500" iconBg="bg-violet-500/10" iconColor="text-violet-500" loading={execLoading} />
                <BentoStatCard label="Runs (24h)" value={execLoading ? '…' : (execStats?.total ?? 0)} icon={<Clock3 className="h-4 w-4" />} accent="border-t-blue-500" iconBg="bg-blue-500/10" iconColor="text-blue-400" loading={execLoading} />
                <BentoStatCard label="Error rate" value={execLoading ? '…' : `${errorRate}%`} icon={<XCircle className="h-4 w-4" />} accent="border-t-red-500" iconBg="bg-red-500/10" iconColor="text-red-400" loading={execLoading} />
              </div>

              {/* Top workflows chart */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold mb-4">Top Workflows by Runs</h2>
                {execLoading ? (
                  <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
                ) : topWorkflows.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">No workflows found.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={topWorkflows} margin={{ top: 0, right: 0, left: -20, bottom: 45 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--secondary))' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                      <Bar dataKey="success" stackId="a" fill="#10b981" name="Success" />
                      <Bar dataKey="error" stackId="a" fill="#ef4444" name="Error" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Workflow table */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold">Workflow Breakdown</h2>
                  <ExportMenu
                    disabled={execLoading || workflows.length === 0}
                    onCsv={() => downloadExecCsv(workflows)}
                    onJson={() => downloadExecJson(workflows)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                        <th className="px-5 py-2.5 text-left font-semibold">Workflow</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Total Runs</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Successes</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Errors</th>
                        <th className="px-4 py-2.5 text-right font-semibold">24h Runs</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Last Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {execLoading && (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-xs text-muted-foreground">Loading…</td>
                        </tr>
                      )}
                      {!execLoading && sortedWorkflows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-xs text-muted-foreground">No workflows found.</td>
                        </tr>
                      )}
                      {!execLoading && sortedWorkflows.map((w) => (
                        <tr key={w.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20 transition-colors">
                          <td className="px-5 py-2.5 text-xs font-medium max-w-[200px] truncate" title={w.name}>{w.name}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {w.active
                              ? <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="h-3 w-3" />Active</span>
                              : <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-3 w-3" />Inactive</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-xs text-right tabular-nums">{w.totalRuns}</td>
                          <td className="px-4 py-2.5 text-xs text-right tabular-nums text-green-500">{w.successes}</td>
                          <td className="px-4 py-2.5 text-xs text-right tabular-nums text-red-400">{w.errors}</td>
                          <td className="px-4 py-2.5 text-xs text-right tabular-nums">{w.runs24h}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(w.lastRunAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!execLoading && sortedWorkflows.length > 0 && (
                  <div className="px-5 py-2.5 border-t border-border text-[10px] text-muted-foreground">
                    {sortedWorkflows.length} workflows · {totalRuns.toLocaleString()} total runs
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default ReportsPage;
