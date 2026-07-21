import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  TrendingDown,
  ShieldCheck,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Tip } from '@/components/ui/Tip'
import { CashForecastChart, type ForecastDatum } from './Charts'
import { cashForecast, forecastAlert, type ForecastMonth } from '@/lib/forecast'
import { inScope, realizedCash, type CashItem } from '@/lib/finance'
import { treasurySummary } from '@/lib/treasury'
import { formatCurrency, formatDateShort, formatMonthShort, formatMonthYear, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Previsão de caixa dos próximos meses a partir do que já está contratado.
 * O alerta de furo (saldo negativo) é o que o Rafael pediu: saber com
 * antecedência em que mês o caixa aperta. Clicar num mês abre as duplicatas.
 */
export function ForecastPanel({ months = 12 }: { months?: number }) {
  const { businessTransactions, accounts, transfers, contacts, businessCompanies, scopeCompanyId, activeCompany } =
    useAppData()
  const today = toDateOnly(new Date())
  const [selected, setSelected] = useState<string | null>(null)

  const scoped = useMemo(
    () => businessTransactions.filter((t) => inScope(t, scopeCompanyId)),
    [businessTransactions, scopeCompanyId],
  )

  // Caixa de partida: saldo real das contas quando houver; senão o realizado.
  const startingBalance = useMemo(() => {
    const scopedAccounts = accounts.filter(
      (a) => scopeCompanyId === null || a.company_id === scopeCompanyId,
    )
    if (scopedAccounts.length > 0) {
      return treasurySummary(scopedAccounts, scoped, transfers, today).total
    }
    return realizedCash(scoped, today)
  }, [accounts, transfers, scoped, scopeCompanyId, today])

  const forecast = useMemo(
    () => cashForecast(scoped, months, startingBalance),
    [scoped, months, startingBalance],
  )
  const alert = useMemo(() => forecastAlert(forecast), [forecast])

  const data: ForecastDatum[] = forecast.map((m) => ({
    label: formatMonthShort(m.date),
    monthKey: m.monthKey,
    saldo: m.endBalance,
    entra: m.inflow,
    sai: m.outflow,
    negativo: m.negativeBalance,
  }))

  const hasMovement = forecast.some((m) => m.inflow !== 0 || m.outflow !== 0)
  const selectedMonth = selected ? forecast.find((m) => m.monthKey === selected) ?? null : null

  const labelOf = (item: CashItem) => {
    const contact = contacts.find((c) => c.id === item.tx.contact_id)?.name
    const company = businessCompanies.find((c) => c.id === item.tx.company_id)?.name
    return [item.tx.category, contact, !activeCompany ? company : null].filter(Boolean).join(' · ')
  }

  return (
    <Section
      title="Previsão de caixa"
      subtitle={`Próximos ${months} meses · clique num mês para ver as duplicatas`}
      action={
        <Tip label="Como a previsão é calculada" align="end">
          Parte do seu <strong className="text-content">caixa de hoje</strong> e soma, mês a mês, o
          que está marcado como a receber e a pagar nas datas previstas. Clique numa barra para abrir
          exatamente quais contas compõem aquele mês.
        </Tip>
      }
    >
      {/* Alerta de furo de caixa */}
      {alert.firstNegative ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-critical/25 bg-critical/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
          <p className="text-sm text-content-muted">
            Seu caixa fica <strong className="text-critical">negativo em {formatMonthShort(alert.firstNegative.date)}</strong>{' '}
            ({formatCurrency(alert.firstNegative.endBalance)}). Antecipe recebimentos ou segure
            pagamentos antes disso.
          </p>
        </div>
      ) : alert.low && alert.deficitMonths.length > 0 ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-pending/25 bg-pending/5 px-4 py-3">
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
          <p className="text-sm text-content-muted">
            O caixa não fura, mas o ponto mais apertado é{' '}
            <strong className="text-content">{formatMonthShort(alert.low.date)}</strong> com{' '}
            {formatCurrency(alert.low.endBalance)}.{' '}
            {alert.deficitMonths.length} mês(es) saem mais do que entram.
          </p>
        </div>
      ) : hasMovement ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-healthy/25 bg-healthy/5 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-healthy" />
          <p className="text-sm text-content-muted">
            Caixa saudável no período — nenhum mês fecha no vermelho pelo que está contratado.
          </p>
        </div>
      ) : null}

      {hasMovement ? (
        <>
          <CashForecastChart data={data} onSelectMonth={setSelected} selectedKey={selected} />
          {selectedMonth && (
            <MonthDetail month={selectedMonth} labelOf={labelOf} today={today} onClose={() => setSelected(null)} />
          )}
        </>
      ) : (
        <p className="py-4 text-center text-sm text-content-muted">
          Sem contas a receber ou a pagar lançadas para projetar. Marque lançamentos como pendentes
          e a previsão se monta aqui.
        </p>
      )}
    </Section>
  )
}

/** Detalhamento das duplicatas do mês clicado no gráfico. */
function MonthDetail({
  month,
  labelOf,
  today,
  onClose,
}: {
  month: ForecastMonth
  labelOf: (i: CashItem) => string
  today: string
  onClose: () => void
}) {
  const receivables = [...month.receivables].sort((a, b) => (a.date < b.date ? -1 : 1))
  const payables = [...month.payables].sort((a, b) => (a.date < b.date ? -1 : 1))

  return (
    <div className="mt-4 animate-fade-in rounded-xl border border-line bg-surface-2/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-content">{formatMonthYear(month.date)}</h3>
          <p className="text-xs text-content-faint">
            Entra {formatCurrency(month.inflow)} · Sai {formatCurrency(month.outflow)} · Saldo ao fim{' '}
            <span className={month.endBalance < 0 ? 'text-critical' : 'text-content-muted'}>
              {formatCurrency(month.endBalance)}
            </span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-content-faint hover:bg-surface-2 hover:text-content"
          aria-label="Fechar detalhamento"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DuplicataList
          title="A receber"
          items={receivables}
          direction="in"
          labelOf={labelOf}
          today={today}
        />
        <DuplicataList
          title="A pagar"
          items={payables}
          direction="out"
          labelOf={labelOf}
          today={today}
        />
      </div>
    </div>
  )
}

function DuplicataList({
  title,
  items,
  direction,
  labelOf,
  today,
}: {
  title: string
  items: CashItem[]
  direction: 'in' | 'out'
  labelOf: (i: CashItem) => string
  today: string
}) {
  const total = items.reduce((s, i) => s + i.amount, 0)
  const Icon = direction === 'in' ? ArrowDownCircle : ArrowUpCircle

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
          <Icon className={cn('h-3.5 w-3.5', direction === 'in' ? 'text-income' : 'text-expense')} />
          {title}
        </span>
        <span className={cn('tnum text-sm font-bold', direction === 'in' ? 'text-income' : 'text-expense')}>
          {formatCurrency(total)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-1 text-xs text-content-faint">Nada {direction === 'in' ? 'a receber' : 'a pagar'} neste mês.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const overdue = item.date < today
            return (
              <li key={item.tx.id} className="flex items-center gap-2 py-2">
                <span className={cn('tnum w-12 shrink-0 text-[11px] font-medium', overdue ? 'text-critical' : 'text-content-muted')}>
                  {formatDateShort(item.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-content">{labelOf(item)}</span>
                <span className={cn('tnum shrink-0 text-xs font-semibold', direction === 'in' ? 'text-income' : 'text-expense')}>
                  {formatCurrency(item.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
