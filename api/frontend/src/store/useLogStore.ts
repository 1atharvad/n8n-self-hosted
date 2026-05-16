import { create } from 'zustand'
import { fetchLabels, fetchLogs } from '@/api/logs'
import type { Filters, LogEntry, TimeRange } from '@/types'

interface LogStore {
  // data
  logs: LogEntry[]
  labels: string[]
  loading: boolean
  error: string | null
  lastRefresh: Date | null

  // filters
  filters: Filters

  // ui
  paused: boolean
  autoScroll: boolean

  // actions
  loadLabels: () => Promise<void>
  loadLogs: () => Promise<void>
  setContainers: (containers: string[]) => void
  setLevel: (level: string) => void
  setSearch: (search: string) => void
  setRange: (range: TimeRange) => void
  setLimit: (limit: number) => void
  togglePause: () => void
  setAutoScroll: (v: boolean) => void
  clearError: () => void
}

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [],
  labels: [],
  loading: false,
  error: null,
  lastRefresh: null,

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
      const labels = await fetchLabels()
      set({ labels })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load labels' })
    }
  },

  loadLogs: async () => {
    if (get().paused) return
    set({ loading: true, error: null })
    try {
      const logs = await fetchLogs(get().filters)
      set({ logs, lastRefresh: new Date() })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch logs' })
    } finally {
      set({ loading: false })
    }
  },

  setContainers: (containers) => set((s) => ({ filters: { ...s.filters, containers } })),

  setLevel: (level) => set((s) => ({ filters: { ...s.filters, level } })),

  setSearch: (search) => set((s) => ({ filters: { ...s.filters, search } })),

  setRange: (range) => set((s) => ({ filters: { ...s.filters, range } })),

  setLimit: (limit) => set((s) => ({ filters: { ...s.filters, limit } })),

  togglePause: () => set((s) => ({ paused: !s.paused })),

  setAutoScroll: (v) => set({ autoScroll: v }),

  clearError: () => set({ error: null }),
}))
