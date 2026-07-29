import { useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { CategoryBarChart } from '@/features/dashboard/Charts'
import { InsightsPanel } from '@/features/personal/InsightsPanel'
import { BudgetEditor } from '@/features/personal/BudgetEditor'
import { resolveBudgets } from '@/lib/budgets'
import { personalVitals } from '@/lib/personal'
import { firstDayOfMonth, inMonth, monthElapsedFraction, personalSummary } from '@/lib/finance'
import { formatCurrency, formatMonthYear } from '@/lib/format'

const COR_PADRAO = '#6366F1'

/** Para onde o dinheiro foi: categorias do mês, análises e orçamento. */
export function GastosPage() {
  const {
    personalTransactions, businessTransactions, personalBudgets, personalCompany,
    categories, accounts, transfers, period, regime,
  } = useAppData()
  const [orcamento, setOrcamento] = useState(false)

  const resumo = useMemo(
    () => personalSummary(personalTransactions, businessTransactions, period, regime),
    [personalTransactions, businessTransactions, period, regime],
  )
  const contasPF = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )
  const vitals = useMemo(
    () => personalVitals(personalTransactions, businessTransactions, contasPF, transfers, period, regime),
    [personalTransactions, businessTransactions, contasPF, transfers, period, regime],
  )

  const cores = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) {
      if (c.company_id === personalCompany?.id && c.color) m.set(c.name, c.color)
    }
    return m
  }, [categories, personalCompany])

  const doMes = useMemo(
    () => personalTransactions.filter((t) => inMonth(t, period, regime)),
    [personalTransactions, period, regime],
  )

  const orcamentos = useMemo(() => {
    const gasto = new Map<string, number>()
    for (const t of doMes) {
      if (t.kind === 'expense') gasto.set(t.category, (gasto.get(t.category) ?? 0) + t.amount)
    }
    const decorrido = monthElapsedFraction(period)
    return resolveBudgets(personalBudgets, firstDayOfMonth(period))
      .map((b) => {
        const spent = gasto.get(b.category) ?? 0
        return { ...b, spent, projected: decorrido > 0.1 && decorrido < 0.98 ? spent / decorrido : spent }
      })
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
  }, [personalBudgets, doMes, period])

  const categoriaData = resumo.byCategory.map((c) => ({ ...c, color: cores.get(c.name) ?? COR_PADRAO }))

  return (
    <div className="space-y-5">
      {categoriaData.length > 0 && (
        <Section title="Categorias do mês" subtitle={formatMonthYear(period)}>
          <CategoryBarChart data={categoriaData} />
        </Section>
      )}

      <InsightsPanel livingCostAvg={vitals.livingCostAvg} />

      <Section
        title="Orçamento do mês"
        subtitle="Gasto × limite por categoria"
        action={
          <button
            onClick={() => setOrcamento(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Definir
          </button>
        }
      >
        {orcamentos.length === 0 ? (
          <p className="text-sm text-content-muted">
            Nenhum limite definido.{' '}
            <button onClick={() => setOrcamento(true)} className="font-medium text-emerald hover:underline">
              Criar orçamento
            </button>
          </p>
        ) : (
          <div className="space-y-4">
            {orcamentos.map((r) => {
              const pct = r.limit > 0 ? r.spent / r.limit : 0
              const estourou = r.spent > r.limit
              const vaiEstourar = !estourou && r.projected > r.limit
              return (
                <div key={r.category}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-content">{r.category}</span>
                    <span className="tnum text-content-muted">
                      {formatCurrency(r.spent)}{' '}
                      <span className="text-content-faint">/ {formatCurrency(r.limit)}</span>
                    </span>
                  </div>
                  <Progress value={pct} color={estourou ? '#DC2626' : cores.get(r.category) ?? COR_PADRAO} />
                  {estourou && (
                    <p className="mt-1 text-xs font-medium text-expense">
                      Estourou {formatCurrency(r.spent - r.limit)}
                    </p>
                  )}
                  {vaiEstourar && (
                    <p className="mt-1 text-xs font-medium text-pending">
                      Nesse ritmo fecha em {formatCurrency(r.projected)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <BudgetEditor open={orcamento} onClose={() => setOrcamento(false)} />
    </div>
  )
}
