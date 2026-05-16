import type { Filters, LogEntry } from '@/types'
import { authedFetch } from './client'

const BASE = '/api/logs'

export async function fetchLabels(): Promise<string[]> {
  const res = await authedFetch(`${BASE}/labels`)
  if (!res.ok) throw new Error(`Labels fetch failed: ${res.status}`)
  const data = await res.json()
  return data.labels as string[]
}

export async function fetchLogs(filters: Filters): Promise<LogEntry[]> {
  const url = new URL(`${BASE}/query`, window.location.origin)
  if (filters.containers.length > 0)
    url.searchParams.set('containers', filters.containers.join(','))
  if (filters.search) url.searchParams.set('search', filters.search)
  if (filters.level !== 'all') url.searchParams.set('level', filters.level)
  url.searchParams.set('range', filters.range)
  url.searchParams.set('limit', String(filters.limit))

  const res = await authedFetch(url.toString())
  if (!res.ok) throw new Error(`Log query failed: ${res.status}`)
  const data = await res.json()
  return data.logs as LogEntry[]
}
