import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'
import { useDashboardStore } from '@/store/useDashboardStore'
import { useAutoscalerStore } from '@/store/useAutoscalerStore'
import { Header } from '@/components/Header'
import { CpuChart } from '@/components/CpuChart'
import { ContainerCpuChart } from '@/components/ContainerCpuChart'
import { ActiveContainersSection } from '@/components/ActiveContainersSection'
import { PageAside } from 'advi-ui'
import {
  LayoutDashboard,
  Settings,
  AlertCircle,
  AlertTriangle,
  ScrollText,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const RANGE_OPTIONS = [
  { value: '1m',  label: '1 min' },
  { value: '5m',  label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h',  label: '1 hour' },
  { value: '1d',  label: '1 day' },
];

const DashboardPage = () => {
  const navigate = useNavigate()
  const { data, loading, error, lastRefresh, range, setRange, load } = useDashboardStore()
  const { metrics, loading: autoscalerLoading, load: loadAutoscaler } = useAutoscalerStore()
  const [asideOpen, setAsideOpen] = useState(true)

  useEffect(() => {
    load()
    loadAutoscaler()
  }, [load, loadAutoscaler])
  useEffect(() => {
    const id = setInterval(() => { load(); loadAutoscaler(); }, 30_000)
    return () => clearInterval(id)
  }, [load, loadAutoscaler])

  const summary = data?.summary
  const timeseries = data?.timeseries ?? []
  const containers = data?.containers ?? []

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
  }))

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        title="Dashboard"
        actions={
          lastRefresh && (
            <span className="text-[11px] text-muted-foreground">
              {loading ? 'Refreshing…' : `Updated ${lastRefresh.toLocaleTimeString()}`}
            </span>
          )
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <PageAside
          open={asideOpen}
          onToggle={() => setAsideOpen((v) => !v)}
          items={[
            {
              icon: <ScrollText className="h-4 w-4" />,
              label: 'Logs',
              onClick: () => navigate('/'),
            },
            {
              icon: <LayoutDashboard className="h-4 w-4" />,
              label: 'Dashboard',
              onClick: () => navigate('/dashboard'),
              active: true,
            },
            {
              icon: <Settings className="h-4 w-4" />,
              label: 'Settings',
              onClick: () => navigate('/settings'),
            },
          ]}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Errors"
              value={summary?.errors ?? '—'}
              icon={<AlertCircle className="h-4 w-4" />}
              color="text-destructive"
              bg="bg-destructive/10"
              loading={loading && !data}
            />
            <StatCard
              label="Warnings"
              value={summary?.warnings ?? '—'}
              icon={<AlertTriangle className="h-4 w-4" />}
              color="text-yellow-400"
              bg="bg-yellow-400/10"
              loading={loading && !data}
            />
            <StatCard
              label="Total logs"
              value={summary?.total ?? '—'}
              icon={<ScrollText className="h-4 w-4" />}
              color="text-primary"
              bg="bg-primary/10"
              loading={loading && !data}
            />
            <StatCard
              label="Active containers"
              value={containers.length}
              icon={<Server className="h-4 w-4" />}
              color="text-green-400"
              bg="bg-green-400/10"
              loading={loading && !data}
            />
          </div>

          {/* Log volume chart */}
          <section className="bg-card border border-border rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Log volume — last {RANGE_OPTIONS.find((o) => o.value === range)?.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Log counts by severity</p>
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
            <div className="px-4 py-4" style={{ height: 280 }}>
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  {loading && !data ? 'Loading…' : 'No data'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      cursor={{ fill: 'hsl(var(--border))', opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Total" fill="hsl(var(--primary))" opacity={0.8} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Errors" fill="hsl(var(--destructive))" opacity={0.8} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Warnings" fill="#facc15" opacity={0.8} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <CpuChart metrics={metrics} loading={autoscalerLoading} />

          <ContainerCpuChart metrics={metrics} loading={autoscalerLoading} />

          {/* Active containers + scale events */}
          <ActiveContainersSection metrics={metrics} fallbackContainers={containers} loading={loading && !data} />
        </main>
      </div>
    </div>
  )
}

const StatCard = ({
  label,
  value,
  icon,
  color,
  bg,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  loading: boolean;
}) => {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-4 flex items-start gap-3">
      <div className={cn('p-2 rounded-md shrink-0', bg)}>
        <span className={color}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-semibold mt-0.5 tabular-nums">
          {loading ? (
            <span className="text-muted-foreground text-sm">—</span>
          ) : (
            value.toLocaleString()
          )}
        </p>
      </div>
    </div>
  );
};


export default DashboardPage;
