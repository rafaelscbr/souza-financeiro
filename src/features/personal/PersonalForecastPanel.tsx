import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Tip } from '@/components/ui/Tip'
import { CashForecastChart } from '@/features/dashboard/Charts'
import { cardPayables, cardSummary, isCardAccount } from '@/lib/cards'
import { cashForecast, forecastAlert } from '@/lib/forecast'
import { monthKey, monthKeyOf } from '@/lib/finance'
import { treasurySummary } from '@/lib/treasury'
import { formatCurrency, formatDate, formatMonthShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

const HORIZON_MONTHS = 12

/**
 * Previsão de caixa pessoal — responde "posso trocar de carro em novembro?".
 *
 * O detalhe que faz diferença: as faturas de cartão entram como saída no
 * vencimento. Sem isso um parcelamento de 10× ficaria invisível e a previsão
 * diria que sobra dinheiro que já está comprometido.
 */
export function PersonalForecastPanel({ monthlyIncome }: { monthlyIncome: number }) {
  const { personalTransactions, accounts, transfers, personalCompany } = useAppData()
  const [selected, setSelected] = useState<string | null>(null)

  const personalAccounts = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )

  const today = toDateOnly(new Date())

  const forecast = useMemo(() => {
    const starting = treasurySummary(personalAccounts, personalTransactions, transfers, today).available
    const base = cashForecast(personalTransactions, HORIZON_MONTHS, starting)

    // Faturas de cartão viram saída no mês do vencimento.
    const summaries = personalAccounts.filter(isCardAccount).map((a) =>
      cardSummary(a, personalTransactions, transfers, today),
    )
    const payables = cardPayables(summaries)

    const byMonth = new Map<string, { amount: number; items: typeof payables }>()
    const firstKey = monthKey(new Date())
    for (const p of payables) {
      // Vencido cai no mês corrente — continua pesando no caixa.
      const k = monthKeyOf(p.dueDate) < firstKey ? firstKey : monthKeyOf(p.dueDate)
      const entry = byMonth.get(k)
      if (entry) {
        entry.amount += p.amount
        entry.items.push(p)
      } else {
        byMonth.set(k, { amount: p.amount, items: [p] })
      }
    }

    // Renda recorrente esperada (média do que as empresas te pagam), só nos
    // meses futuros — o mês corrente já tem o que entrou de verdade.
    let running = 0
    return base.map((m, i) => {
      const card = byMonth.get(m.monthKey)
      const expectedIn = i === 0 ? m.inflow : m.inflow + monthlyIncome
      const outflow = Math.round((m.outflow + (card?.amount ?? 0)) * 100) / 100
      const net = Math.round((expectedIn - outflow) * 100) / 100
      running = Math.round((( i === 0 ? m.endBalance - m.net : running) + net) * 100) / 100
      return {
        ...m,
        inflow: expectedIn,
        outflow,
        net,
        endBalance: running,
        isDeficit: net < 0,
        negativeBalance: running < 0,
        cardItems: card?.items ?? [],
      }
    })
  }, [personalAccounts, personalTransactions, transfers, monthlyIncome, today])

  const alert = useMemo(() => forecastAlert(forecast), [forecast])

  const hasAnything = forecast.some((m) => m.inflow > 0 || m.outflow > 0)
  if (!hasAnything) return null

  const chartData = forecast.map((m) => ({
    label: formatMonthShort(m.date),
    monthKey: m.monthKey,
    entra: m.inflow,
    sai: m.outflow,
    saldo: m.endBalance,
    negativo: m.negativeBalance,
  }))

  const selectedMonth = selected ? forecast.find((m) => m.monthKey === selected) : null

  return (
    <Section
      title="Previsão de caixa pessoal"
      subtitle={`Próximos ${HORIZON_MONTHS} meses · toque num mês para ver o detalhe`}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-content-muted">
          <CalendarClock className="h-3.5 w-3.5" />
          Inclui as faturas de cartão já contratadas
          <Tip label="O que entra nesta previsão">
            Suas contas a pagar pessoais, as faturas de cartão (inclusive as parcelas que ainda
            vão cair) e a média do que as empresas te pagam. É o que já está comprometido — não é
            projeção de gastos novos.
          </Tip>
        </div>

        {alert.firstNegative && (
          <div className="flex items-start gap-2.5 rounded-xl border border-expense/25 bg-expense/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-expense" />
            <p className="text-sm text-content-muted">
              <strong className="text-content">
                Seu caixa fica negativo em {formatMonthShort(alert.firstNegative.date)}
              </strong>{' '}
              ({formatCurrency(alert.firstNegative.endBalance)}). Dá tempo de ajustar — reduza um
              gasto fixo, antecipe uma entrada ou reforce a reserva antes disso.
            </p>
          </div>
        )}

        <CashForecastChart data={chartData} onSelectMonth={setSelected} selectedKey={selected} />

        {selectedMonth && (
          <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-content">
                {formatMonthShort(selectedMonth.date)}
              </h3>
              <span
                className={cn(
                  'tnum text-sm font-bold',
                  selectedMonth.endBalance >= 0 ? 'text-content' : 'text-expense',
                )}
              >
                Saldo {formatCurrency(selectedMonth.endBalance)}
              </span>
            </div>
            {selectedMonth.cardItems.length > 0 && (
              <ul className="space-y-1">
                {selectedMonth.cardItems.map((c, i) => (
                  <li
                    key={`${c.account.id}-${c.cycleMonth}-${i}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-content-muted">
                      Fatura {c.account.name}
                      {c.state === 'overdue' && (
                        <span className="ml-1 text-[11px] font-medium text-expense">vencida</span>
                      )}
                      <span className="ml-1 text-[11px] text-content-faint">
                        vence {formatDate(c.dueDate)}
                      </span>
                    </span>
                    <span className="tnum shrink-0 font-semibold text-expense">
                      {formatCurrency(c.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {selectedMonth.payables.length > 0 && (
              <ul className="mt-1 space-y-1">
                {selectedMonth.payables.map((p) => (
                  <li key={p.tx.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-content-muted">
                      {(p.tx as Transaction).description || p.tx.category}
                      <span className="ml-1 text-[11px] text-content-faint">
                        vence {formatDate(p.date)}
                      </span>
                    </span>
                    <span className="tnum shrink-0 font-semibold text-expense">
                      {formatCurrency(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {selectedMonth.cardItems.length === 0 && selectedMonth.payables.length === 0 && (
              <p className="text-sm text-content-muted">Nenhum compromisso lançado neste mês.</p>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
