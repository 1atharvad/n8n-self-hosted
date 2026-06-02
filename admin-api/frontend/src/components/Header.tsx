import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogStore } from '@/store/useLogStore'
import { Button } from 'advi-ui'
import { Pause, Play, Activity } from 'lucide-react'

interface HeaderProps {
  title?: string
  actions?: ReactNode
  showLogControls?: boolean
}

export const Header = ({ title, actions, showLogControls = false }: HeaderProps) => {
  const navigate = useNavigate()
  const loading = useLogStore((s) => s.loading)
  const lastRefresh = useLogStore((s) => s.lastRefresh)
  const logs = useLogStore((s) => s.logs)
  const paused = useLogStore((s) => s.paused)
  const togglePause = useLogStore((s) => s.togglePause)

  return (
    <header className="dark text-foreground flex items-center justify-between px-4 bg-[hsl(var(--chrome))] border-b border-border shrink-0 min-h-[52px]">
      <div className="flex items-center gap-2.5">
        <Activity className="h-4 w-4 text-primary shrink-0" />
        <button
          onClick={() => navigate('/dashboard')}
          className="font-semibold text-sm tracking-wide hover:text-primary transition-colors"
        >
          Admin Panel
        </button>
        {title && (
          <>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-sm text-muted-foreground">{title}</span>
          </>
        )}
        {lastRefresh && (
          <span className="text-[11px] text-muted-foreground">
            {loading ? 'Refreshing…' : `Updated ${lastRefresh.toLocaleTimeString()}`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions !== undefined ? (
          actions
        ) : showLogControls ? (
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
        ) : null}
      </div>
    </header>
  )
}
