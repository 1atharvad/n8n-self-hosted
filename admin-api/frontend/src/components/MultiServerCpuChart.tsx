import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { MonitorPoint } from '@/api/worker-monitor';

interface MultiServerCpuChartProps {
  servers: Record<string, MonitorPoint[]>;
}

const COLORS = [
  'hsl(var(--primary))',
  '#f97316',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

const fmt = (ts: number): string =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const round30 = (ts: number) => Math.round(ts / 30) * 30;

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 12,
};

export const MultiServerCpuChart = ({ servers }: MultiServerCpuChartProps) => {
  const names = Object.keys(servers).sort();
  if (names.length < 2) return null;

  // Merge all server histories onto a shared time axis (rounded to 30s buckets)
  const buckets = new Map<number, Record<string, number>>();
  for (const name of names) {
    for (const p of servers[name]) {
      const key = round30(p.ts);
      if (!buckets.has(key)) buckets.set(key, {});
      buckets.get(key)![name] = p.cpu_ema;
    }
  }

  const chartData = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .slice(-60) // last 60 buckets ≈ 30 min
    .map(([ts, values]) => ({ time: fmt(ts), ...values }));

  // Use the max threshold across servers as the reference line
  const threshold = Math.max(
    ...names.map((n) => {
      const pts = servers[n];
      return pts.length > 0 ? (pts[pts.length - 1].threshold ?? 0) : 0;
    }),
  );

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-sm font-semibold">All servers — CPU EMA</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          CPU EMA overlay across {names.length} servers · last 30 min
        </p>
      </div>

      <div className="px-6 py-5" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
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
                typeof value === 'number' ? [`${value.toFixed(1)}%`, String(name)] : [value, name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {threshold > 0 && (
              <ReferenceLine
                y={threshold}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: `gate (${threshold}%)`,
                  fontSize: 9,
                  fill: 'hsl(var(--muted-foreground))',
                  position: 'insideTopLeft',
                }}
              />
            )}

            {names.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
