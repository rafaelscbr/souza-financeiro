import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Tip } from '@/components/ui/Tip'
import { cn } from '@/lib/utils'
import type { HealthReport } from '@/lib/health'
import type { HealthStatus } from '@/types'

const STATUS_STYLE: Record<HealthStatus, { chip: string; bar: string; icon: typeof CheckCircle2 }> = {
  healthy: { chip: 'bg-healthy/12 text-healthy border-healthy/25', bar: 'bg-healthy', icon: CheckCircle2 },
  warning: { chip: 'bg-warning/12 text-warning border-warning/25', bar: 'bg-warning', icon: AlertTriangle },
  critical: { chip: 'bg-critical/12 text-critical border-critical/25', bar: 'bg-critical', icon: XCircle },
}

/**
 * Saúde com o porquê à mostra. Um selo verde/amarelo/vermelho sem
 * explicação não ajuda ninguém a decidir o que fazer.
 */
export function HealthPanel({ report }: { report: HealthReport }) {
  const style = STATUS_STYLE[report.status]
  const Icon = style.icon

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
              style.chip,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {report.headline}
          </span>
          <Tip label="Como a saúde é calculada">
            Quatro fatores, com pesos diferentes:{' '}
            <strong className="text-content">fôlego de caixa (35%)</strong>,{' '}
            <strong className="text-content">lucratividade (30%)</strong>,{' '}
            <strong className="text-content">contas vencidas (20%)</strong> e{' '}
            <strong className="text-content">custo de comissão (15%)</strong>.
            <span className="mt-1.5 block">
              Caixa pesa mais que margem de propósito: falta de caixa mata mais rápido que margem
              apertada.
            </span>
          </Tip>
        </div>
        <span className="tnum shrink-0 text-2xl font-bold text-content">{report.score}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn('h-full rounded-full transition-all', style.bar)}
          style={{ width: `${Math.max(2, report.score)}%` }}
        />
      </div>

      <ul className="mt-3 space-y-2">
        {report.factors
          .filter((f) => f.score >= 0)
          .map((f) => {
            const fs = STATUS_STYLE[f.status]
            const FIcon = fs.icon
            return (
              <li key={f.id} className="flex gap-2">
                <FIcon
                  className={cn(
                    'mt-0.5 h-3.5 w-3.5 shrink-0',
                    f.status === 'healthy'
                      ? 'text-healthy'
                      : f.status === 'warning'
                        ? 'text-warning'
                        : 'text-critical',
                  )}
                />
                <p className="text-xs text-content-muted">
                  <span className="font-semibold text-content">{f.label}:</span> {f.detail}
                </p>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
