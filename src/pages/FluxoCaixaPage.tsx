import { useMemo, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
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
import { formatCurrency, formatDate, formatDateShort, formatMonthYear, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

type Tab = 'receber' | 'pagar' | 'linha'

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
  const [tab, setTab] = useState<Tab>('receber')

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

  const overdueIn = receivables.filter((i) => i.date < today)
  const overdueOut = payables.filter((i) => i.date < today)

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

  const projections = useMemo(() => {
    const months = lastNMonths(period, 4)
    const series = monthlySeries(transactions, scopeCompanyId, months, regime, companies)
    const history = series.slice(0, 3)
    const current = series[3]
    const elapsed = monthElapsedFraction(period)
    return {
      elapsed,
      revenue: project(current.revenue, elapsed, history.map((h) => h.revenue)),
      profit: project(current.profit, elapsed, history.map((h) => h.profit)),
    }
  }, [transactions, scopeCompanyId, period, regime, companies])

  const TABS: { value: Tab; label: string; count: number; overdue: number }[] = [
    { value: 'receber', label: 'A receber', count: receivables.length, overdue: overdueIn.length },
    { value: 'pagar', label: 'A pagar', count: payables.length, overdue: overdueOut.length },
    { value: 'linha', label: 'Linha do tempo', count: timeline.length, overdue: 0 },
  ]

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-content">Contas a receber e a pagar</h1>
        <p className="text-sm text-content-faint">{scopeName} · compromissos em aberto</p>
      </div>

      {/* Visão geral */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Caixa realizado" value={formatCurrency(realized)} tone={realized >= 0 ? 'neutral' : 'negative'} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="A receber" value={formatCurrency(totalReceivable)} tone="positive" icon={<ArrowDownCircle className="h-4 w-4" />} hint={`${receivables.length} conta(s)`} />
        <KpiCard label="A pagar" value={formatCurrency(totalPayable)} tone="negative" icon={<ArrowUpCircle className="h-4 w-4" />} hint={`${payables.length} conta(s)`} />
        <KpiCard label="Saldo projetado" value={formatCurrency(projectedBalance)} tone={projectedBalance >= 0 ? 'accent' : 'negative'} icon={<TrendingUp className="h-4 w-4" />} hint="caixa + a receber − a pagar" />
      </div>

      {/* Abas — separa a receber de a pagar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Contas">
        {TABS.map((t) => {
          const active = tab === t.value
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-transparent bg-content text-white'
                  : 'border-line bg-surface text-content-muted hover:bg-surface-2 hover:text-content',
              )}
            >
              {t.label}
              <span className={cn('rounded-full px-1.5 text-[10px] font-bold', active ? 'bg-white/20' : 'bg-surface-3')}>
                {t.count}
              </span>
              {t.overdue > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-critical/15 px-1 text-[10px] font-bold text-critical">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {t.overdue}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'receber' && (
        <CashList items={receivables} today={today} direction="in" labelOf={labelOf} emptyText="Nenhuma conta a receber em aberto." />
      )}
      {tab === 'pagar' && (
        <CashList items={payables} today={today} direction="out" labelOf={labelOf} emptyText="Nenhuma conta a pagar em aberto." />
      )}
      {tab === 'linha' && (
        <>
          <Section title={`Projeção de ${formatMonthYear(period)}`} subtitle={`${Math.round(projections.elapsed * 100)}% do mês decorrido · base nos últimos 3 meses`}>
            <div className="grid grid-cols-2 gap-4">
              <ProjectionMetric label="Receita projetada" projection={projections.revenue} />
              <ProjectionMetric label="Lucro projetado" projection={projections.profit} />
            </div>
          </Section>
          <Section title="Próximos vencimentos" subtitle="Entradas e saídas por data, com saldo acumulado">
            {timeline.length === 0 ? (
              <EmptyState icon={<Wallet className="h-7 w-7" />} title="Sem contas futuras" description="Lançamentos 'a receber' ou 'a pagar' aparecem aqui na data prevista." />
            ) : (
              <ul className="divide-y divide-line">
                {timeline.map(({ item, running }, idx) => (
                  <li key={idx} className="flex items-center gap-3 py-3">
                    <div className="w-16 shrink-0">
                      <span className="tnum text-xs font-medium text-content-muted">{formatDate(item.date)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-content">{labelOf(item)}</p>
                      <p className="text-[11px] text-content-faint">{item.direction === 'in' ? 'A receber' : 'A pagar'}</p>
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
        </>
      )}
    </div>
  )
}

function CashList({
  items,
  today,
  direction,
  labelOf,
  emptyText,
}: {
  items: CashItem[]
  today: string
  direction: 'in' | 'out'
  labelOf: (i: CashItem) => string
  emptyText: string
}) {
  const overdue = items.filter((i) => i.date < today)
  const upcoming = items.filter((i) => i.date >= today)
  const total = items.reduce((s, i) => s + i.amount, 0)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={direction === 'in' ? <ArrowDownCircle className="h-7 w-7" /> : <ArrowUpCircle className="h-7 w-7" />}
        title={emptyText}
        description="Marque lançamentos como pendentes para acompanhá-los aqui."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
        <span className="text-sm font-medium text-content-muted">
          Total {direction === 'in' ? 'a receber' : 'a pagar'}
        </span>
        <span className={cn('tnum text-lg font-bold', direction === 'in' ? 'text-income' : 'text-expense')}>
          {formatCurrency(total)}
        </span>
      </div>

      {overdue.length > 0 && (
        <Section
          title="Vencidas"
          subtitle={`${overdue.length} conta(s) — precisam de atenção`}
          bodyClassName="pt-1"
        >
          <ul className="divide-y divide-line">
            {overdue.map((item) => (
              <CashRow key={item.tx.id} item={item} today={today} direction={direction} label={labelOf(item)} />
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="A vencer"
        subtitle={upcoming.length === 0 ? 'Nada a vencer' : `${upcoming.length} conta(s)`}
        bodyClassName="pt-1"
      >
        {upcoming.length === 0 ? (
          <p className="py-2 text-sm text-content-muted">Tudo que resta já está vencido.</p>
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map((item) => (
              <CashRow key={item.tx.id} item={item} today={today} direction={direction} label={labelOf(item)} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function CashRow({
  item,
  today,
  direction,
  label,
}: {
  item: CashItem
  today: string
  direction: 'in' | 'out'
  label: string
}) {
  const { settleTransaction } = useAppData()
  const [busy, setBusy] = useState(false)
  const overdue = item.date < today
  const daysLate = overdue
    ? Math.round((new Date(today).getTime() - new Date(item.date).getTime()) / 86400000)
    : 0

  async function settle() {
    setBusy(true)
    try {
      // Baixa em um clique: liquida na data de hoje. A conta pode ser
      // classificada depois em Contas; aqui o foco é dar baixa rápido.
      await settleTransaction(item.tx.id, null, today)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="w-14 shrink-0 text-center">
        <span className={cn('tnum block text-xs font-medium', overdue ? 'text-critical' : 'text-content-muted')}>
          {formatDateShort(item.date)}
        </span>
        {overdue && <span className="text-[10px] font-medium text-critical">{daysLate}d</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content">{label}</p>
        {item.tx.description && <p className="truncate text-[11px] text-content-faint">{item.tx.description}</p>}
      </div>
      <span className={cn('tnum shrink-0 text-sm font-semibold', direction === 'in' ? 'text-income' : 'text-expense')}>
        {direction === 'in' ? '+' : '−'} {formatCurrency(item.amount)}
      </span>
      <button
        onClick={settle}
        disabled={busy}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
          direction === 'in'
            ? 'border-income/25 text-income hover:bg-income/10'
            : 'border-expense/25 text-expense hover:bg-expense/10',
        )}
        title={direction === 'in' ? 'Marcar como recebido hoje' : 'Marcar como pago hoje'}
      >
        {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        {direction === 'in' ? 'Recebi' : 'Paguei'}
      </button>
    </li>
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
