import { authedFetch } from './client';

const BASE = '/api/logs';

export interface MonitorPoint {
  ts: number;
  cpu_raw: number;
  cpu_ema: number;
  cpu_effective: number;
  threshold: number;
  active: number;
  active_src: 'api' | 'redis';
  containers?: string[];
  container_cpu?: Record<string, number>;
}

export interface MonitorMetrics {
  servers: Record<string, MonitorPoint[]>;
}

export const fetchWorkerMonitorMetrics = async (): Promise<MonitorMetrics> => {
  const res = await authedFetch(`${BASE}/worker-monitor-metrics`);
  if (!res.ok) throw new Error(`Worker monitor metrics fetch failed: ${res.status}`);
  return res.json();
};
