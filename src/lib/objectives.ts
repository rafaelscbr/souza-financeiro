import {
  computeKpis,
  filterTransactions,
  inMonth,
  lastNMonths,
  personalSummary,
  taxRateOf,
} from './finance'
import { revenueNeededFor, withExtraFixedCost, type CostStructure } from './simulator'
import type { Company, Objective, Regime, Transaction } from '@/types'

/**
 * Meses de custo fixo que uma empresa deveria ter guardados antes de assumir
 * um compromisso novo. Três é o piso defensável para serviço com receita
 * irregular como comissão imobiliária.
 */
const RESERVE_MONTHS = 3

export type Verdict = 'go' | 'tight' | 'wait' | 'grow_first'

/** Resultado de um mês: lucro que sobrou e receita que o gerou. */
export interface MonthlyResult {
  profit: number
  revenue: number
}

/**
 * Série mensal de uma EMPRESA — lucro líquido já com imposto.
 */
export function businessMonthlyResults(
  transactions: Transaction[],
  companyId: string | null,
  reference: Date,
  companies: Company[],
  regime: Regime = 'cash',
  months = 6,
): MonthlyResult[] {
  const rate = companyId ? taxRateOf(companies, companyId) : null
  return lastNMonths(reference, months).map((m) => {
    const kpis = computeKpis(filterTransactions(transactions, companyId, m, regime), rate)
    return { profit: kpis.netProfit, revenue: kpis.revenue }
  })
}

export interface ObjectiveAnalysis {
  objective: Objective

  /** Lucro mensal médio dos últimos meses. */
  avgMonthlyProfit: number
  /** Pior mês do período — é contra ele que o compromisso é julgado. */
  worstMonthProfit: number
  /** Receita bruta média mensal atual. */
  avgRevenue: number

  /** Sobra mensal depois de assumir o custo recorrente. */
  surplusAfter: number
  /** Sobra no pior mês depois de assumir o custo. */
  worstCaseAfter: number

  /** Faturamento mensal necessário para sustentar o novo custo fixo. */
  revenueNeeded: number
  /** Quanto o faturamento precisa subir (0 se já é suficiente). */
  revenueGap: number
  /** Novo ponto de equilíbrio com o custo assumido. */
  newBreakEven: number

  /** Meses para juntar o custo único, no ritmo atual. `null` se não houver custo único. */
  monthsToSave: number | null
  /** Data estimada em que o custo único estará coberto. */
  readyDate: Date | null

  /** Reserva recomendada antes de assumir o compromisso. */
  recommendedReserve: number

  verdict: Verdict
  headline: string
  reasons: string[]
}

/**
 * Série mensal PESSOAL — o que entra (retirada das empresas + receita
 * pessoal) menos o que sai. É a base para objetivos de vida, não de negócio.
 */
export function personalMonthlyResults(
  personalTx: Transaction[],
  businessTx: Transaction[],
  reference: Date,
  regime: Regime = 'cash',
  months = 6,
): MonthlyResult[] {
  return lastNMonths(reference, months).map((m) => {
    const s = personalSummary(personalTx, businessTx, m, regime)
    return { profit: s.surplus, revenue: s.inflow }
  })
}

/** Custo fixo pessoal médio: o que você gasta todo mês para viver. */
export function personalCostStructure(
  personalTx: Transaction[],
  businessTx: Transaction[],
  reference: Date,
  months = 6,
): CostStructure {
  const window = lastNMonths(reference, months)
  let outflow = 0
  for (const t of personalTx) {
    if (t.kind !== 'expense') continue
    if (!window.some((m) => inMonth(t, m, 'cash'))) continue
    outflow += t.amount
  }
  const inflow = window.reduce(
    (s, m) => s + personalSummary(personalTx, businessTx, m, 'cash').inflow,
    0,
  )
  return {
    monthsAnalyzed: months,
    fixedMonthly: round2(outflow / months),
    commissionPct: 0,
    variablePct: 0,
    taxPct: 0,
    avgRevenue: round2(inflow / months),
    reliable: inflow > 0,
  }
}

/**
 * Responde as três perguntas que importam antes de assumir um custo novo:
 * dá para bancar? quanto preciso faturar? quando estarei pronto?
 *
 * O julgamento é feito contra o PIOR mês do histórico, não contra a média.
 * Comissão imobiliária é receita irregular — quem decide pela média assume
 * compromisso que quebra no primeiro mês fraco.
 */
