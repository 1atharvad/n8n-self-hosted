import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, User, Clock3, AlertCircle, RefreshCw, Search, Monitor, FileDown, Braces, X, MoreHorizontal, Eye } from 'lucide-react';
import { Header } from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { BentoStatCard } from '@/components/BentoStatCard';
import { cn } from '@/lib/utils';
import { fetchAuditLog } from '@/api/n8n';
import type { AuditEntry } from '@/api/n8n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_COLOR: Record<string, string> = {
  // Auth
  login:               'bg-blue-500/10 text-blue-400 border-blue-500/20',
  login_failed:        'bg-rose-500/10 text-rose-400 border-rose-500/20',
  logout:              'bg-slate-500/10 text-slate-400 border-slate-500/20',
  password_changed:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  // Users
  user_created:        'bg-green-500/10 text-green-400 border-green-500/20',
  user_updated:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  user_deleted:        'bg-red-500/10 text-red-400 border-red-500/20',
  // Env vars
  env_var_set:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  env_var_revealed:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  env_var_deleted:     'bg-red-500/10 text-red-400 border-red-500/20',
  env_deployed:        'bg-teal-500/10 text-teal-400 border-teal-500/20',
  // Folders
  folder_created:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  folder_renamed:      'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  folder_deleted:      'bg-red-500/10 text-red-400 border-red-500/20',
  // Workflows
  workflow_moved:      'bg-violet-500/10 text-violet-400 border-violet-500/20',
  workflow_unassigned: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  // SQLAdmin generic
  create:              'bg-green-500/10 text-green-500 border-green-500/20',
  update:              'bg-amber-500/10 text-amber-400 border-amber-500/20',
  delete:              'bg-red-500/10 text-red-400 border-red-500/20',
};

