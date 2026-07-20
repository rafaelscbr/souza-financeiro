import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  inScope,
  lastNMonths,
  monthElapsedFraction,
  monthlySeries,
  pendingPayables,
  pendingReceivables,
  project,
  realizedCash,
  type CashItem,
  type Projection,
  type Trend,
} from '@/lib/finance'
import { formatCurrency, formatDate, formatMonthYear, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

export function FluxoCaixaPage() {
  const {
    businessTransactions: transactions,
    contacts,
    businessCompanies: companies,
    scopeCompanyId,
    activeCompany,
    period,
    regime,
  } = useAppData()
  const today = toDateOnly(new Date())

  const scoped = useMemo(
    () => transactions.filter((t) => inScope(t, scopeCompanyId)),
    [transactions, scopeCompanyId],
  )

  const realized = useMemo(() => realizedCash(scoped, today), [scoped, today])
  const receivables = useMemo(() => pendingReceivables(scoped), [scoped])
  const payables = useMemo(() => pendingPayables(scoped), [scoped])

  const totalReceivable = receivables.reduce((s, i) => s + i.amount, 0)
  const totalPayable = payables.reduce((s, i) => s + i.amount, 0)
  const projectedBalance = realized + totalReceivable - totalPayable

  // linha do tempo com saldo acumulado
  const timeline = useMemo(() => {
    const merged = [...receivables, ...payables].sort((a, b) => (a.date < b.date ? -1 : 1))
    let running = realized
    return merged.map((item) => {
      running += item.direction === 'in' ? item.amount : -item.amount
      return { item, running }
    })
  }, [receivables, payables, realized])

  const scopeName = activeCompany ? activeCompany.name : 'Grupo'
  const labelOf = (item: CashItem) => {
    const contact = contacts.find((c) => c.id === item.tx.contact_id)?.name
    const company = companies.find((c) => c.id === item.tx.company_id)?.name
    return [item.tx.category, contact, !activeCompany ? company : null].filter(Boolean).join(' · ')
  }

  // projeções do mês (escopo atual)
  const projections = useMemo(() => {
    const months = lastNMonths(period, 4)
    const series = monthlySeries(transactions, scopeCompanyId, months, regime)
    const history = series.slice(0, 3)
    const current = series[3]
    const elapsed = monthElapsedFraction(period)
    return {
      elapsed,
      revenue: project(current.revenue, elapsed, history.map((h) => h.revenue)),
      profit: project(current.profit, elapsed, history.map((h) => h.profit)),
    }
  }, [transactions, scopeCompanyId, period, regime])

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-content">Fluxo de Caixa</h1>
        <p className="text-sm text-content-faint">{scopeName} · caixa realizado e futuro</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Caixa realizado" value={formatCurrency(realized)} tone={realized >= 0 ? 'neutral' : 'negative'} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="A receber" value={formatCurrency(totalReceivable)} tone="positive" icon={<ArrowDownCircle className="h-4 w-4" />} hint={`${receivables.length} conta(s)`} />
        <KpiCard label="A pagar" value={formatCurrency(totalPayable)} tone="negative" icon={<ArrowUpCircle className="h-4 w-4" />} hint={`${payables.length} conta(s)`} />
        <KpiCard label="Saldo projetado" value={formatCurrency(projectedBalance)} tone={projectedBalance >= 0 ? 'accent' : 'negative'} icon={<TrendingUp className="h-4 w-4" />} hint="caixa futuro" />
      </div>

      {/* Projeções do mês */}
      <Section title={`Projeção de ${formatMonthYear(period)}`} subtitle={`${Math.round(projections.elapsed * 100)}% do mês decorrido · base nos últimos 3 meses`}>
        <div className="grid grid-cols-2 gap-4">
          <ProjectionMetric label="Receita projetada" projection={projections.revenue} />
          <ProjectionMetric label="Lucro projetado" projection={projections.profit} />
        </div>
      </Section>

      {/* Linha do tempo de caixa futuro */}
      <Section title="Próximos vencimentos" subtitle="Contas a receber e a pagar por data, com saldo acumulado">
        {timeline.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-7 w-7" />}
            title="Sem contas futuras"
            description="Lançamentos marcados como 'a receber' ou 'a pagar' aparecem aqui na data prevista."
          />
        ) : (
          <ul className="divide-y divide-line">
            {timeline.map(({ item, running }, idx) => (
              <li key={idx} className="flex items-center gap-3 py-3">
                <div className="w-16 shrink-0">
                  <span className="tnum text-xs font-medium text-content-muted">{formatDate(item.date)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content">{labelOf(item)}</p>
                  <p className="text-[11px] text-content-faint">
                    {item.direction === 'in' ? 'A receber' : 'A pagar'}
                  </p>
                </div>
                <span className={cn('tnum shrink-0 text-sm font-semibold', item.direction === 'in' ? 'text-income' : 'text-expense')}>
                  {item.direction === 'in' ? '+' : '−'} {formatCurrency(item.amount)}
                </span>
                <span className="tnum hidden w-28 shrink-0 text-right text-xs text-content-muted sm:block">
                  saldo {formatCurrency(running)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function ProjectionMetric({ label, projection }: { label: string; projection: Projection }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-content-faint">{label}</span>
        <TrendPill trend={projection.trend} />
      </div>
      <p className="tnum mt-1.5 text-xl font-bold text-content">{formatCurrency(projection.projected)}</p>
      <p className="mt-1 text-xs text-content-faint">
        Realizado: <span className="tnum">{formatCurrency(projection.current)}</span> · Média 3m:{' '}
        <span className="tnum">{formatCurrency(projection.historicalAvg)}</span>
      </p>
    </div>
  )
}

const trendConfig: Record<Trend, { icon: typeof Minus; label: string; className: string }> = {
  up: { icon: TrendingUp, label: 'Crescendo', className: 'text-income' },
  flat: { icon: Minus, label: 'Estável', className: 'text-content-muted' },
  down: { icon: TrendingDown, label: 'Caindo', className: 'text-expense' },
}

function TrendPill({ trend }: { trend: Trend }) {
  const c = trendConfig[trend]
  const Icon = c.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', c.className)}>
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  )
}