export function analyzeObjective(
  objective: Objective,
  monthly: MonthlyResult[],
  reference: Date,
  cost: CostStructure,
): ObjectiveAnalysis {
  const avgMonthlyProfit = round2(avg(monthly.map((m) => m.profit)))
  const worstMonthProfit = round2(Math.min(...monthly.map((m) => m.profit)))
  const avgRevenue = round2(avg(monthly.map((m) => m.revenue)))

  const monthlyCost = objective.monthly_cost
  const surplusAfter = round2(avgMonthlyProfit - monthlyCost)
  const worstCaseAfter = round2(worstMonthProfit - monthlyCost)

  // Quanto precisa faturar para manter o lucro atual COM o custo novo.
  const costWithObjective = withExtraFixedCost(cost, monthlyCost)
  const revenueNeeded = revenueNeededFor(Math.max(0, avgMonthlyProfit), costWithObjective)
  const revenueGap = round2(Math.max(0, revenueNeeded - avgRevenue))

  const marginPct =
    1 - (cost.taxPct + cost.commissionPct + cost.variablePct) / 100
  const newBreakEven =
    marginPct > 0 ? round2(costWithObjective.fixedMonthly / marginPct) : Infinity

  // Juntar a entrada: só o que sobra DEPOIS de bancar o custo recorrente.
  const savingRate = Math.max(0, surplusAfter)
  const monthsToSave =
    objective.one_time_cost > 0
      ? savingRate > 0
        ? Math.ceil(objective.one_time_cost / savingRate)
        : null
      : 0

  const readyDate =
    monthsToSave != null && monthsToSave > 0
      ? new Date(reference.getFullYear(), reference.getMonth() + monthsToSave, 1)
      : monthsToSave === 0
        ? reference
        : null

  const recommendedReserve = round2(costWithObjective.fixedMonthly * RESERVE_MONTHS)

  const { verdict, headline, reasons } = judge({
    objective,
    avgMonthlyProfit,
    worstCaseAfter,
    surplusAfter,
    revenueGap,
    revenueNeeded,
    monthsToSave,
    monthlyCost,
    avgRevenue,
  })

  return {
    objective,
    avgMonthlyProfit,
    worstMonthProfit,
    avgRevenue,
    surplusAfter,
    worstCaseAfter,
    revenueNeeded,
    revenueGap,
    newBreakEven,
    monthsToSave,
    readyDate,
    recommendedReserve,
    verdict,
    headline,
    reasons,
  }
}

function judge(x: {
  objective: Objective
  avgMonthlyProfit: number
  worstCaseAfter: number
  surplusAfter: number
  revenueGap: number
  revenueNeeded: number
  monthsToSave: number | null
  monthlyCost: number
  avgRevenue: number
}): { verdict: Verdict; headline: string; reasons: string[] } {
  const reasons: string[] = []
  const money = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  // 1. O custo recorrente cabe na média?
  if (x.surplusAfter < 0) {
    reasons.push(
      `Assumindo ${money(x.monthlyCost)} por mês, sua sobra média fica negativa em ${money(Math.abs(x.surplusAfter))}.`,
    )
    reasons.push(
      `Para sustentar esse custo mantendo o lucro de hoje, o faturamento precisa ir de ${money(x.avgRevenue)} para ${money(x.revenueNeeded)} por mês.`,
    )
    return {
      verdict: 'grow_first',
      headline: `Ainda não. Fature ${money(x.revenueGap)} a mais por mês antes de assumir.`,
      reasons,
    }
  }

  // 2. Cabe na média, mas e no pior mês?
  if (x.worstCaseAfter < 0) {
    reasons.push(
      `Na média sobra ${money(x.surplusAfter)} depois do novo custo — mas no seu pior mês do período você ficaria ${money(Math.abs(x.worstCaseAfter))} no vermelho.`,
    )
    reasons.push(
      'Comissão é receita irregular. Um compromisso fixo julgado pela média quebra no primeiro mês fraco.',
    )
    reasons.push(
      `Com faturamento de ${money(x.revenueNeeded)} por mês o compromisso fica confortável.`,
    )
    return {
      verdict: 'tight',
      headline: 'Cabe na média, mas não no mês ruim. Assuma só com reserva formada.',
      reasons,
    }
  }

  // 3. Cabe com folga — falta juntar a entrada?
  if (x.monthsToSave == null) {
    reasons.push('Não há sobra mensal para acumular o custo de entrada.')
    return {
      verdict: 'grow_first',
      headline: 'O custo mensal cabe, mas não sobra nada para juntar a entrada.',
      reasons,
    }
  }

  if (x.monthsToSave > 0) {
    reasons.push(
      `O custo mensal de ${money(x.monthlyCost)} cabe: sobrariam ${money(x.surplusAfter)} por mês.`,
    )
    reasons.push(
      `Falta juntar ${money(x.objective.one_time_cost)} de entrada. No ritmo atual leva ${x.monthsToSave} ${x.monthsToSave === 1 ? 'mês' : 'meses'}.`,
    )
    return {
      verdict: 'wait',
      headline: `Espere ${x.monthsToSave} ${x.monthsToSave === 1 ? 'mês' : 'meses'} para juntar a entrada.`,
      reasons,
    }
  }

  reasons.push(
    `O custo mensal cabe com folga: sobrariam ${money(x.surplusAfter)} por mês mesmo depois de assumir.`,
  )
  reasons.push(
    `Até no seu pior mês do período a conta fecharia, com ${money(x.worstCaseAfter)} de sobra.`,
  )
  return { verdict: 'go', headline: 'Pode fazer o movimento agora.', reasons }
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
