import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonitorPoint } from '@/api/worker-monitor';

interface ContainerCpuChartProps {
  metrics: MonitorPoint[];
  loading: boolean;
}

const COLORS = [
  '#60a5fa',
  '#f472b6',
  '#34d399',
  '#fb923c',
  '#a78bfa',
  '#facc15',
  '#2dd4bf',
  '#f87171',
  '#818cf8',
  '#e879f9',
];

const fmt = (ts: number): string =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 12,
};

export const ContainerCpuChart = ({ metrics, loading }: ContainerCpuChartProps) => {
  const containerNames = React.useMemo(() => {
    const names = new Set<string>();
    metrics.forEach((m) => {
      Object.keys(m.container_cpu ?? {}).forEach((n) => names.add(n));
    });
    return Array.from(names).sort();
  }, [metrics]);

  const chartData = metrics
    .filter((m) => m.container_cpu !== undefined)
    .map((m) => {
      const point: Record<string, number | string> = { time: fmt(m.ts) };
      containerNames.forEach((name) => {
        point[name] = m.container_cpu?.[name] ?? 0;
      });
      return point;
    });

  const hasData = chartData.length > 0 && containerNames.length > 0;

  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Per-container CPU usage</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          CPU % per running container · last {metrics.length} polls
        </p>
      </div>

      <div className="px-4 py-4" style={{ height: 300 }}>
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            {loading ? 'Loading…' : 'No container CPU data yet'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value, name) =>
                  typeof value === 'number' ? [`${value.toFixed(1)}%`, String(name)] : [value, String(name)]
                }
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {containerNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};
