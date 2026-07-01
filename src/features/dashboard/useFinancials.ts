import { useMemo } from 'react'
import { useAppData } from '@/context/AppDataContext'
import {
  computeKpis,
  filterTransactions,
  findGoal,
  healthFromKpis,
  type Kpis,
} from '@/lib/finance'
import type { Company, HealthStatus } from '@/types'

export interface CompanyFinancials {
  company: Company
  kpis: Kpis
  health: HealthStatus
  revenueGoal?: number
  profitGoal?: number
  goalMet: boolean
}

/** KPIs + saúde + metas de cada empresa para o mês informado. */
export function useCompanyFinancials(date: Date): CompanyFinancials[] {
  const { companies, transactions, goals } = useAppData()
  return useMemo(
    () =>
      companies.map((company) => {
        const kpis = computeKpis(filterTransactions(transactions, company.id, date))
        const revenueGoal = findGoal(goals, company.id, date, 'monthly_revenue')?.target_value
        const profitGoal = findGoal(goals, company.id, date, 'monthly_profit')?.target_value
        const goalMet = revenueGoal == null || kpis.revenue >= revenueGoal
        return {
          company,
          kpis,
          health: healthFromKpis(kpis, goalMet),
          revenueGoal,
          profitGoal,
          goalMet,
        }
      }),
    [companies, transactions, goals, date],
  )
}

/** KPIs consolidados do grupo (todas as empresas) para o mês informado. */
export function useGroupKpis(date: Date): Kpis {
  const { transactions } = useAppData()
  return useMemo(() => computeKpis(filterTransactions(transactions, null, date)), [transactions, date])
}
