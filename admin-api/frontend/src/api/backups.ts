import { authedFetch } from './client';

const BASE = '/api/admin/backups';

export interface WorkflowBackup {
  sha: string;
  message: string;
  date: string;
}

export interface ExecuteResult {
  output: string;
  returnCode: number;
}

export interface BackupWorkflow {
  name: string;
  active: boolean;
  archived: boolean;
}

export const triggerBackup = async (): Promise<ExecuteResult> => {
  const res = await authedFetch(`${BASE}`, { method: 'POST' });
  return res.json();
};

export const fetchBackups = async (): Promise<WorkflowBackup[]> => {
  const res = await authedFetch(`${BASE}`);
  const data = await res.json();
  return (data.backups ?? []) as WorkflowBackup[];
};

export const fetchBackupDetails = async (sha: string): Promise<{ workflows: BackupWorkflow[]; count: number }> => {
  const res = await authedFetch(`${BASE}/${sha}/details`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Failed to fetch backup details');
  return data as { workflows: BackupWorkflow[]; count: number };
};
