import { type ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Tip } from './Tip'
import { Sparkline } from './Sparkline'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  hint?: ReactNode
  icon?: ReactNode
  /** Explicação didática do indicador, aberta pelo ícone de ajuda. */
  tip?: ReactNode
  /** Cor do valor: 'positive' | 'negative' | 'neutral' | 'accent' */
  tone?: 'positive' | 'negative' | 'neutral' | 'accent'
  /** Série dos últimos meses para o mini-gráfico de tendência. */
  series?: number[]
  /** Rótulos de cada ponto da série (mês + valor), para o toque no sparkline. */
  seriesLabels?: string[]
  /** Clique num mês do sparkline — para navegar até aquele período. */
  onSeriesSelect?: (index: number) => void
  /**
   * Variação vs período anterior, em fração (0.12 = +12%). Mostra ▲/▼.
   * `higherIsBetter=false` inverte a cor (ex.: despesa que sobe é ruim).
   */
  deltaPct?: number
  higherIsBetter?: boolean
  className?: string
}

const tones = {
  positive: 'text-income',
  negative: 'text-expense',
  neutral: 'text-content',
  accent: 'text-gold',
}

const sparkColor: Record<NonNullable<KpiCardProps['tone']>, string> = {
  positive: '#059669',
  negative: '#DC2626',
  neutral: '#64748B',
  accent: '#B08900',
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tip,
  tone = 'neutral',
  series,
  seriesLabels,
  onSeriesSelect,
  deltaPct,
  higherIsBetter = true,
  className,
}: KpiCardProps) {
  const showDelta = deltaPct != null && Number.isFinite(deltaPct) && Math.abs(deltaPct) >= 0.005
  const up = (deltaPct ?? 0) >= 0
  const good = up === higherIsBetter
  const hasSpark = series != null && series.filter((v) => Number.isFinite(v)).length >= 2

  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-content-faint">
          {label}
          {tip && <Tip label={`O que é ${label}`} align="start">{tip}</Tip>}
        </span>
        {icon && <span className="text-content-faint">{icon}</span>}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('tnum text-2xl font-bold leading-tight sm:text-[1.7rem]', tones[tone])}>
            {value}
          </p>
          {showDelta && (
            <span
              className={cn(
                'tnum mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold',
                good ? 'text-income' : 'text-expense',
              )}
            >
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(deltaPct! * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
              <span className="font-normal text-content-faint">vs mês anterior</span>
            </span>
          )}
        </div>
        {hasSpark && (
          <div className="shrink-0 pb-1">
            <Sparkline
              data={series!}
              color={sparkColor[tone]}
              labels={seriesLabels}
              onSelect={onSeriesSelect}
            />
          </div>
        )}
      </div>

      {hint && <div className="mt-1 text-xs text-content-muted">{hint}</div>}
    </div>
  )
}
