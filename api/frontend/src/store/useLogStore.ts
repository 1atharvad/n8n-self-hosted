import { create } from 'zustand'
import { fetchLabels, fetchLogs, openLogStream } from '@/api/logs'
import type { Filters, LogEntry, TimeRange } from '@/types'

interface LogStore {
  logs: LogEntry[]
  labels: string[]
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  streamConnected: boolean
  filters: Filters
  paused: boolean
  autoScroll: boolean
  loadLabels: () => Promise<void>
  startStream: () => Promise<void>
  stopStream: () => void
  setContainers: (containers: string[]) => void
  setLevel: (level: string) => void
  setSearch: (search: string) => void
  setRange: (range: TimeRange) => void
  setLimit: (limit: number) => void
  togglePause: () => void
  setAutoScroll: (v: boolean) => void
  clearError: () => void
}

let _cleanup: (() => void) | null = null;
let _streamGen = 0;

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [],
  labels: [],
  loading: false,
  error: null,
  lastRefresh: null,
  streamConnected: false,

  filters: {
    containers: [],
    level: 'all',
    search: '',
    range: '1h',
    limit: 500,
  },

  paused: false,
  autoScroll: true,

  loadLabels: async () => {
    try {
      const labels = await fetchLabels();
      set({ labels });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load labels' });
    }
  },

  startStream: async () => {
    const gen = ++_streamGen;
    _cleanup?.();
    _cleanup = null;
    set({ streamConnected: false });

    set({ loading: true, error: null });
    let sinceNs: number | undefined;
    try {
      const logs = await fetchLogs(get().filters);
      if (gen !== _streamGen) return;
      set({ logs, lastRefresh: new Date(), loading: false });
      const last = logs[logs.length - 1];
      if (last) sinceNs = Math.floor(new Date(last.ts).getTime() * 1_000_000) + 1;
    } catch (err) {
      if (gen !== _streamGen) return;
      set({ error: err instanceof Error ? err.message : 'Failed to load logs', loading: false });
      return;
    }

    // Load history even when paused, but don't open the SSE stream.
    if (get().paused || gen !== _streamGen) return;
    set({ streamConnected: true });

    _cleanup = openLogStream(
      get().filters,
      sinceNs,
      (entry) => {
        if (gen !== _streamGen || get().paused) return;
        set((s) => {
          const next = [...s.logs, entry];
          return { logs: next.length > 2000 ? next.slice(-2000) : next, lastRefresh: new Date() };
        });
      },
      () => {
        if (gen !== _streamGen) return;
        set({ streamConnected: false });
        setTimeout(() => { if (gen === _streamGen) void get().startStream(); }, 5000);
      },
    );
  },

  stopStream: () => {
    _cleanup?.();
    _cleanup = null;
    set({ streamConnected: false });
  },

  setContainers: (containers) => set((s) => ({ filters: { ...s.filters, containers } })),
  setLevel: (level) => set((s) => ({ filters: { ...s.filters, level } })),
  setSearch: (search) => set((s) => ({ filters: { ...s.filters, search } })),
  setRange: (range) => set((s) => ({ filters: { ...s.filters, range } })),
  setLimit: (limit) => set((s) => ({ filters: { ...s.filters, limit } })),

  togglePause: () => {
    const nowPaused = !get().paused;
    set({ paused: nowPaused });
    if (nowPaused) {
      get().stopStream();
    } else {
      void get().startStream();
    }
  },

  setAutoScroll: (v) => set({ autoScroll: v }),
  clearError: () => set({ error: null }),
}))
