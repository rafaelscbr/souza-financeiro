import { cn } from '@/lib/utils'
import type { HealthStatus } from '@/types'

const config: Record<HealthStatus, { label: string; dot: string; text: string; bg: string }> = {
  healthy: {
    label: 'Saudável',
    dot: 'bg-healthy',
    text: 'text-healthy',
    bg: 'bg-healthy/10 border-healthy/20',
  },
  warning: {
    label: 'Atenção',
    dot: 'bg-warning',
    text: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
  },
  critical: {
    label: 'Crítico',
    dot: 'bg-critical',
    text: 'text-critical',
    bg: 'bg-critical/10 border-critical/20',
  },
}

export function HealthBadge({
  status,
  className,
}: {
  status: HealthStatus
  className?: string
}) {
  const c = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        c.bg,
        c.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} aria-hidden />
      {c.label}
    </span>
  )
}
