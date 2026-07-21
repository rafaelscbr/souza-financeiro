import { useMemo, useState } from 'react'
import {
  TrendingUp,
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
import { Tip } from '@/components/ui/Tip'
import { Spinner } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Field'
import {
  firstDayOfMonth,
  inScope,
  pendingPayables,
  pendingReceivables,
  realizedCash,
  type CashItem,
} from '@/lib/finance'
import { formatCurrency, formatDateShort, formatMonthYear, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

type RangeKey = 'mes' | '30d' | '90d' | 'vencidas' | 'tudo' | 'custom'
type Tab = 'receber' | 'pagar'

/** Janela [início, fim] de vencimento conforme o filtro. '' = sem limite. */
function rangeWindow(key: RangeKey, period: Date, custom: { start: string; end: string }): [string, string] {
  const today = new Date()
  const iso = (d: Date) => toDateOnly(d)
  switch (key) {
    case 'mes': {
      const first = firstDayOfMonth(period)
      const last = iso(new Date(period.getFullYear(), period.getMonth() + 1, 0))
      return [first, last]
    }
    case '30d':
      return [iso(today), iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30))]
    case '90d':
      return [iso(today), iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90))]
    case 'vencidas':
      return ['', iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))]
    case 'custom':
      return [custom.start || '', custom.end || '9999-12-31']
    case 'tudo':
    default:
      return ['', '9999-12-31']
  }
}

