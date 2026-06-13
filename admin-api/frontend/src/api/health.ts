import { authedFetch } from './client';

const BASE = '/api/admin/health';

export interface ServiceStatus {
  name: string;
  status: 'up' | 'down';
  latency_ms: number;
  message: string;
}

export const fetchServiceHealth = async (): Promise<ServiceStatus[]> => {
  const res = await authedFetch(`${BASE}/services`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Health check failed');
  return (data.services ?? []) as ServiceStatus[];
};
