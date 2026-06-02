import { authedFetch } from './client'

const BASE = '/api/admin'

export interface DashboardSummary {
  total: number
  errors: number
  warnings: number
}

export interface TimePoint {
  time: string
  total: number
  error: number
  warning: number
}

export interface DashboardStats {
  containers: string[]
  summary: DashboardSummary
  timeseries: TimePoint[]
}

export const fetchStats = async (range = '1d'): Promise<DashboardStats> => {
  const res = await authedFetch(`${BASE}/stats?range=${range}`);
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  return res.json();
}
