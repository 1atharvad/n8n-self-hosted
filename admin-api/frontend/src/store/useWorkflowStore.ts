import { create } from 'zustand';
import { fetchN8nWorkflows } from '@/api/n8n';
import type { N8nWorkflow } from '@/api/n8n';

interface WorkflowStore {
  workflows: N8nWorkflow[];
  available: boolean;
  apiError: string | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  workflows: [],
  available: false,
  apiError: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchN8nWorkflows();
      set({ workflows: data.workflows, available: data.available, apiError: data.error_detail ?? null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load workflows' });
    } finally {
      set({ loading: false });
    }
  },
}));
