import { authedFetch } from './client';

const BASE = '/api/admin/env';

export interface EnvVarKey {
  key: string;
  updated_at: string | null;
}

export interface EnvVar {
  key: string;
  value: string;
  updated_at: string | null;
}

export const fetchEnvVars = async (): Promise<EnvVarKey[]> => {
  const res = await authedFetch(`${BASE}/`);
  const data = await res.json();
  return (data.vars ?? []) as EnvVarKey[];
};

export const fetchEnvVarValue = async (key: string): Promise<string> => {
  const res = await authedFetch(`${BASE}/${encodeURIComponent(key)}`);
  const data = await res.json();
  return data.value as string;
};

export const setEnvVar = async (key: string, value: string): Promise<void> => {
  await authedFetch(`${BASE}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
};

export const deleteEnvVar = async (key: string): Promise<void> => {
  await authedFetch(`${BASE}/${encodeURIComponent(key)}`, { method: 'DELETE' });
};

export const deployEnv = async (): Promise<{ ok: boolean }> => {
  const res = await authedFetch(`${BASE}/deploy`, { method: 'POST' });
  return res.json() as Promise<{ ok: boolean }>;
};

export interface WorkflowRun {
  id: number;
  run_number: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  actor: string | null;
}

export const fetchWorkflowRuns = async (perPage = 10): Promise<WorkflowRun[]> => {
  const res = await authedFetch(`${BASE}/runs?per_page=${perPage}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `GitHub runs fetch failed (${res.status})`);
  return (data.runs ?? []) as WorkflowRun[];
};
