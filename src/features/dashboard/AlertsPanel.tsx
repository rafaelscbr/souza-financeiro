import { AlertTriangle, Info, TriangleAlert, ShieldCheck } from 'lucide-react'
import type { Alert, AlertLevel } from '@/lib/finance'
import { cn } from '@/lib/utils'

const styles: Record<AlertLevel, { icon: typeof Info; box: string; iconColor: string }> = {
  critical: { icon: TriangleAlert, box: 'border-critical/25 bg-critical/8', iconColor: 'text-critical' },
  warning: { icon: AlertTriangle, box: 'border-warning/25 bg-warning/8', iconColor: 'text-warning' },
  info: { icon: Info, box: 'border-line bg-surface-2', iconColor: 'text-content-muted' },
}

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-healthy/20 bg-healthy/8 px-4 py-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-healthy" />
        <p className="text-sm text-content-muted">
          Tudo em ordem neste mês — nenhum alerta financeiro.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {alerts.map((a) => {
        const s = styles[a.level]
        const Icon = s.icon
        return (
          <li
            key={a.id}
            className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', s.box)}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.iconColor)} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-content">{a.title}</p>
              <p className="text-xs text-content-muted">{a.description}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
