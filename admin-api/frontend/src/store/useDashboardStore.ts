import { create } from 'zustand';
import { fetchStats } from '@/api/dashboard';
import type { DashboardStats } from '@/api/dashboard';

interface DashboardStore {
  data: DashboardStats | null;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  range: string;
  setRange: (range: string) => void;
  load: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastRefresh: null,
  range: '1d',

  setRange: (range: string) => {
    set({ range });
    get().load();
  },

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchStats(get().range);
      set({ data, lastRefresh: new Date() });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load stats' });
    } finally {
      set({ loading: false });
    }
  },
}));
