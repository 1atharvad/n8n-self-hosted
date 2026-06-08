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
  name: string;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  actor: string | null;
}

export interface GitHubConfig {
  token_set: boolean;
  repo: string;
}

export const fetchGitHubConfig = async (): Promise<GitHubConfig> => {
  const res = await authedFetch(`${BASE}/github-config`);
  return res.json() as Promise<GitHubConfig>;
};

export const fetchGitHubToken = async (): Promise<string> => {
  const res = await authedFetch(`${BASE}/github-config/token`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Failed to fetch token');
  return data.token as string;
};

export const saveGitHubConfig = async (token?: string, repo?: string): Promise<void> => {
  await authedFetch(`${BASE}/github-config`, {
    method: 'PUT',
    body: JSON.stringify({ token: token ?? null, repo: repo ?? null }),
  });
};

export const fetchWorkflowRuns = async (page = 1, perPage = 10): Promise<{ runs: WorkflowRun[]; has_more: boolean }> => {
  const res = await authedFetch(`${BASE}/runs?per_page=${perPage}&page=${page}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `GitHub runs fetch failed (${res.status})`);
  return { runs: (data.runs ?? []) as WorkflowRun[], has_more: data.has_more as boolean };
};

export interface WorkflowStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  number: number;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: WorkflowStep[];
}

export const fetchRunJobs = async (runId: number): Promise<WorkflowJob[]> => {
  const res = await authedFetch(`${BASE}/runs/${runId}/jobs`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `Jobs fetch failed (${res.status})`);
  return (data.jobs ?? []) as WorkflowJob[];
};

export const fetchJobLogs = async (jobId: number): Promise<string> => {
  const res = await authedFetch(`${BASE}/jobs/${jobId}/logs`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `Logs fetch failed (${res.status})`);
  return (data.logs ?? '') as string;
};
