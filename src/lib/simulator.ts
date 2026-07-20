import { dreGroupOf, filterTransactions, lastNMonths, taxRateOf } from './finance'
import type { Company, Transaction } from '@/types'

/**
 * Estrutura de custos de uma empresa, extraída do histórico real.
 *
 * A separação fixo × variável é o que permite responder "quanto sobra se eu
 * faturar X": custo fixo não acompanha a receita, custo variável acompanha.
 * Sem essa distinção qualquer projeção é chute.
 */
export interface CostStructure {
  /** Meses usados na média. */
  monthsAnalyzed: number
  /** Custo fixo mensal médio (estrutura: aluguel, pessoal, pró-labore, ferramentas). */
  fixedMonthly: number
  /** Comissão de corretores em % da receita bruta. */
  commissionPct: number
  /** Outras despesas variáveis (marketing, comercial) em % da receita bruta. */
  variablePct: number
  /** Alíquota efetiva de imposto sobre a receita bruta, em %. */
  taxPct: number
  /** Receita bruta média mensal do período analisado. */
  avgRevenue: number
  /** `false` quando não há histórico suficiente para confiar nos percentuais. */
  reliable: boolean
}

/**
 * Deriva a estrutura de custos dos últimos N meses.
 * Usa competência: a pergunta é sobre capacidade de gerar resultado, não
 * sobre quando o dinheiro entrou.
 */
export function deriveCostStructure(
  transactions: Transaction[],
  companyId: string | null,
  reference: Date,
  companies: Company[],
  months = 6,
): CostStructure {
  const window = lastNMonths(reference, months)
  const rows = window.flatMap((m) =>
    filterTransactions(transactions, companyId, m, 'accrual'),
  )

  let revenue = 0
  let commission = 0
  let fixed = 0
  let variable = 0

  for (const t of rows) {
    const g = dreGroupOf(t)
    if (g === 'revenue') revenue += t.amount
    else if (g === 'cost_of_sale') commission += t.amount
    else if (g === 'operating_expense') fixed += t.amount
    else if (g === 'variable_expense') variable += t.amount
    else if (g !== 'withdrawal') variable += t.amount
  }

  const taxPct = companyId ? (taxRateOf(companies, companyId) ?? 0) : averageTaxRate(companies)

  return {
    monthsAnalyzed: months,
    fixedMonthly: round2(fixed / months),
    commissionPct: revenue > 0 ? round2((commission / revenue) * 100) : 0,
    variablePct: revenue > 0 ? round2((variable / revenue) * 100) : 0,
    taxPct,
    avgRevenue: round2(revenue / months),
    // Percentuais derivados de pouca receita não descrevem a operação.
    reliable: revenue > 0 && rows.length >= 3,
  }
}

/** Média simples das alíquotas configuradas — usada só na visão de grupo. */
function averageTaxRate(companies: Company[]): number {
  const rates = companies
    .filter((c) => !c.is_personal && c.tax_rate != null)
    .map((c) => c.tax_rate as number)
  if (rates.length === 0) return 0
  return round2(rates.reduce((a, b) => a + b, 0) / rates.length)
}

export interface SimulationLine {
  label: string
  value: number
  /** `positive` soma, `negative` subtrai, `subtotal` é linha de resultado. */
  kind: 'positive' | 'negative' | 'subtotal'
  /** Percentual sobre a receita bruta. */
  pctOfRevenue: number
  hint?: string
}

export interface Simulation {
  revenue: number
  taxes: number
  commission: number
  variable: number
  fixed: number
  /** Margem de contribuição: o que cada real faturado deixa para pagar o fixo. */
  contributionMargin: number
  contributionMarginPct: number
  netProfit: number
  netMarginPct: number
  /** Faturamento que zera o resultado. */
  breakEven: number
  /** Quanto falta (ou sobra) em relação ao ponto de equilíbrio. */
  distanceToBreakEven: number
  lines: SimulationLine[]
}

/**
 * Projeta o resultado de um faturamento hipotético sobre a estrutura atual.
 *
 * A conta segue a ordem do DRE: imposto incide sobre a receita bruta,
 * comissão do corretor é custo direto, e o custo fixo só é coberto pelo
 * que sobra depois disso (margem de contribuição).
 */
export function simulate(revenue: number, cost: CostStructure): Simulation {
  const taxes = round2(revenue * (cost.taxPct / 100))
  const commission = round2(revenue * (cost.commissionPct / 100))
  const variable = round2(revenue * (cost.variablePct / 100))

  const contributionMargin = revenue - taxes - commission - variable
  const contributionMarginPct = revenue > 0 ? contributionMargin / revenue : 0
  const netProfit = round2(contributionMargin - cost.fixedMonthly)

  // Ponto de equilíbrio: fixo ÷ margem de contribuição percentual.
  const breakEven =
    contributionMarginPct > 0 ? round2(cost.fixedMonthly / contributionMarginPct) : Infinity

  const pct = (v: number) => (revenue > 0 ? v / revenue : 0)

  const lines: SimulationLine[] = [
    {
      label: 'Receita bruta de serviços',
      value: revenue,
      kind: 'positive',
      pctOfRevenue: 1,
      hint: 'Faturamento simulado',
    },
    {
      label: 'Impostos sobre faturamento',
      value: -taxes,
      kind: 'negative',
      pctOfRevenue: -pct(taxes),
      hint: `Alíquota efetiva de ${cost.taxPct.toLocaleString('pt-BR')}%`,
    },
    {
      label: 'Comissões de corretores',
      value: -commission,
      kind: 'negative',
      pctOfRevenue: -pct(commission),
      hint: `${cost.commissionPct.toLocaleString('pt-BR')}% da receita, pela média real`,
    },
    {
      label: 'Despesas variáveis',
      value: -variable,
      kind: 'negative',
      pctOfRevenue: -pct(variable),
      hint: `${cost.variablePct.toLocaleString('pt-BR')}% — marketing e comercial`,
    },
    {
      label: 'Margem de contribuição',
      value: contributionMargin,
      kind: 'subtotal',
      pctOfRevenue: contributionMarginPct,
      hint: 'O que sobra para pagar a estrutura',
    },
    {
      label: 'Custos fixos',
      value: -cost.fixedMonthly,
      kind: 'negative',
      pctOfRevenue: -pct(cost.fixedMonthly),
      hint: 'Não muda com o faturamento',
    },
    {
      label: 'Lucro líquido',
      value: netProfit,
      kind: 'subtotal',
      pctOfRevenue: pct(netProfit),
    },
  ]

  return {
    revenue,
    taxes,
    commission,
    variable,
    fixed: cost.fixedMonthly,
    contributionMargin,
    contributionMarginPct,
    netProfit,
    netMarginPct: pct(netProfit),
    breakEven,
    distanceToBreakEven: isFinite(breakEven) ? round2(revenue - breakEven) : -Infinity,
    lines,
  }
}

/**
 * Faturamento necessário para produzir um lucro-alvo, dada a estrutura.
 * Inverte a conta do simulador: (fixo + alvo) ÷ margem de contribuição %.
 */
export function revenueNeededFor(targetProfit: number, cost: CostStructure): number {
  const marginPct = 1 - (cost.taxPct + cost.commissionPct + cost.variablePct) / 100
  if (marginPct <= 0) return Infinity
  return round2((cost.fixedMonthly + targetProfit) / marginPct)
}

/** Estrutura de custos ajustada por um novo custo fixo mensal. */
export function withExtraFixedCost(cost: CostStructure, extraMonthly: number): CostStructure {
  return { ...cost, fixedMonthly: round2(cost.fixedMonthly + extraMonthly) }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
