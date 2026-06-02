import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '@/store/useDashboardStore';
import { Header } from '@/components/Header';
import { BentoStatCard } from '@/components/BentoStatCard';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { AlertCircle, AlertTriangle, ScrollText, Server, Database, Settings } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const RANGE_OPTIONS = [
  { value: '1m',  label: '1 min' },
  { value: '5m',  label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h',  label: '1 hour' },
  { value: '1d',  label: '1 day' },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { data, loading, error, range, setRange, load } = useDashboardStore();
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('dashboard');

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const summary = data?.summary;
  const timeseries = data?.timeseries ?? [];
  const containers = data?.containers ?? [];

  const shortRange = range === '1m' || range === '5m' || range === '15m';
  const chartData = timeseries.map((p) => ({
    time: new Date(p.time).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      ...(shortRange ? { second: '2-digit' } : {}),
    }),
    Total: p.total,
    Errors: p.error,
    Warnings: p.warning,
  }));

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">System overview and infrastructure status.</p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-5">
              <BentoStatCard label="Errors" value={summary?.errors ?? '—'} icon={<AlertCircle className="h-4 w-4" />} accent="border-t-red-500" iconBg="bg-red-500/10" iconColor="text-red-500" loading={loading && !data} />
              <BentoStatCard label="Warnings" value={summary?.warnings ?? '—'} icon={<AlertTriangle className="h-4 w-4" />} accent="border-t-amber-400" iconBg="bg-amber-400/10" iconColor="text-amber-400" loading={loading && !data} />
              <BentoStatCard label="Total logs" value={summary?.total ?? '—'} icon={<ScrollText className="h-4 w-4" />} accent="border-t-blue-500" iconBg="bg-blue-500/10" iconColor="text-blue-500" loading={loading && !data} />
              <BentoStatCard label="Active containers" value={containers.length} icon={<Server className="h-4 w-4" />} accent="border-t-teal-500" iconBg="bg-teal-500/10" iconColor="text-teal-500" loading={loading && !data} />
            </div>

            {/* Log volume chart */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Log volume</h2>
                  <p className="text-xs text-foreground/80 mt-0.5">Last {RANGE_OPTIONS.find((o) => o.value === range)?.label}</p>
                </div>
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="px-6 py-5" style={{ height: 300 }}>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                    {loading && !data ? 'Loading…' : 'No data'}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} labelStyle={{ color: 'hsl(var(--foreground))' }} cursor={{ fill: 'hsl(var(--border))', opacity: 0.4 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Total" fill="hsl(var(--primary))" opacity={0.8} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Errors" fill="hsl(var(--destructive))" opacity={0.8} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Warnings" fill="#facc15" opacity={0.8} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Services */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: <ScrollText className="h-4 w-4" />, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500', name: 'Log Viewer', description: 'Live streaming logs from all containers with filtering, search, and level controls.', onClick: () => navigate('/logs') },
                { icon: <Database className="h-4 w-4" />, iconBg: 'bg-teal-500/10', iconColor: 'text-teal-500', name: 'DB Admin', description: 'Browse tables, inspect records, and manage your database via sqladmin.', onClick: () => { window.location.href = '/api/core/db-admin/'; } },
                { icon: <Settings className="h-4 w-4" />, iconBg: 'bg-amber-400/10', iconColor: 'text-amber-400', name: 'Settings', description: 'Container visibility, password management, and user administration.', onClick: () => navigate('/settings') },
              ].map((s) => (
                <button key={s.name} onClick={s.onClick} className={`text-left bg-card border border-border rounded-2xl px-5 py-4 flex flex-col gap-3 hover:border-primary/40 transition-colors`}>
                  <div className={`p-2 rounded-lg w-fit ${s.iconBg}`}>
                    <span className={s.iconColor}>{s.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
