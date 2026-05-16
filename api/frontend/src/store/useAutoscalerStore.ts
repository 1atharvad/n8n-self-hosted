import { create } from 'zustand';
import { fetchAutoscalerMetrics } from '@/api/autoscaler';
import type { AutoscalerPoint } from '@/api/autoscaler';

interface AutoscalerStore {
  metrics: AutoscalerPoint[];
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  load: () => Promise<void>;
}

export const useAutoscalerStore = create<AutoscalerStore>((set) => ({
  metrics: [],
  loading: false,
  error: null,
  lastRefresh: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchAutoscalerMetrics();
      set({ metrics: data.metrics, lastRefresh: new Date() });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load autoscaler metrics' });
    } finally {
      set({ loading: false });
    }
  },
}));
