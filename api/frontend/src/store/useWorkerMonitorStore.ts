import { create } from 'zustand';
import { fetchWorkerMonitorMetrics } from '@/api/worker-monitor';
import type { MonitorPoint } from '@/api/worker-monitor';

interface WorkerMonitorStore {
  servers: Record<string, MonitorPoint[]>;
  serverNames: string[];
  selectedServer: string | null;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  setSelectedServer: (name: string) => void;
  load: () => Promise<void>;
}

export const useWorkerMonitorStore = create<WorkerMonitorStore>((set, get) => ({
  servers: {},
  serverNames: [],
  selectedServer: null,
  loading: false,
  error: null,
  lastRefresh: null,

  setSelectedServer: (name: string) => set({ selectedServer: name }),

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchWorkerMonitorMetrics();
      const names = Object.keys(data.servers).sort();
      const current = get().selectedServer;
      set({
        servers: data.servers,
        serverNames: names,
        selectedServer: current && names.includes(current) ? current : (names[0] ?? null),
        lastRefresh: new Date(),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load worker monitor metrics' });
    } finally {
      set({ loading: false });
    }
  },
}));
