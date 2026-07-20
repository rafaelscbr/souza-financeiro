import { useMemo, useState } from 'react'
import { Calculator, Target, TrendingUp, AlertTriangle, RotateCcw } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { KpiCard } from '@/components/ui/KpiCard'
import { FormField } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { Tip } from '@/components/ui/Tip'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  deriveCostStructure,
  revenueNeededFor,
  simulate,
  type CostStructure,
} from '@/lib/simulator'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function SimuladorPage() {
  const { businessTransactions, businessCompanies, scopeCompanyId, activeCompany, period } =
    useAppData()

  // Estrutura real dos últimos 6 meses — o ponto de partida da simulação.
  const derived = useMemo(
    () => deriveCostStructure(businessTransactions, scopeCompanyId, period, businessCompanies, 6),
    [businessTransactions, scopeCompanyId, period, businessCompanies],
  )

  // O usuário pode sobrescrever qualquer premissa para testar cenários.
  const [override, setOverride] = useState<Partial<CostStructure>>({})
  const [revenue, setRevenue] = useState<number | null>(null)
  const [targetProfit, setTargetProfit] = useState<number | null>(null)

  const cost: CostStructure = { ...derived, ...override }
  const simRevenue = revenue ?? derived.avgRevenue
  const sim = useMemo(() => simulate(simRevenue, cost), [simRevenue, cost])

  const revenueForTarget = useMemo(
    () => (targetProfit != null && targetProfit > 0 ? revenueNeededFor(targetProfit, cost) : null),
    [targetProfit, cost],
  )

  const touched = Object.keys(override).length > 0
  const scopeName = activeCompany ? activeCompany.name : 'Grupo (consolidado)'

  function set<K extends keyof CostStructure>(key: K, value: CostStructure[K]) {
    setOverride((o) => ({ ...o, [key]: value }))
  }

  if (!derived.reliable) {
    return (
      <div className="animate-fade-in space-y-5">
        <Header scopeName={scopeName} />
        <EmptyState
          icon={<Calculator className="h-8 w-8" />}
          title="Histórico insuficiente para simular"
          description={`Para projetar resultado eu preciso saber sua estrutura de custos real. Lance algumas receitas e despesas de ${scopeName} e o simulador passa a usar seus percentuais de verdade, em vez de chutar.`}
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <Header scopeName={scopeName} />

      {/* Resultado principal */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Faturamento simulado"
          value={formatCurrency(simRevenue)}
          tone="neutral"
          icon={<TrendingUp className="h-4 w-4" />}
          hint={`Média real: ${formatCurrency(derived.avgRevenue)}`}
        />
        <KpiCard
          label="Margem de contribuição"
          value={formatCurrency(sim.contributionMargin)}
          tone="accent"
          hint={`${formatPercent(sim.contributionMarginPct, 0)} de cada real faturado`}
        />
        <KpiCard
          label="Lucro líquido"
          value={formatCurrency(sim.netProfit)}
          tone={sim.netProfit >= 0 ? 'positive' : 'negative'}
          hint={`Margem ${formatPercent(sim.netMarginPct, 1)}`}
        />
        <KpiCard
          label="Ponto de equilíbrio"
          value={isFinite(sim.breakEven) ? formatCurrency(sim.breakEven) : '—'}
          tone={sim.distanceToBreakEven >= 0 ? 'positive' : 'negative'}
          icon={<Target className="h-4 w-4" />}
          hint={
            !isFinite(sim.breakEven)
              ? 'Custos variáveis consomem toda a receita'
              : sim.distanceToBreakEven >= 0
                ? `${formatCurrency(sim.distanceToBreakEven)} acima`
                : `Faltam ${formatCurrency(Math.abs(sim.distanceToBreakEven))}`
          }
        />
      </div>

      {/* Aviso de prejuízo */}
      {sim.netProfit < 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-critical/25 bg-critical/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
          <p className="text-sm text-content-muted">
            Com {formatCurrency(simRevenue)} de faturamento este cenário dá{' '}
            <strong className="text-critical">prejuízo de {formatCurrency(Math.abs(sim.netProfit))}</strong>.
            Você precisa faturar pelo menos{' '}
            <strong className="text-content">{formatCurrency(sim.breakEven)}</strong> só para empatar.
          </p>
        </div>
      )}

      {/* Entrada */}
      <Section title="Quanto vou faturar?" subtitle="Digite um valor e veja o resultado descer a cascata">
        <div className="space-y-3">
          <CurrencyInput
            id="sim-revenue"
            value={revenue ?? derived.avgRevenue}
            onChange={setRevenue}
          />
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Média atual', value: derived.avgRevenue },
              { label: '+25%', value: Math.round(derived.avgRevenue * 1.25) },
              { label: '+50%', value: Math.round(derived.avgRevenue * 1.5) },
              { label: 'Dobro', value: Math.round(derived.avgRevenue * 2) },
              ...(isFinite(sim.breakEven)
                ? [{ label: 'Equilíbrio', value: Math.round(sim.breakEven) }]
                : []),
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setRevenue(p.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  simRevenue === p.value
                    ? 'border-transparent bg-content text-white'
                    : 'border-line bg-surface text-content-muted hover:bg-surface-2 hover:text-content',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Cascata do resultado */}
      <Section
        title="Como o dinheiro desce até o lucro"
        subtitle={`Estrutura real dos últimos ${derived.monthsAnalyzed} meses`}
        bodyClassName="pt-1"
      >
        <ul className="divide-y divide-line">
          {sim.lines.map((line) => {
            const isSubtotal = line.kind === 'subtotal'
            const isFinal = line.label === 'Lucro líquido'
            return (
              <li
                key={line.label}
                className={cn(
                  'flex items-baseline justify-between gap-3 py-2.5',
                  isSubtotal && 'border-t-2 border-line/80',
                )}
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm',
                      isSubtotal ? 'font-bold text-content' : 'font-medium text-content-muted',
                    )}
                  >
                    {line.label}
                  </p>
                  {line.hint && <p className="text-[11px] text-content-faint">{line.hint}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'tnum font-semibold',
                      isFinal
                        ? line.value >= 0
                          ? 'text-lg text-income'
                          : 'text-lg text-expense'
                        : line.kind === 'negative'
                          ? 'text-sm text-expense'
                          : 'text-sm text-content',
                    )}
                  >
                    {formatCurrency(line.value)}
                  </p>
                  <p className="tnum text-[11px] text-content-faint">
                    {formatPercent(line.pctOfRevenue, 1)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      {/* Meta inversa */}
      <Section
        title="Quero lucrar X. Quanto preciso faturar?"
        subtitle="A conta ao contrário, sobre a mesma estrutura"
      >
        <div className="space-y-3">
          <CurrencyInput id="sim-target" value={targetProfit} onChange={setTargetProfit} />
          {revenueForTarget != null && (
            <div className="rounded-xl bg-emerald-soft px-4 py-3">
              {isFinite(revenueForTarget) ? (
                <p className="text-sm text-content">
                  Para lucrar <strong>{formatCurrency(targetProfit!)}</strong> por mês, você precisa
                  faturar{' '}
                  <strong className="text-emerald-dark">{formatCurrency(revenueForTarget)}</strong>.
                  <span className="mt-1 block text-xs text-content-muted">
                    {revenueForTarget > derived.avgRevenue
                      ? `São ${formatCurrency(revenueForTarget - derived.avgRevenue)} a mais que sua média atual — um aumento de ${formatPercent(revenueForTarget / derived.avgRevenue - 1, 0)}.`
                      : 'Seu faturamento médio atual já é suficiente para essa meta.'}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-content">
                  Impossível com a estrutura atual: os custos variáveis consomem 100% da receita.
                </p>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Premissas editáveis */}
      <Section
        title="Premissas"
        subtitle="Calculadas do seu histórico — ajuste para testar cenários"
        action={
          touched ? (
            <button
              onClick={() => setOverride({})}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Voltar ao real
            </button>
          ) : (
            <Tip label="De onde vêm estes números">
              Calculados dos últimos {derived.monthsAnalyzed} meses de lançamentos reais desta
              empresa. Mexer aqui não altera nada do seu histórico — serve só para testar
              cenários.
            </Tip>
          )
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Custo fixo mensal"
            htmlFor="sim-fixed"
            hint="Aluguel, pessoal, pró-labore, ferramentas"
          >
            <CurrencyInput
              id="sim-fixed"
              value={cost.fixedMonthly}
              onChange={(v) => set('fixedMonthly', v ?? 0)}
            />
          </FormField>
          <FormField
            label="Comissão de corretores"
            htmlFor="sim-commission"
            hint="% da receita bruta que vai para o corretor"
          >
            <PercentInput
              id="sim-commission"
              value={cost.commissionPct}
              onChange={(v) => set('commissionPct', v ?? 0)}
            />
          </FormField>
          <FormField
            label="Despesas variáveis"
            htmlFor="sim-variable"
            hint="Marketing e comercial, em % da receita"
          >
            <PercentInput
              id="sim-variable"
              value={cost.variablePct}
              onChange={(v) => set('variablePct', v ?? 0)}
            />
          </FormField>
          <FormField
            label="Alíquota de imposto"
            htmlFor="sim-tax"
            hint="Efetiva sobre o faturamento (extrato do DAS)"
          >
            <PercentInput id="sim-tax" value={cost.taxPct} onChange={(v) => set('taxPct', v ?? 0)} />
          </FormField>
        </div>

        {cost.taxPct === 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-pending/10 px-3 py-2 text-xs text-content-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pending" />
            <span>
              A alíquota está zerada. Sem imposto na conta, o lucro simulado aparece maior do que
              será de verdade. Configure em Relatórios → Configuração tributária.
            </span>
          </p>
        )}
      </Section>
    </div>
  )
}

function Header({ scopeName }: { scopeName: string }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold text-content">
        Simulador
        <Tip label="Para que serve o simulador" align="start">
          Responde “se eu faturar X, quanto sobra?” usando a sua estrutura de custos real — não
          uma média de mercado. Também mostra o <strong className="text-content">ponto de
          equilíbrio</strong>: o faturamento mínimo para não ter prejuízo.
        </Tip>
      </h1>
      <p className="text-sm text-content-faint">{scopeName} · projeção sobre custos reais</p>
    </div>
  )
}
