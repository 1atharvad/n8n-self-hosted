import { useEffect, useRef } from 'react'
import { useLogStore } from '@/store/useLogStore'
import { LogRow } from '@/components/LogRow'
import { ArrowDown } from 'lucide-react'

export const LogTable = () => {
  const logs = useLogStore((s) => s.logs)
  const autoScroll = useLogStore((s) => s.autoScroll)
  const setAutoScroll = useLogStore((s) => s.setAutoScroll)

  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const onScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAutoScroll(atBottom)
  }

  const scrollToBottom = () => {
    setAutoScroll(true)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="relative flex-1 overflow-y-auto overflow-x-auto py-1"
    >
      {logs.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No logs found for the selected filters.
        </p>
      ) : (
        logs.map((entry, i) => <LogRow key={i} entry={entry} />)
      )}

      {!autoScroll && (
        <div className="sticky bottom-6 flex justify-center pointer-events-none">
          <button
            onClick={scrollToBottom}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs shadow-lg hover:opacity-90 transition-opacity"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Scroll to bottom
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
