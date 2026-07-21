import { useMemo } from 'react'
import { Wallet, Layers3, TrendingUp, Percent, Sparkles, PlusCircle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { CompanyCard } from './CompanyCard'
import { AlertsPanel } from './AlertsPanel'
import { ForecastPanel } from './ForecastPanel'
import { SetupChecklist } from './SetupChecklist'
import { ComparisonBarChart, ProfitTrendChart } from './Charts'
import { useCompanyFinancials, useGroupKpis } from './useFinancials'
import { useComposer } from '@/features/transactions/TransactionComposer'
import { COMPANY_SHORT_NAME } from '@/assets/companies'
import { buildAlerts, findGoal, lastNMonths, monthlySeries } from '@/lib/finance'
import { formatCurrency, formatMonthShort, formatPercent } from '@/lib/format'

export function GroupDashboard() {
  const { businessTransactions, businessCompanies, goals, period, regime, setScope } = useAppData()
  const { openNew } = useComposer()
  const groupKpis = useGroupKpis(period)
  const perCompany = useCompanyFinancials(period)

  const comparisonData = useMemo(
    () =>
      perCompany.map((pc) => ({
        name: COMPANY_SHORT_NAME[pc.company.slug],
        receita: pc.kpis.revenue,
        despesa: pc.kpis.totalExpense,
        lucro: pc.kpis.netProfit,
      })),
    [perCompany],
  )

  const trendData = useMemo(
    () =>
      monthlySeries(businessTransactions, null, lastNMonths(period, 6), regime, businessCompanies).map(
        (p) => ({
          label: formatMonthShort(p.date),
          lucro: p.profit,
        }),
      ),
    [businessTransactions, businessCompanies, period, regime],
  )

  const alerts = useMemo(
    () =>
      buildAlerts(
        perCompany.map((pc) => ({
          companyId: pc.company.id,
          companyName: pc.company.name,
          kpis: pc.kpis,
          revenueGoal: pc.revenueGoal,
          profitGoal: pc.profitGoal,
        })),
      ),
    [perCompany],
  )

  const groupRevenueGoal = findGoal(goals, null, period, 'monthly_revenue')?.target_value
  const hasAnyData = businessTransactions.length > 0
  const monthHasData = groupKpis.count > 0

  if (!hasAnyData) {
    return (
      <div className="animate-fade-in space-y-5">
        <SetupChecklist />
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="Bem-vindo ao Souza Group Finance"
          description="Comece lançando suas comissões, vendas e despesas. Os painéis do grupo e de cada empresa se montam sozinhos a partir daqui."
          action={
            <Button onClick={() => openNew()}>
              <PlusCircle className="h-4 w-4" />
              Fazer primeiro lançamento
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <SetupChecklist />

      {/* KPIs do grupo (DRE) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Receita bruta"
          value={formatCurrency(groupKpis.revenue)}
          tone="positive"
          icon={<Wallet className="h-4 w-4" />}
          tip="Tudo que você faturou, antes de qualquer desconto. É sobre este valor que o Simples Nacional calcula o imposto — mesmo a parte que vai para o corretor."
          hint={
            groupKpis.toReceive > 0 ? (
              <span className="text-pending">A receber: {formatCurrency(groupKpis.toReceive)}</span>
            ) : (
              `Recebido: ${formatCurrency(groupKpis.received)}`
            )
          }
        />
        <KpiCard
          label="Lucro bruto"
          value={formatCurrency(groupKpis.grossProfit)}
          tone={groupKpis.grossProfit >= 0 ? 'positive' : 'negative'}
          icon={<Layers3 className="h-4 w-4" />}
          tip="O que sobra depois do imposto e da comissão dos corretores. É o dinheiro disponível para pagar a estrutura da empresa — aluguel, gente, sistema."
          hint={`Comissões: ${formatCurrency(groupKpis.costOfSale)} · ${formatPercent(groupKpis.grossMargin, 0)}`}
        />
        <KpiCard
          label="Lucro líquido"
          value={formatCurrency(groupKpis.netProfit)}
          tone={groupKpis.netProfit >= 0 ? 'positive' : 'negative'}
          icon={<TrendingUp className="h-4 w-4" />}
          tip="O que sobra no fim de tudo: depois de imposto, comissão e todas as despesas. É o lucro de verdade, antes de você retirar a sua parte."
          hint={`Despesas: ${formatCurrency(groupKpis.totalExpense)}`}
        />
        <KpiCard
          label="Margem líquida"
          value={formatPercent(groupKpis.netMargin)}
          tone="accent"
          icon={<Percent className="h-4 w-4" />}
          tip="De cada R$ 100 faturados, quanto vira lucro. Como agora o imposto entra na conta, este número ficou menor do que era antes — e mais verdadeiro."
          hint={groupRevenueGoal ? `Meta: ${formatCurrency(groupRevenueGoal)}` : undefined}
        />
      </div>

      {/* Previsão de caixa — a previsibilidade em primeiro plano */}
      <ForecastPanel months={12} />

      {/* Cards das empresas */}
      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-content-muted">Empresas</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perCompany.map((pc) => (
            <CompanyCard
              key={pc.company.id}
              company={pc.company}
              kpis={pc.kpis}
              health={pc.health}
              onClick={() => setScope(pc.company.id)}
            />
          ))}
        </div>
      </div>

      {/* Gráficos */}
      {monthHasData && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Receita × Despesa × Lucro" subtitle="Comparativo por empresa no mês">
            <ComparisonBarChart data={comparisonData} />
          </Section>
          <Section title="Evolução do lucro" subtitle="Grupo — últimos 6 meses">
            <ProfitTrendChart data={trendData} />
          </Section>
        </div>
      )}

      {/* Alertas */}
      <Section title="Alertas inteligentes" subtitle="Sinais que merecem sua atenção">
        <AlertsPanel alerts={alerts} />
      </Section>
    </div>
  )
}
