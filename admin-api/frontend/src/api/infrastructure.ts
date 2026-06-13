import { authedFetch } from './client';
import type { ServiceStatus } from './health';

const BASE = '/api/admin/infrastructure';

export const fetchServerHealth = async (server: string): Promise<ServiceStatus[]> => {
  const res = await authedFetch(`${BASE}/servers/${encodeURIComponent(server)}/health`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Health check failed');
  return data.services as ServiceStatus[];
};

export const restartContainer = async (server: string, container: string): Promise<{ returnCode: number; output: string }> => {
  const res = await authedFetch(`${BASE}/servers/${encodeURIComponent(server)}/restart/${encodeURIComponent(container)}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Restart failed');
  return data as { returnCode: number; output: string };
};