const actionColor = (action: string): string => {
  const a = action.toLowerCase();
  if (ACTION_COLOR[a]) return ACTION_COLOR[a];
  const key = Object.keys(ACTION_COLOR).find((k) => a.startsWith(k));
  return key ? ACTION_COLOR[key] : 'bg-secondary/60 text-muted-foreground border-border';
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const LIMITS = [100, 250, 500] as const;

const csvEscape = (v: string | null | undefined): string => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (logs: AuditEntry[]) => {
  const header = ['Time', 'Actor', 'Action', 'Target', 'IP', 'Detail'];
  const rows = logs.map((l) => [
    l.created_at, l.actor_name, l.action, l.target_name, l.ip_address, l.detail,
  ].map(csvEscape).join(','));
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadJson = (logs: AuditEntry[]) => {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const tryParseJson = (s: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
};

type DiffEntry = { from: unknown; to: unknown };
const isDiffObject = (o: Record<string, unknown>): o is Record<string, DiffEntry> =>
  Object.values(o).every((v) => v !== null && typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object));

const renderValue = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const ACCENT_BORDER: Record<string, string> = {
  login:               'border-t-blue-500',
  login_failed:        'border-t-rose-500',
  logout:              'border-t-slate-500',
  password_changed:    'border-t-purple-500',
  user_created:        'border-t-green-500',
  user_updated:        'border-t-amber-500',
  user_deleted:        'border-t-red-500',
  env_var_set:         'border-t-yellow-500',
  env_var_revealed:    'border-t-orange-500',
  env_var_deleted:     'border-t-red-500',
  env_deployed:        'border-t-teal-500',
  folder_created:      'border-t-emerald-500',
  folder_renamed:      'border-t-cyan-500',
  folder_deleted:      'border-t-red-500',
  workflow_moved:      'border-t-violet-500',
  workflow_unassigned: 'border-t-orange-500',
  create:              'border-t-green-500',
  update:              'border-t-amber-500',
  delete:              'border-t-red-500',
};
const accentBorder = (action: string): string => {
  const a = action.toLowerCase();
  if (ACCENT_BORDER[a]) return ACCENT_BORDER[a];
  const key = Object.keys(ACCENT_BORDER).find((k) => a.startsWith(k));
  return key ? ACCENT_BORDER[key] : 'border-t-violet-500';
};

interface DetailModalProps {
  log: AuditEntry;
  onClose: () => void;
}

const DetailModal = ({ log, onClose }: DetailModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const parsed = log.detail ? tryParseJson(log.detail) : null;
  const isDiff = parsed ? isDiffObject(parsed) : false;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={cn('bg-card border border-border border-t-2 rounded-2xl shadow-2xl w-full max-w-xl max-h-[82vh] flex flex-col', accentBorder(log.action))}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide', actionColor(log.action))}>
                {log.action}
              </span>
              {log.target_name && (
                <span className="text-xs font-mono text-muted-foreground">{log.target_name}</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Meta chips ── */}
        <div className="flex flex-wrap gap-2 px-5 pb-3 shrink-0">
          {log.actor_name && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 text-[11px]">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-foreground/80">{log.actor_name}</span>
            </div>
          )}
          {log.ip_address && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 text-[11px]">
              <Monitor className="h-3 w-3 text-muted-foreground" />
              <span className="text-foreground/80">{log.ip_address}</span>
            </div>
          )}
        </div>

        <div className="border-t border-border mx-5 shrink-0" />

        {/* ── Detail body ── */}
        <div className="overflow-y-auto px-5 py-4 flex-1 min-h-0">
          {!log.detail && (
            <p className="text-xs text-muted-foreground text-center py-6">No detail recorded for this event.</p>
          )}

          {/* Diff view — update events */}
          {log.detail && isDiff && parsed && (
            <div className="space-y-0 rounded-xl overflow-hidden border border-border text-xs">
              <div className="grid grid-cols-3 bg-secondary/60 px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                <span>Field</span>
                <span>From</span>
                <span>To</span>
              </div>
              {Object.entries(parsed as Record<string, DiffEntry>).map(([field, { from, to }], i, arr) => (
                <div
                  key={field}
                  className={cn('grid grid-cols-3 px-3 py-2.5 gap-2 items-start', i < arr.length - 1 && 'border-b border-border/60')}
                >
                  <span className="font-medium text-foreground/70 break-all">{field}</span>
                  <span className="text-red-400/90 break-all font-mono">{renderValue(from)}</span>
                  <span className="text-green-400 break-all font-mono">{renderValue(to)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Snapshot view — create / delete events */}
          {log.detail && !isDiff && parsed && (
            <div className="rounded-xl overflow-hidden border border-border text-xs">
              <div className="grid grid-cols-2 bg-secondary/60 px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                <span>Field</span>
                <span>Value</span>
              </div>
              {Object.entries(parsed).map(([field, value], i, arr) => (
                <div
                  key={field}
                  className={cn('grid grid-cols-2 px-3 py-2.5 gap-2 items-start', i < arr.length - 1 && 'border-b border-border/60')}
                >
                  <span className="font-medium text-foreground/70 break-all">{field}</span>
                  <span className="text-foreground/80 break-all font-mono">{renderValue(value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fallback — plain text */}
          {log.detail && !parsed && (
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words leading-relaxed bg-secondary/30 rounded-xl px-4 py-3">
              {log.detail}
            </pre>
          )}
        </div>

      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AuditPage = () => {
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('audit');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [events24h, setEvents24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<100 | 250 | 500>(100);
  const [search, setSearch] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAuditLog(limit)
      .then((data) => { setLogs(data.logs); setTotal(data.total); setEvents24h(data.events_24h); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      (log.actor_name ?? '').toLowerCase().includes(q) ||
      (log.target_name ?? '').toLowerCase().includes(q) ||
      (log.detail ?? '').toLowerCase().includes(q)
    );
  });

  const uniqueActors = new Set(logs.map((l) => l.actor_name).filter(Boolean)).size;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      <Header title="Audit Log" />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />
        <main className="flex-1 overflow-y-auto px-10 py-8">

          <div className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-1">Track all admin actions and system events.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <BentoStatCard
              label="Total events"
              value={loading ? '…' : total}
              icon={<ShieldCheck className="h-4 w-4" />}
              accent="border-t-violet-500"
              iconBg="bg-violet-500/10"
              iconColor="text-violet-500"
              loading={loading}
            />
            <BentoStatCard
              label="Events (24h)"
              value={loading ? '…' : events24h}
              icon={<Clock3 className="h-4 w-4" />}
              accent="border-t-blue-500"
              iconBg="bg-blue-500/10"
              iconColor="text-blue-400"
              loading={loading}
            />
            <BentoStatCard
              label="Unique actors"
              value={loading ? '…' : uniqueActors}
              icon={<User className="h-4 w-4" />}
              accent="border-t-green-500"
              iconBg="bg-green-500/10"
              iconColor="text-green-500"
              loading={loading}
            />
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden max-h-[64vh] flex flex-col">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by action, actor, target…"
                  className="w-full bg-secondary/40 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-0.5 bg-secondary/60 rounded-lg p-0.5 ml-auto">
                {LIMITS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLimit(l as 100 | 250 | 500)}
                    className={cn(
                      'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors',
                      limit === l
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  disabled={loading || filtered.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => { downloadCsv(filtered); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
                      >
                        <FileDown className="h-3.5 w-3.5 shrink-0" />
                        Export CSV
                      </button>
                      <button
                        onClick={() => { downloadJson(filtered); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
                      >
                        <Braces className="h-3.5 w-3.5 shrink-0" />
                        Export JSON
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>

            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-semibold whitespace-nowrap">Time</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Actor</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Action</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Target</th>
                    <th className="px-4 py-2.5 text-left font-semibold">IP</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Detail</th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-xs text-muted-foreground">Loading…</td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-xs text-muted-foreground">
                        {search ? 'No entries match your filter.' : 'No audit events recorded.'}
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-5 py-2.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Clock3 className="h-3 w-3 shrink-0" />
                          {fmtDate(log.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium">
                        {log.actor_name ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide', actionColor(log.action))}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {log.target_name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {log.ip_address ? (
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3 shrink-0" />
                            {log.ip_address}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">
                        {log.detail ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === log.id ? null : log.id)}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                          {openMenuId === log.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[110px]">
                                <button
                                  onClick={() => { setSelectedLog(log); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
                                >
                                  <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  View detail
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="px-5 py-2.5 border-t border-border text-[10px] text-muted-foreground">
                Showing {filtered.length}{search ? ` of ${logs.length}` : ''} events
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuditPage;
