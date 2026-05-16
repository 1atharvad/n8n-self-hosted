import { authedFetch } from './client';

const BASE = '/api/logs';

export interface AutoscalerPoint {
  ts: number;
  cpu_raw: number;
  cpu_ema: number;
  workers: number;
  waiting: number;
  active: number;
}

export interface AutoscalerMetrics {
  metrics: AutoscalerPoint[];
}

export const fetchAutoscalerMetrics = async (): Promise<AutoscalerMetrics> => {
  const res = await authedFetch(`${BASE}/autoscaler-metrics`);
  if (!res.ok) throw new Error(`Autoscaler metrics fetch failed: ${res.status}`);
  return res.json();
};
