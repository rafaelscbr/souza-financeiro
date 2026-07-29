import { useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { OwnerIncomePanel } from '@/features/personal/OwnerIncomePanel'
import { personalVitals } from '@/lib/personal'
import { inMonth, isOwnerPayout } from '@/lib/finance'
import { formatCurrency, formatDateShort, formatMonthYear } from '@/lib/format'

/** De onde vem o dinheiro: o que as empresas pagam ao dono. */
export function RendaPage() {
  const {
    personalTransactions, businessTransactions, accounts, transfers,
    personalCompany, companies, period, regime,
  } = useAppData()

  const contasPF = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )
  const vitals = useMemo(
    () => personalVitals(personalTransactions, businessTransactions, contasPF, transfers, period, regime),
    [personalTransactions, businessTransactions, contasPF, transfers, period, regime],
  )
  const retiradas = useMemo(
    () => businessTransactions.filter((t) => isOwnerPayout(t) && inMonth(t, period, regime)),
    [businessTransactions, period, regime],
  )

  return (
    <div className="space-y-5">
      <OwnerIncomePanel livingCostAvg={vitals.livingCostAvg} />

      <Section title="Retiradas do mês" subtitle={formatMonthYear(period)}>
        {retiradas.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="Nenhuma retirada neste mês"
            description="Pró-labore e distribuição de lucro lançados nas empresas aparecem aqui automaticamente."
          />
        ) : (
          <ul className="divide-y divide-line">
            {retiradas.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span className="tnum w-10 shrink-0 text-center text-xs text-content-muted">
                  {formatDateShort(t.settled_date ?? t.competence_date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{t.category}</p>
                  <p className="truncate text-xs text-content-faint">
                    {companies.find((c) => c.id === t.company_id)?.name ?? 'Empresa'}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm font-semibold text-income">
                  + {formatCurrency(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