export function FluxoCaixaPage() {
  const {
    businessTransactions: transactions,
    contacts,
    businessCompanies: companies,
    scopeCompanyId,
    activeCompany,
    period,
  } = useAppData()
  const today = toDateOnly(new Date())
  const [tab, setTab] = useState<Tab>('receber')
  const [range, setRange] = useState<RangeKey>('mes')
  const [custom, setCustom] = useState({ start: '', end: '' })

  const scoped = useMemo(
    () => transactions.filter((t) => inScope(t, scopeCompanyId)),
    [transactions, scopeCompanyId],
  )

  const realized = useMemo(() => realizedCash(scoped, today), [scoped, today])
  const allReceivables = useMemo(() => pendingReceivables(scoped), [scoped])
  const allPayables = useMemo(() => pendingPayables(scoped), [scoped])

  const [winStart, winEnd] = rangeWindow(range, period, custom)
  const inWindow = (i: CashItem) => i.date >= winStart && i.date <= winEnd

  const receivables = allReceivables.filter(inWindow)
  const payables = allPayables.filter(inWindow)

  const totalReceivable = receivables.reduce((s, i) => s + i.amount, 0)
  const totalPayable = payables.reduce((s, i) => s + i.amount, 0)
  const endBalance = realized + totalReceivable - totalPayable

  // Vencidas fora da janela atual — para não esconder atraso quando filtra o mês.
  const overdueOutside = useMemo(() => {
    if (range === 'tudo' || range === 'vencidas') return { count: 0, amount: 0 }
    const out = [...allReceivables, ...allPayables].filter((i) => i.date < today && !inWindow(i))
    return { count: out.length, amount: out.reduce((s, i) => s + i.amount, 0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReceivables, allPayables, today, winStart, winEnd, range])

  const scopeName = activeCompany ? activeCompany.name : 'Grupo'
  const labelOf = (item: CashItem) => {
    const contact = contacts.find((c) => c.id === item.tx.contact_id)?.name
    const company = companies.find((c) => c.id === item.tx.company_id)?.name
    return [item.tx.category, contact, !activeCompany ? company : null].filter(Boolean).join(' · ')
  }

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: 'mes', label: formatMonthYear(period) },
    { key: '30d', label: 'Próx. 30 dias' },
    { key: '90d', label: 'Próx. 90 dias' },
    { key: 'vencidas', label: 'Vencidas' },
    { key: 'tudo', label: 'Tudo' },
    { key: 'custom', label: 'Escolher datas' },
  ]

  const items = tab === 'receber' ? receivables : payables
  const total = tab === 'receber' ? totalReceivable : totalPayable

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-content">
          Contas a receber e a pagar
          <Tip label="Como ler esta tela" align="start">
            Os números respondem ao <strong className="text-content">período que você escolher</strong>
            abaixo. No padrão, mostra o mês em foco — troque o filtro para ver os próximos dias, só
            as vencidas, ou todo o pipeline.
          </Tip>
        </h1>
        <p className="text-sm text-content-faint">{scopeName}</p>
      </div>

      {/* Filtro de período — o controle principal da tela */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Período">
        {RANGES.map((r) => {
          const active = range === r.key
          return (
            <button
              key={r.key}
              role="tab"
              aria-selected={active}
              onClick={() => setRange(r.key)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-transparent bg-emerald text-white'
                  : 'border-line bg-surface text-content-muted hover:bg-surface-2 hover:text-content',
              )}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <span className="text-sm text-content-muted">De</span>
          <Input
            type="date"
            className="w-auto"
            value={custom.start}
            onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
          />
          <span className="text-sm text-content-muted">até</span>
          <Input
            type="date"
            className="w-auto"
            value={custom.end}
            onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
          />
        </div>
      )}

      {/* KPIs do período selecionado */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Caixa hoje" value={formatCurrency(realized)} tone={realized >= 0 ? 'neutral' : 'negative'} icon={<Wallet className="h-4 w-4" />} hint="saldo realizado até hoje" />
        <KpiCard label="A receber no período" value={formatCurrency(totalReceivable)} tone="positive" icon={<ArrowDownCircle className="h-4 w-4" />} hint={`${receivables.length} conta(s)`} />
        <KpiCard label="A pagar no período" value={formatCurrency(totalPayable)} tone="negative" icon={<ArrowUpCircle className="h-4 w-4" />} hint={`${payables.length} conta(s)`} />
        <KpiCard label="Saldo ao fim do período" value={formatCurrency(endBalance)} tone={endBalance >= 0 ? 'accent' : 'negative'} icon={<TrendingUp className="h-4 w-4" />} hint="caixa + a receber − a pagar" />
      </div>

      {/* Aviso de vencidas fora da janela */}
      {overdueOutside.count > 0 && (
        <button
          onClick={() => setRange('vencidas')}
          className="flex w-full items-start gap-2.5 rounded-xl border border-critical/25 bg-critical/5 px-4 py-3 text-left transition-colors hover:bg-critical/10"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
          <span className="text-sm text-content-muted">
            Você tem <strong className="text-critical">{overdueOutside.count} conta(s) vencida(s)</strong>{' '}
            fora deste período, somando {formatCurrency(overdueOutside.amount)}.{' '}
            <span className="font-medium text-critical">Ver vencidas →</span>
          </span>
        </button>
      )}

      {/* Abas A receber / A pagar */}
      <div className="flex gap-1.5" role="tablist" aria-label="Tipo">
        {(['receber', 'pagar'] as Tab[]).map((t) => {
          const active = tab === t
          const n = t === 'receber' ? receivables.length : payables.length
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                active ? 'border-transparent bg-content text-white' : 'border-line bg-surface text-content-muted hover:bg-surface-2',
              )}
            >
              {t === 'receber' ? 'A receber' : 'A pagar'}
              <span className={cn('rounded-full px-1.5 text-[10px] font-bold', active ? 'bg-white/20' : 'bg-surface-3')}>{n}</span>
            </button>
          )
        })}
      </div>

      {/* Total do período + lista */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
        <span className="text-sm font-medium text-content-muted">
          Total {tab === 'receber' ? 'a receber' : 'a pagar'} · {rangeLabel(range, period)}
        </span>
        <span className={cn('tnum text-lg font-bold', tab === 'receber' ? 'text-income' : 'text-expense')}>
          {formatCurrency(total)}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={tab === 'receber' ? <ArrowDownCircle className="h-7 w-7" /> : <ArrowUpCircle className="h-7 w-7" />}
          title={`Nada ${tab === 'receber' ? 'a receber' : 'a pagar'} neste período`}
          description="Troque o filtro de período acima para ver outra janela."
        />
      ) : (
        <Section title={tab === 'receber' ? 'Contas a receber' : 'Contas a pagar'} bodyClassName="pt-1">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <CashRow key={item.tx.id} item={item} today={today} direction={tab === 'receber' ? 'in' : 'out'} label={labelOf(item)} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function rangeLabel(range: RangeKey, period: Date): string {
  switch (range) {
    case 'mes': return formatMonthYear(period)
    case '30d': return 'próximos 30 dias'
    case '90d': return 'próximos 90 dias'
    case 'vencidas': return 'vencidas'
    case 'custom': return 'período escolhido'
    default: return 'todo o período'
  }
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
        {overdue && <span className="text-[10px] font-medium text-critical">{daysLate}d atraso</span>}
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
          direction === 'in' ? 'border-income/25 text-income hover:bg-income/10' : 'border-expense/25 text-expense hover:bg-expense/10',
        )}
        title={direction === 'in' ? 'Marcar como recebido hoje' : 'Marcar como pago hoje'}
      >
        {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        {direction === 'in' ? 'Recebi' : 'Paguei'}
      </button>
    </li>
  )
}
