import { useMemo } from 'react'
import { AlertTriangle, TrendingDown, ShieldCheck } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Tip } from '@/components/ui/Tip'
import { CashForecastChart, type ForecastDatum } from './Charts'
import { cashForecast, forecastAlert } from '@/lib/forecast'
import { inScope, realizedCash } from '@/lib/finance'
import { treasurySummary } from '@/lib/treasury'
import { formatCurrency, formatMonthShort, toDateOnly } from '@/lib/format'

/**
 * Previsão de caixa dos próximos meses a partir do que já está contratado.
 * O alerta de furo (saldo negativo) é o que o Rafael pediu: saber com
 * antecedência em que mês o caixa aperta.
 */
export function ForecastPanel({ months = 12 }: { months?: number }) {
  const { businessTransactions, accounts, transfers, scopeCompanyId } = useAppData()
  const today = toDateOnly(new Date())

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
    saldo: m.endBalance,
    entra: m.inflow,
    sai: m.outflow,
    negativo: m.negativeBalance,
  }))

  const hasMovement = forecast.some((m) => m.inflow !== 0 || m.outflow !== 0)

  return (
    <Section
      title="Previsão de caixa"
      subtitle={`Próximos ${months} meses, pelo que já está contratado`}
      action={
        <Tip label="Como a previsão é calculada" align="end">
          Parte do seu <strong className="text-content">caixa de hoje</strong> e soma, mês a mês, o
          que está marcado como a receber e a pagar nas datas previstas. Não é chute — é o
          compromisso que já existe. Cadastre suas contas para o ponto de partida ficar exato.
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
        <CashForecastChart data={data} />
      ) : (
        <p className="py-4 text-center text-sm text-content-muted">
          Sem contas a receber ou a pagar lançadas para projetar. Marque lançamentos como pendentes
          e a previsão se monta aqui.
        </p>
      )}
    </Section>
  )
}
