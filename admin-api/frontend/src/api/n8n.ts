import { authedFetch } from './client';

const BASE = '/api/admin/n8n';

export interface N8nStats {
  available: boolean;
  success: number;
  error: number;
  running: number;
  total: number;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  folderId: string | null;
  folderName: string | null;
  updatedAt: string | null;
  totalRuns: number;
  successes: number;
  errors: number;
  runs24h: number;
  errors24h: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastDurationMs: number | null;
}

export interface WorkflowExecution {
  startedAt: string;
  durationMs: number;
  status: string;
}

export interface FolderDailyRaw {
  workflowId: string;
  workflowName: string;
  bucket: string;
  runs: number;
}

export interface FolderDailyResponse {
  granularity: 'hour' | 'day';
  data: FolderDailyRaw[];
}

export interface N8nFolder {
  id: string;
  name: string;
}

export interface N8nWorkflowsResponse {
  available: boolean;
  error_detail?: string;
  workflows: N8nWorkflow[];
}

export interface AuditEntry {
  id: string;
  actor_name: string | null;
  action: string;
  target_name: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}

export const fetchFolderDailyExecutions = async (workflowIds: string[], days = 14): Promise<FolderDailyResponse> => {
  const res = await authedFetch(`${BASE}/executions/daily?ids=${workflowIds.join(',')}&days=${days}`);
  if (!res.ok) throw new Error(`Folder daily executions fetch failed: ${res.status}`);
  return res.json() as Promise<FolderDailyResponse>;
};

export const fetchWorkflowExecutions = async (workflowId: string): Promise<WorkflowExecution[]> => {
  const res = await authedFetch(`${BASE}/workflows/${workflowId}/executions`);
  if (!res.ok) throw new Error(`Executions fetch failed: ${res.status}`);
  const data = await res.json();
  return data.executions as WorkflowExecution[];
};

export const fetchRunningWorkflows = async (): Promise<Set<string>> => {
  const res = await authedFetch(`${BASE}/running`);
  if (!res.ok) throw new Error(`Running fetch failed: ${res.status}`);
  const data = await res.json();
  return new Set<string>(data.ids);
};

export const fetchN8nStats = async (): Promise<N8nStats> => {
  const res = await authedFetch(`${BASE}/stats`);
  if (!res.ok) throw new Error(`n8n stats fetch failed: ${res.status}`);
  return res.json();
};

export const fetchN8nWorkflows = async (): Promise<N8nWorkflowsResponse> => {
  const res = await authedFetch(`${BASE}/workflows`);
  if (!res.ok) throw new Error(`n8n workflows fetch failed: ${res.status}`);
  return res.json();
};

export const fetchFolders = async (): Promise<N8nFolder[]> => {
  const res = await authedFetch(`${BASE}/folders`);
  if (!res.ok) throw new Error(`Folders fetch failed: ${res.status}`);
  const data = await res.json();
  return data.folders;
};

export const createFolder = async (name: string): Promise<N8nFolder> => {
  const res = await authedFetch(`${BASE}/folders`, { method: 'POST', body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(`Create folder failed: ${res.status}`);
  return res.json();
};

export const renameFolder = async (id: string, name: string): Promise<N8nFolder> => {
  const res = await authedFetch(`${BASE}/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(`Rename folder failed: ${res.status}`);
  return res.json();
};

export const deleteFolder = async (id: string): Promise<void> => {
  const res = await authedFetch(`${BASE}/folders/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete folder failed: ${res.status}`);
};

export const assignWorkflowFolder = async (workflowId: string, folderId: string): Promise<void> => {
  const res = await authedFetch(`${BASE}/workflows/${workflowId}/folder`, { method: 'PUT', body: JSON.stringify({ folder_id: folderId }) });
  if (!res.ok) throw new Error(`Assign folder failed: ${res.status}`);
};

export const removeWorkflowFolder = async (workflowId: string): Promise<void> => {
  const res = await authedFetch(`${BASE}/workflows/${workflowId}/folder`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Remove folder failed: ${res.status}`);
};

export interface AuditLogResponse { logs: AuditEntry[]; total: number; events_24h: number; }

export const fetchAuditLog = async (limit = 100): Promise<AuditLogResponse> => {
  const res = await authedFetch(`/api/admin/audit?limit=${limit}`);
  if (!res.ok) throw new Error(`Audit log fetch failed: ${res.status}`);
  return res.json();
};
