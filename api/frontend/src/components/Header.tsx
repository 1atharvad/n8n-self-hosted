import { type ReactNode } from 'react'
import { useLogStore } from '@/store/useLogStore'
import { Button } from 'advi-ui'
import { Pause, Play } from 'lucide-react'

interface HeaderProps {
  title?: string
  actions?: ReactNode
}

export const Header = ({ title, actions }: HeaderProps) => {
  const loading = useLogStore((s) => s.loading)
  const lastRefresh = useLogStore((s) => s.lastRefresh)
  const logs = useLogStore((s) => s.logs)
  const paused = useLogStore((s) => s.paused)
  const togglePause = useLogStore((s) => s.togglePause)

  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0">
      <div className="flex items-center gap-2.5">
        <span className="text-lg text-primary leading-none">◈</span>
        <span className="font-bold text-[15px] tracking-wide">Admin Panel</span>
        {title ? (
          <>
            <span className="text-muted-foreground text-[15px]">/</span>
            <span className="text-[15px] text-muted-foreground">{title}</span>
          </>
        ) : (
          lastRefresh && (
            <span className="text-[11px] text-muted-foreground">
              {loading ? 'Refreshing…' : `Updated ${lastRefresh.toLocaleTimeString()}`}
            </span>
          )
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions !== undefined ? (
          actions
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{logs.length} entries</span>
            <Button variant={paused ? 'destructive' : 'outline'} size="sm" onClick={togglePause}>
              {paused ? (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
