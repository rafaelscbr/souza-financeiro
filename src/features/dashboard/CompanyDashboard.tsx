import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Percent,
  Target,
  PlusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { HealthBadge } from '@/components/ui/HealthBadge'
import { HealthPanel } from './HealthPanel'
import { Button } from '@/components/ui/Button'
import { Tip } from '@/components/ui/Tip'
import { CategoryBarChart, ProfitTrendChart, type CategoryDatum } from './Charts'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useComposer } from '@/features/transactions/TransactionComposer'
import { companyDisplayColor } from '@/assets/companies'
import {
  computeKpis,
  filterTransactions,
  findGoal,
  inScope,
  lastNMonths,
  monthlySeries,
  pipelineSummary,
  taxRateOf,
} from '@/lib/finance'
import { computeHealth } from '@/lib/health'
import { computeRunway } from '@/lib/indicators'
import { deriveCostStructure } from '@/lib/simulator'
import { treasurySummary } from '@/lib/treasury'
import { formatCurrency, formatMonthShort, formatMonthYear, formatPercent } from '@/lib/format'
import type { Company, Transaction, TransactionKind } from '@/types'

export function CompanyDashboard({ company }: { company: Company }) {
  const { businessTransactions, businessCompanies, accounts, transfers, goals, period, regime } =
    useAppData()
  const { openNew } = useComposer()

  const companyTx = useMemo(
    () => businessTransactions.filter((t) => inScope(t, company.id)),
    [businessTransactions, company.id],
  )

  const monthTx = useMemo(
    () => filterTransactions(companyTx, null, period, regime),
    [companyTx, period, regime],
  )
  const taxRate = taxRateOf(businessCompanies, company.id)
  const kpis = useMemo(() => computeKpis(monthTx, taxRate), [monthTx, taxRate])

  // Pendências e histórico não dependem do mês em foco — é o que mantém
  // o painel útil mesmo num mês sem nenhum lançamento novo.
  const pipeline = useMemo(() => pipelineSummary(companyTx, period), [companyTx, period])

  const trend = useMemo(
    () =>
      monthlySeries(companyTx, null, lastNMonths(period, 6), regime, businessCompanies).map((p) => ({
        label: formatMonthShort(p.date),
        lucro: p.profit,
      })),
    [companyTx, period, regime, businessCompanies],
  )

  const revenueGoal = findGoal(goals, company.id, period, 'monthly_revenue')?.target_value
  const profitGoal = findGoal(goals, company.id, period, 'monthly_profit')?.target_value

  // Saúde por quatro fatores — margem sozinha mente nos dois sentidos.
  const health = useMemo(() => {
    const companyAccounts = accounts.filter((a) => a.company_id === company.id)
    const cash = treasurySummary(companyAccounts, companyTx, transfers).total
    const cost = deriveCostStructure(companyTx, null, period, businessCompanies)
    const runwayMonths =
      companyAccounts.length === 0 ? null : computeRunway(cash, cost.fixedMonthly).months

    return computeHealth({
      kpis,
      runwayMonths,
      overdueAmount: pipeline.overdueReceivable + pipeline.overduePayable,
      revenueGoal,
    })
  }, [accounts, company.id, companyTx, transfers, period, businessCompanies, kpis, pipeline, revenueGoal])

  const color = companyDisplayColor(company.slug, company.brand_color, company.accent_color)
  const incomeByCat = useMemo(() => breakdown(monthTx, 'income', '#34D399'), [monthTx])
  const expenseByCat = useMemo(() => breakdown(monthTx, 'expense', '#F87171'), [monthTx])

  const hasHistory = companyTx.length > 0
  const monthIsEmpty = kpis.count === 0
  const regimeWord = regime === 'cash' ? 'entrou e saiu do caixa' : 'foi faturado'

  return (
    <div className="animate-fade-in space-y-5">
      {/* Cabeçalho da empresa */}
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {company.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-lg font-bold text-content">{company.name}</h1>
            <p className="text-xs text-content-faint">
              {formatMonthYear(period)} · {regime === 'cash' ? 'regime de caixa' : 'regime de competência'}
            </p>
          </div>
        </div>
        <HealthBadge status={health.status} />
      </div>

      {hasHistory && <HealthPanel report={health} />}

      {/* Primeiro acesso: a empresa nunca teve lançamento nenhum */}
      {!hasHistory ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-content-faint" />
          <h2 className="text-base font-semibold text-content">
            {company.name} ainda não tem lançamentos
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-content-muted">
            Registre a primeira receita ou despesa e este painel se monta sozinho — indicadores,
            metas e evolução dos últimos meses.
          </p>
          <Button className="mt-4" onClick={() => openNew({ company_id: company.id })}>
            <PlusCircle className="h-4 w-4" />
            Primeiro lançamento
          </Button>
        </div>
      ) : (
        <>
          {/* Aviso discreto — não substitui a tela, só contextualiza */}
          {monthIsEmpty && (
            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-content-faint" />
              <p className="text-sm text-content-muted">
                Nada {regimeWord} em <strong className="text-content">{formatMonthYear(period)}</strong>{' '}
                ainda. Os compromissos em aberto e o histórico continuam abaixo.
              </p>
            </div>
          )}

          {/* Resultado do mês */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label={regime === 'cash' ? 'Recebido' : 'Receita'}
              value={formatCurrency(kpis.revenue)}
              tone="positive"
              icon={<Wallet className="h-4 w-4" />}
              hint={
                regime === 'cash'
                  ? 'Dinheiro que caiu na conta'
                  : kpis.toReceive > 0
                    ? `A receber: ${formatCurrency(kpis.toReceive)}`
                    : 'Faturado no mês'
              }
            />
            <KpiCard
              label={regime === 'cash' ? 'Pago' : 'Despesas'}
              value={formatCurrency(kpis.totalExpense)}
              tone="negative"
              icon={<TrendingDown className="h-4 w-4" />}
              hint={kpis.costOfSale > 0 ? `Comissões: ${formatCurrency(kpis.costOfSale)}` : undefined}
            />
            <KpiCard
              label={regime === 'cash' ? 'Sobrou no mês' : 'Lucro líquido'}
              value={formatCurrency(kpis.netProfit)}
              tone={kpis.netProfit >= 0 ? 'positive' : 'negative'}
              icon={<TrendingUp className="h-4 w-4" />}
              tip="O que sobra depois de imposto, comissão de corretor e todas as despesas. Ainda não desconta a sua retirada."
              hint={`Bruto: ${formatCurrency(kpis.grossProfit)}`}
            />
            <KpiCard
              label="Margem líquida"
              value={kpis.revenue > 0 ? formatPercent(kpis.netMargin) : '—'}
              tone="accent"
              icon={<Percent className="h-4 w-4" />}
              tip="De cada R$ 100 faturados, quanto vira lucro. Abaixo de 10% é sinal de alerta numa imobiliária; acima de 20% é confortável."
            />
          </div>

          {/* Compromissos em aberto */}
          <Section
            title="Em aberto"
            subtitle="Não depende do mês em foco — é tudo que ainda vai entrar ou sair"
            action={
              <Tip label="O que conta como em aberto" align="end">
                Lançamentos marcados como <strong className="text-content">a receber</strong> ou{' '}
                <strong className="text-content">a pagar</strong>, que ainda não tiveram baixa.
                Ficam aqui independente do mês que você está olhando.
              </Tip>
            }
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <OpenStat
                label="A receber"
                value={pipeline.receivable}
                tone="text-income"
                icon={<ArrowDownCircle className="h-4 w-4" />}
              />
              <OpenStat
                label="A pagar"
                value={pipeline.payable}
                tone="text-expense"
                icon={<ArrowUpCircle className="h-4 w-4" />}
              />
              <OpenStat
                label="Vence este mês"
                value={pipeline.dueThisMonthIn - pipeline.dueThisMonthOut}
                tone="text-content"
                icon={<CalendarClock className="h-4 w-4" />}
                hint={`+${formatCurrency(pipeline.dueThisMonthIn)} · −${formatCurrency(pipeline.dueThisMonthOut)}`}
              />
              <OpenStat
                label="Vencido"
                value={pipeline.overdueReceivable + pipeline.overduePayable}
                tone={pipeline.overdueCount > 0 ? 'text-critical' : 'text-content-faint'}
                icon={<AlertTriangle className="h-4 w-4" />}
                hint={
                  pipeline.overdueCount > 0
                    ? `${pipeline.overdueCount} conta(s) atrasada(s)`
                    : 'Nada atrasado'
                }
              />
            </div>
          </Section>

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

          {/* Evolução — sempre presente, mesmo com o mês zerado */}
          <Section title="Evolução do lucro" subtitle={`${company.name} — últimos 6 meses`}>
            <ProfitTrendChart data={trend} />
          </Section>

          {/* Categorias do mês */}
          {(incomeByCat.length > 0 || expenseByCat.length > 0) && (
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
          )}

          {/* Lançamentos do mês */}
          <Section
            title="Lançamentos do mês"
            subtitle={
              monthIsEmpty
                ? 'Nenhum neste mês'
                : `${kpis.count} ${kpis.count === 1 ? 'registro' : 'registros'}`
            }
            action={
              <Button size="sm" variant="secondary" onClick={() => openNew({ company_id: company.id })}>
                <PlusCircle className="h-4 w-4" />
                Novo
              </Button>
            }
            bodyClassName="pt-1"
          >
            {monthIsEmpty ? (
              <p className="py-2 text-sm text-content-muted">
                Use o botão <strong className="text-content">Novo</strong> para registrar o primeiro
                lançamento de {formatMonthYear(period)}.
              </p>
            ) : (
              <TransactionList transactions={monthTx} />
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function OpenStat({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string
  value: number
  tone: string
  icon: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="flex items-center gap-1.5 text-content-faint">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`tnum mt-1 text-lg font-bold ${tone}`}>{formatCurrency(value)}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-content-faint">{hint}</p>}
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
