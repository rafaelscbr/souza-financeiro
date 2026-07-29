import { useMemo } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { NetWorthPanel } from '@/features/personal/NetWorthPanel'
import { PersonalForecastPanel } from '@/features/personal/PersonalForecastPanel'
import { ownerIncome } from '@/lib/personal'
import { lastNMonths } from '@/lib/finance'

/** O que você tem menos o que você deve, e para onde isso está indo. */
export function PatrimonioPage() {
  const { businessTransactions, companies, period, regime } = useAppData()
  const rendaEsperada = useMemo(
    () => ownerIncome(businessTransactions, companies, lastNMonths(period, 12), regime).monthlyAvg,
    [businessTransactions, companies, period, regime],
  )
  return (
    <div className="space-y-5">
      <NetWorthPanel />
      <PersonalForecastPanel monthlyIncome={rendaEsperada} />
    </div>
  )
}
