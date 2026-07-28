import { useMemo } from 'react'
import { Building2, TrendingUp, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { Tip } from '@/components/ui/Tip'
import { companyDisplayColor } from '@/assets/companies'
import { lastNMonths } from '@/lib/finance'
import { ownerIncome, suggestedDistribution } from '@/lib/personal'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Quanto as empresas pagam ao dono — e quanto ainda comportam pagar.
 *
 * Separar pró-labore de distribuição não é detalhe fiscal: pró-labore é
 * previsível e tributado; distribuição depende de ter lucro. Custo de vida
 * bancado por distribuição é risco silencioso — se o lucro cai, a vida
 * pessoal aperta junto.
 */
export function OwnerIncomePanel({
  livingCostAvg,
  months = 12,
}: {
  livingCostAvg: number
  months?: number
}) {
  const { businessTransactions, companies, accounts, transfers, period, regime } = useAppData()

  const monthList = useMemo(() => lastNMonths(period, months), [period, months])

  const income = useMemo(
    () => ownerIncome(businessTransactions, companies, monthList, regime, livingCostAvg),
    [businessTransactions, companies, monthList, regime, livingCostAvg],
  )

  const suggestions = useMemo(
    () => suggestedDistribution(businessTransactions, companies, accounts, transfers, monthList, regime),
    [businessTransactions, companies, accounts, transfers, monthList, regime],
  )

  const totalSuggested = suggestions.reduce((s, d) => s + d.suggested, 0)
  const dependsOnProfit = income.total > 0 && income.distributionShare > 0.5

  if (income.total === 0 && totalSuggested === 0) return null

  return (
    <Section
      title="O que as empresas te pagam"
      subtitle={`Últimos ${months} meses · pró-labore e distribuição`}
    >
      <div className="space-y-4">
        {/* Renda média × custo de vida */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface-2/50 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              Renda média
            </span>
            <p className="tnum mt-1 text-xl font-bold text-content">
              {formatCurrency(income.monthlyAvg)}
            </p>
            <p className="text-xs text-content-faint">por mês</p>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/50 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              Cobertura
              <Tip label="Cobertura do custo de vida">
                Quantas vezes o que as empresas te pagam cobre o seu custo de vida. Abaixo de 1×
                você está consumindo reserva; acima de 1,5× sobra para investir.
              </Tip>
            </span>
            <p
              className={cn(
                'tnum mt-1 text-xl font-bold',
                income.coverage === null
                  ? 'text-content'
                  : income.coverage >= 1.5
                    ? 'text-income'
                    : income.coverage >= 1
                      ? 'text-pending'
                      : 'text-expense',
              )}
            >
              {income.coverage === null
                ? '—'
                : `${income.coverage.toFixed(1).replace('.', ',')}×`}
            </p>
            <p className="text-xs text-content-faint">do custo de vida</p>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/50 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              Composição
            </span>
            <p className="tnum mt-1 text-xl font-bold text-content">
              {formatPercent(income.distributionShare, 0)}
            </p>
            <p className="text-xs text-content-faint">veio de distribuição</p>
          </div>
        </div>

        {dependsOnProfit && (
          <div className="flex items-start gap-2.5 rounded-xl border border-pending/25 bg-pending/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
            <p className="text-sm text-content-muted">
              <strong className="text-content">
                Mais da metade da sua renda depende de lucro.
              </strong>{' '}
              Pró-labore é fixo e previsível; distribuição varia com o resultado. Se o mês for
              fraco nas empresas, sua vida pessoal sente junto — vale equilibrar ou reforçar a
              reserva.
            </p>
          </div>
        )}

        {/* Por empresa */}
        {income.byCompany.length > 0 && (
          <ul className="divide-y divide-line">
            {income.byCompany.map((e) => {
              const color = companyDisplayColor(
                e.company.slug,
                e.company.brand_color,
                e.company.accent_color,
              )
              const proShare = e.total > 0 ? e.proLabore / e.total : 0
              return (
                <li key={e.company.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate text-sm font-medium text-content">
                        {e.company.name}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-sm font-semibold text-content">
                      {formatCurrency(e.total)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={proShare} color={color} className="h-1.5 flex-1" />
                    <span className="shrink-0 text-[11px] text-content-faint">
                      Pró-labore {formatCurrency(e.proLabore)} · Lucros{' '}
                      {formatCurrency(e.distribution)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Distribuição sugerida */}
        {totalSuggested > 0 && (
          <div className="rounded-xl border border-emerald/25 bg-emerald-soft/40 p-3.5">
            <div className="flex items-start gap-2.5">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-content">
                  Você pode distribuir até {formatCurrency(totalSuggested)}
                  <Tip label="Como esse valor é calculado">
                    Duas travas, e vence a menor: você não distribui o que ainda não virou{' '}
                    <strong className="text-content">lucro</strong> (senão está devolvendo
                    capital), nem tira o <strong className="text-content">caixa</strong> que a
                    operação precisa para andar — aqui reservamos 2 meses de despesa em cada
                    empresa.
                  </Tip>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {suggestions
                    .filter((d) => d.suggested > 0)
                    .map((d) => (
                      <li key={d.company.id} className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Building2 className="h-3 w-3 shrink-0 text-content-faint" />
                          <span className="truncate text-sm text-content">{d.company.name}</span>
                          <span className="shrink-0 text-[11px] text-content-faint">
                            {d.limitedBy === 'caixa' ? 'limitado pelo caixa' : 'limitado pelo lucro'}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-sm font-bold text-emerald-dark">
                          {formatCurrency(d.suggested)}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="mt-2 text-[11px] text-content-faint">
                  Mantendo 2 meses de despesa em caixa em cada empresa. Lance como retirada na
                  empresa para a entrada aparecer aqui no Pessoal.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}
