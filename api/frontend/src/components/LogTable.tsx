import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLogStore } from '@/store/useLogStore'
import { LogRow } from '@/components/LogRow'
import { ArrowDown } from 'lucide-react'

export const LogTable = () => {
  const logs = useLogStore((s) => s.logs)
  const autoScroll = useLogStore((s) => s.autoScroll)
  const setAutoScroll = useLogStore((s) => s.setAutoScroll)

  const containerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 22,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 15,
  })

  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' })
    }
  }, [logs.length, autoScroll])

  const onScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAutoScroll(atBottom)
  }

  const scrollToBottom = () => {
    setAutoScroll(true)
    virtualizer.scrollToIndex(logs.length - 1, { align: 'end' })
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Sticky column headers */}
      <div className="grid grid-cols-[11ch_15ch_5rem_1fr] gap-x-3 px-3 py-1.5 border-b border-border bg-card shrink-0">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Time</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Container</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Level</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Message</span>
      </div>

      {/* Scrollable list */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overflow-x-auto"
      >
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No logs found for the selected filters.
          </p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: virtualRow.start, width: '100%' }}
              >
                <LogRow entry={logs[virtualRow.index]} />
              </div>
            ))}
          </div>
        )}
      </div>

      {!autoScroll && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <button
            onClick={scrollToBottom}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs shadow-lg hover:opacity-90 transition-opacity"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Scroll to bottom
          </button>
        </div>
      )}
    </div>
  )
}
