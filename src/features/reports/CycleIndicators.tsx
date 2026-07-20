import { useMemo } from 'react'
import { ShieldCheck, Clock, Receipt, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Tip } from '@/components/ui/Tip'
import { computeRunway, receivableCycle, ticketStats } from '@/lib/indicators'
import { deriveCostStructure } from '@/lib/simulator'
import { treasurySummary } from '@/lib/treasury'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

/**
 * Indicadores de resistência e velocidade — quanto tempo a empresa
 * aguenta e quanto demora para receber. Não aparecem no DRE.
 */
export function CycleIndicators({ scopedTx }: { scopedTx: Transaction[] }) {
  const {
    businessTransactions,
    businessCompanies,
    accounts,
    transfers,
    scopeCompanyId,
    period,
    treasuryReady,
  } = useAppData()

  const cost = useMemo(
    () => deriveCostStructure(businessTransactions, scopeCompanyId, period, businessCompanies),
    [businessTransactions, scopeCompanyId, period, businessCompanies],
  )

  const cash = useMemo(() => {
    const scopedAccounts = accounts.filter(
      (a) => scopeCompanyId === null || a.company_id === scopeCompanyId,
    )
    return treasurySummary(scopedAccounts, businessTransactions, transfers).total
  }, [accounts, businessTransactions, transfers, scopeCompanyId])

  const runway = useMemo(() => computeRunway(cash, cost.fixedMonthly), [cash, cost.fixedMonthly])
  const cycle = useMemo(() => receivableCycle(scopedTx), [scopedTx])
  const ticket = useMemo(() => ticketStats(scopedTx), [scopedTx])

  const runwayTone =
    runway.status === 'healthy'
      ? 'text-income'
      : runway.status === 'warning'
        ? 'text-pending'
        : 'text-critical'

  return (
    <Section
      title="Indicadores de ciclo"
      subtitle="Resistência e velocidade — o que o DRE não mostra"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Runway */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
          <div className="flex items-center gap-1.5 text-content-faint">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Fôlego de caixa</span>
            <Tip label="O que é fôlego de caixa">
              Quantos meses a empresa sobrevive pagando os custos fixos sem faturar
              <strong className="text-content"> nada</strong>. É o indicador que diz se você pode
              arriscar. Abaixo de 3 meses, qualquer compromisso novo é perigoso.
            </Tip>
          </div>
          <p className={cn('tnum mt-1 text-2xl font-bold', runwayTone)}>
            {treasuryReady && cash !== 0
              ? isFinite(runway.months)
                ? `${runway.months.toLocaleString('pt-BR')} ${runway.months === 1 ? 'mês' : 'meses'}`
                : '∞'
              : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-content-faint">
            {!treasuryReady || cash === 0
              ? 'Cadastre suas contas para calcular'
              : `${formatCurrency(cash)} em caixa · queima ${formatCurrency(runway.monthlyBurn)}/mês`}
          </p>

          {treasuryReady && cash > 0 && runway.gap > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-pending">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Faltam {formatCurrency(runway.gap)} para a reserva recomendada de{' '}
                {formatCurrency(runway.recommended)}.
              </span>
            </p>
          )}
        </div>

        {/* PMR */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
          <div className="flex items-center gap-1.5 text-content-faint">
            <Clock className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Prazo de recebimento</span>
            <Tip label="O que é prazo médio de recebimento">
              Quantos dias, em média, separam o fechamento da venda do dinheiro na conta. Quanto
              maior, mais capital de giro a operação exige — você paga o corretor e as contas antes
              de receber.
            </Tip>
          </div>
          <p className="tnum mt-1 text-2xl font-bold text-content">
            {cycle.sample > 0 ? `${cycle.averageDays} dias` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-content-faint">
            {cycle.sample > 0
              ? `${cycle.sample} recebimento(s) · maior prazo ${cycle.longestDays} dias`
              : 'Nenhum recebimento liquidado no período'}
          </p>
        </div>

        {/* Ticket médio */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
          <div className="flex items-center gap-1.5 text-content-faint">
            <Receipt className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Ticket médio</span>
            <Tip label="O que é ticket médio">
              Quanto vale, em média, cada negócio fechado. Parcelas da mesma venda contam como um
              negócio só. Subir o ticket costuma ser mais fácil e mais lucrativo do que aumentar o
              número de vendas.
            </Tip>
          </div>
          <p className="tnum mt-1 text-2xl font-bold text-content">
            {ticket.count > 0 ? formatCurrency(ticket.average) : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-content-faint">
            {ticket.count > 0
              ? `${ticket.count} ${ticket.count === 1 ? 'negócio' : 'negócios'} · maior ${formatCurrency(ticket.largest)}`
              : 'Nenhuma receita no período'}
          </p>
        </div>
      </div>
    </Section>
  )
}
