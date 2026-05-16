import { useLogStore } from '@/store/useLogStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { TimeRange } from '@/types'
import { Select, MultiSelect, SearchInput } from 'advi-ui'

const LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: 'error', label: 'ERROR' },
  { value: 'warning', label: 'WARNING' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
]

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '15m', label: 'Last 15 min' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
]

const LIMIT_OPTIONS = [
  { value: '100', label: '100 lines' },
  { value: '500', label: '500 lines' },
  { value: '1000', label: '1000 lines' },
  { value: '2000', label: '2000 lines' },
]

export const Toolbar = () => {
  const allLabels = useLogStore((s) => s.labels)
  const visibleContainers = useSettingsStore((s) => s.visibleContainers)
  const labels =
    visibleContainers.length > 0
      ? allLabels.filter((l) => visibleContainers.includes(l))
      : allLabels
  const filters = useLogStore((s) => s.filters)
  const setSearch = useLogStore((s) => s.setSearch)

  const setContainers = useLogStore((s) => s.setContainers)
  const setLevel = useLogStore((s) => s.setLevel)
  const setRange = useLogStore((s) => s.setRange)
  const setLimit = useLogStore((s) => s.setLimit)

  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 bg-card border-b border-border items-center shrink-0">
      <MultiSelect
        placeholder="All containers"
        options={labels.map((l) => ({ value: l, label: l }))}
        value={filters.containers}
        onChange={setContainers}
        className="w-full"
      />
      <Select options={LEVEL_OPTIONS} value={filters.level} onChange={setLevel} />
      <Select
        options={RANGE_OPTIONS}
        value={filters.range}
        onChange={(v) => setRange(v as TimeRange)}
      />
      <Select
        options={LIMIT_OPTIONS}
        value={String(filters.limit)}
        onChange={(v) => setLimit(Number(v))}
      />

      <SearchInput
        defaultValue={filters.search}
        placeholder="Search logs…"
        debounce={400}
        onSearch={setSearch}
        onClear={() => setSearch('')}
        className="flex-1 min-w-[160px]"
      />
    </div>
  )
}
