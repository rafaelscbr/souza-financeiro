import { useMemo } from 'react'
import { useAppData } from '@/context/AppDataContext'
import {
  computeKpis,
  computeKpisMulti,
  filterTransactions,
  findGoal,
  healthFromKpis,
  taxRateOf,
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
  const { businessCompanies, businessTransactions, goals, regime } = useAppData()
  return useMemo(
    () =>
      businessCompanies.map((company) => {
        const kpis = computeKpis(
          filterTransactions(businessTransactions, company.id, date, regime),
          taxRateOf(businessCompanies, company.id),
        )
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
    [businessCompanies, businessTransactions, goals, date, regime],
  )
}

/** KPIs consolidados do grupo (só empresas de negócio) para o mês informado. */
export function useGroupKpis(date: Date): Kpis {
  const { businessTransactions, businessCompanies, regime } = useAppData()
  return useMemo(
    () =>
      computeKpisMulti(
        filterTransactions(businessTransactions, null, date, regime),
        businessCompanies,
      ),
    [businessTransactions, businessCompanies, date, regime],
  )
}
