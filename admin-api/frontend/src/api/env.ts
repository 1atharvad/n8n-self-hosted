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

export const deployEnv = async (): Promise<{ pushed: number }> => {
  const res = await authedFetch(`${BASE}/deploy`, { method: 'POST' });
  return res.json() as Promise<{ pushed: number }>;
};
