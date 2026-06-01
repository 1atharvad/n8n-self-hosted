import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { MonitorPoint } from '@/api/worker-monitor';

interface CpuChartProps {
  metrics: MonitorPoint[];
  loading: boolean;
}

interface ChartPoint {
  time: string;
  'CPU raw': number;
  'CPU EMA': number;
  Active: number;
}

const fmt = (ts: number): string =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 12,
};

export const CpuChart = ({ metrics, loading }: CpuChartProps) => {
  const chartData: ChartPoint[] = metrics.map((p) => ({
    time: fmt(p.ts),
    'CPU raw': p.cpu_raw,
    'CPU EMA': p.cpu_ema,
    Active: p.active,
  }));

  const latest = metrics[metrics.length - 1];

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">Worker monitor — CPU & queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last {metrics.length} polls · refreshes every 30s
          </p>
        </div>
        {latest && (
          <div className="flex gap-4 text-right">
            <Pill label="CPU" value={`${latest.cpu_ema.toFixed(1)}%`} color="text-primary" />
            <Pill label="Active" value={String(latest.active)} color="text-green-400" />
          </div>
        )}
      </div>

      <div className="px-6 py-5" style={{ height: 300 }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            {loading ? 'Loading…' : 'No autoscaler data yet'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gEma" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />

              {/* Left axis: CPU % */}
              <YAxis
                yAxisId="cpu"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />

              {/* Right axis: worker / queue count */}
              <YAxis
                yAxisId="count"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value, name) => {
                  const n = String(name ?? '');
                  if ((n === 'CPU raw' || n === 'CPU EMA') && typeof value === 'number') return [`${value.toFixed(1)}%`, n];
                  return [value ?? '', n];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {latest?.threshold !== undefined && (
                <ReferenceLine
                  yAxisId="cpu"
                  y={latest.threshold}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{ value: `threshold (${latest.threshold}%)`, fontSize: 9, fill: 'hsl(var(--muted-foreground))', position: 'insideTopLeft' }}
                />
              )}

              {/* CPU EMA — filled area */}
              <Area
                yAxisId="cpu"
                type="monotone"
                dataKey="CPU EMA"
                stroke="hsl(var(--primary))"
                fill="url(#gEma)"
                strokeWidth={2}
                dot={false}
              />

              {/* CPU raw — dashed line */}
              <Line
                yAxisId="cpu"
                type="monotone"
                dataKey="CPU raw"
                stroke="hsl(var(--primary))"
                strokeOpacity={0.45}
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
              />

              {/* Active jobs — step line, right axis */}
              <Line
                yAxisId="count"
                type="stepAfter"
                dataKey="Active"
                stroke="#4ade80"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};

const Pill = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="text-right">
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={`text-sm font-semibold tabular-nums ${color}`}>{value}</p>
  </div>
);
