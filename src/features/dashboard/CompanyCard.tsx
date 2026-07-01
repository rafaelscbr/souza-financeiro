import { ArrowRight } from 'lucide-react'
import { HealthBadge } from '@/components/ui/HealthBadge'
import { companyDisplayColor } from '@/assets/companies'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { Kpis } from '@/lib/finance'
import { cn } from '@/lib/utils'
import type { Company, HealthStatus } from '@/types'

export function CompanyCard({
  company,
  kpis,
  health,
  onClick,
}: {
  company: Company
  kpis: Kpis
  health: HealthStatus
  onClick: () => void
}) {
  const color = companyDisplayColor(company.slug, company.brand_color, company.accent_color)

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-content-faint/40 focus-visible:border-content-faint/40"
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden />

      <div className="mb-3 flex items-start justify-between gap-2 pl-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <span className="text-sm font-semibold text-content">{company.name}</span>
        </div>
        <HealthBadge status={health} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pl-1">
        <Metric label="Receita" value={formatCurrency(kpis.revenue)} className="text-income" />
        <Metric label="Despesas" value={formatCurrency(kpis.totalExpense)} className="text-expense" />
        <Metric
          label="Lucro líq."
          value={formatCurrency(kpis.netProfit)}
          className={kpis.netProfit >= 0 ? 'text-content' : 'text-expense'}
        />
        <Metric label="Margem" value={formatPercent(kpis.netMargin)} className="text-content" />
      </div>

      <div className="mt-3 flex items-center gap-1 pl-1 text-xs font-medium text-content-faint transition-colors group-hover:text-content-muted">
        Ver detalhes
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

function Metric({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-content-faint">{label}</p>
      <p className={cn('tnum text-base font-bold', className)}>{value}</p>
    </div>
  )
}
