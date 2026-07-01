import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, TrendingDown, TrendingUp, Percent, Target, PlusCircle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { HealthBadge } from '@/components/ui/HealthBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { CategoryBarChart, type CategoryDatum } from './Charts'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useComposer } from '@/features/transactions/TransactionComposer'
import { companyDisplayColor } from '@/assets/companies'
import {
  computeKpis,
  filterTransactions,
  findGoal,
  healthFromKpis,
} from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { Company, Transaction, TransactionKind } from '@/types'

export function CompanyDashboard({ company }: { company: Company }) {
  const { transactions, goals, period } = useAppData()
  const { openNew } = useComposer()

  const monthTx = useMemo(
    () => filterTransactions(transactions, company.id, period),
    [transactions, company.id, period],
  )
  const kpis = useMemo(() => computeKpis(monthTx), [monthTx])

  const revenueGoal = findGoal(goals, company.id, period, 'monthly_revenue')?.target_value
  const profitGoal = findGoal(goals, company.id, period, 'monthly_profit')?.target_value
  const goalMet = revenueGoal == null || kpis.revenue >= revenueGoal
  const health = healthFromKpis(kpis, goalMet)

  const color = companyDisplayColor(company.slug, company.brand_color, company.accent_color)
  const incomeByCat = useMemo(() => breakdown(monthTx, 'income', '#34D399'), [monthTx])
  const expenseByCat = useMemo(() => breakdown(monthTx, 'expense', '#F87171'), [monthTx])

  return (
    <div className="animate-fade-in space-y-5">
      {/* Cabeçalho da empresa */}
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: color }}>
            {company.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-lg font-bold text-content">{company.name}</h1>
            <p className="text-xs text-content-faint">Visão individual</p>
          </div>
        </div>
        <HealthBadge status={health} />
      </div>

      {kpis.count === 0 ? (
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="Sem lançamentos neste mês"
          description={`Registre receitas e despesas de ${company.name} para ver os indicadores deste mês.`}
          action={
            <Button onClick={() => openNew({ company_id: company.id })}>
              <PlusCircle className="h-4 w-4" />
              Novo lançamento
            </Button>
          }
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Receita"
              value={formatCurrency(kpis.revenue)}
              tone="positive"
              icon={<Wallet className="h-4 w-4" />}
              hint={
                kpis.toReceive > 0 ? (
                  <span className="text-pending">A receber: {formatCurrency(kpis.toReceive)}</span>
                ) : undefined
              }
            />
            <KpiCard
              label="Despesas"
              value={formatCurrency(kpis.totalExpense)}
              tone="negative"
              icon={<TrendingDown className="h-4 w-4" />}
              hint={kpis.costOfSale > 0 ? `Repasses: ${formatCurrency(kpis.costOfSale)}` : undefined}
            />
            <KpiCard
              label="Lucro líquido"
              value={formatCurrency(kpis.netProfit)}
              tone={kpis.netProfit >= 0 ? 'positive' : 'negative'}
              icon={<TrendingUp className="h-4 w-4" />}
              hint={`Bruto: ${formatCurrency(kpis.grossProfit)}`}
            />
            <KpiCard
              label="Margem líquida"
              value={formatPercent(kpis.netMargin)}
              tone="accent"
              icon={<Percent className="h-4 w-4" />}
            />
          </div>

          {/* Meta */}
          <Section
            title="Meta do mês"
            action={
              <Link to="/metas" className="text-xs font-medium text-emerald hover:underline">
                Editar metas
              </Link>
            }
          >
            {revenueGoal || profitGoal ? (
              <div className="space-y-4">
                {revenueGoal ? (
                  <GoalBar label="Receita" current={kpis.revenue} target={revenueGoal} color={color} />
                ) : null}
                {profitGoal ? (
                  <GoalBar label="Lucro" current={kpis.netProfit} target={profitGoal} color={color} />
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-content-muted">
                <Target className="h-5 w-5 text-content-faint" />
                <span>
                  Nenhuma meta definida.{' '}
                  <Link to="/metas" className="font-medium text-emerald hover:underline">
                    Definir agora
                  </Link>
                </span>
              </div>
            )}
          </Section>

          {/* Categorias */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {incomeByCat.length > 0 && (
              <Section title="Receitas por categoria">
                <CategoryBarChart data={incomeByCat} />
              </Section>
            )}
            {expenseByCat.length > 0 && (
              <Section title="Despesas por categoria">
                <CategoryBarChart data={expenseByCat} />
              </Section>
            )}
          </div>

          {/* Lançamentos */}
          <Section
            title="Lançamentos do mês"
            subtitle={`${kpis.count} ${kpis.count === 1 ? 'registro' : 'registros'}`}
            action={
              <Button size="sm" variant="secondary" onClick={() => openNew({ company_id: company.id })}>
                <PlusCircle className="h-4 w-4" />
                Novo
              </Button>
            }
            bodyClassName="pt-1"
          >
            <TransactionList transactions={monthTx} />
          </Section>
        </>
      )}
    </div>
  )
}

function GoalBar({
  label,
  current,
  target,
  color,
}: {
  label: string
  current: number
  target: number
  color: string
}) {
  const pct = target > 0 ? current / target : 0
  const remaining = Math.max(0, target - current)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-content">{label}</span>
        <span className="tnum text-content-muted">
          {formatCurrency(current)} <span className="text-content-faint">/ {formatCurrency(target)}</span>
        </span>
      </div>
      <Progress value={pct} color={color} />
      <div className="mt-1 flex justify-between text-xs">
        <span className="font-medium" style={{ color }}>
          {formatPercent(pct, 0)} atingido
        </span>
        {remaining > 0 ? (
          <span className="text-content-faint">Faltam {formatCurrency(remaining)}</span>
        ) : (
          <span className="text-healthy">Meta batida 🎉</span>
        )}
      </div>
    </div>
  )
}

function breakdown(txs: Transaction[], kind: TransactionKind, color: string): CategoryDatum[] {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.kind !== kind) continue
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value, color }))
    .sort((a, b) => b.value - a.value)
}
