import type { Filters, LogEntry } from '@/types'
import { authedFetch } from './client'

const BASE = '/api/logs'

export const fetchLabels = async (): Promise<string[]> => {
  const res = await authedFetch(`${BASE}/labels`)
  if (!res.ok) throw new Error(`Labels fetch failed: ${res.status}`)
  const data = await res.json()
  return data.labels as string[]
}

export const fetchLogs = async (filters: Filters): Promise<LogEntry[]> => {
  const params = new URLSearchParams()
  if (filters.containers.length > 0)
    params.set('containers', filters.containers.join(','))
  if (filters.search) params.set('search', filters.search)
  if (filters.level !== 'all') params.set('level', filters.level)
  params.set('range', filters.range)
  params.set('limit', String(filters.limit))

  const res = await authedFetch(`${BASE}/query?${params.toString()}`)
  if (!res.ok) throw new Error(`Log query failed: ${res.status}`)
  const data = await res.json()
  return data.logs as LogEntry[]
}
