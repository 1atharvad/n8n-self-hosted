import { Badge } from 'advi-ui'

const LEVEL_VARIANT: Record<string, 'destructive' | 'outline' | 'secondary' | 'default'> = {
  error: 'destructive',
  critical: 'destructive',
  warning: 'outline',
  warn: 'outline',
  info: 'default',
  debug: 'secondary',
}

export function LevelBadge({ level }: { level: string }) {
  const key = level.toLowerCase()
  return (
    <Badge
      variant={LEVEL_VARIANT[key] ?? 'secondary'}
      size="sm"
      className="shrink-0 w-[4.5em] justify-center font-mono"
    >
      {level.toUpperCase().slice(0, 5)}
    </Badge>
  )
}
