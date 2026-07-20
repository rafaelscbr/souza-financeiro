import { dreGroupOf, filterTransactions, lastNMonths, monthKey } from './finance'
import { parseDateOnly } from './format'
import type { Transaction } from '@/types'

/**
 * Indicadores de ciclo — os que respondem "quanto tempo eu aguento" e
 * "quanto demoro para receber". São diferentes dos KPIs de resultado:
 * medem resistência e velocidade, não lucro.
 */

export interface Runway {
  /** Saldo disponível hoje. */
  cash: number
  /** Custo fixo mensal médio. */
  monthlyBurn: number
  /** Meses de sobrevivência sem faturar nada. `Infinity` se não há custo fixo. */
  months: number
  /** Reserva recomendada: 3 meses de custo fixo. */
  recommended: number
  /** Quanto falta para atingir a reserva recomendada. */
  gap: number
  status: 'healthy' | 'warning' | 'critical'
}

const RESERVE_MONTHS = 3

/**
 * Quantos meses a empresa sobrevive gastando o que gasta, sem entrar
 * um real. É o indicador que diz se você pode arriscar.
 */
export function computeRunway(cash: number, monthlyFixedCost: number): Runway {
  const months = monthlyFixedCost > 0 ? cash / monthlyFixedCost : Infinity
  const recommended = round2(monthlyFixedCost * RESERVE_MONTHS)

  return {
    cash,
    monthlyBurn: monthlyFixedCost,
    months: round1(months),
    recommended,
    gap: round2(Math.max(0, recommended - cash)),
    status: months >= RESERVE_MONTHS ? 'healthy' : months >= 1 ? 'warning' : 'critical',
  }
}

export interface ReceivableCycle {
  /** Prazo médio entre a venda e o recebimento, em dias. */
  averageDays: number
  /** Nº de recebimentos usados na média. */
  sample: number
  /** Maior prazo observado. */
  longestDays: number
}

/**
 * Prazo médio de recebimento (PMR): quantos dias, em média, separam o
 * fechamento da venda do dinheiro na conta. Quanto maior, mais capital
 * de giro a operação exige.
 */
export function receivableCycle(transactions: Transaction[]): ReceivableCycle {
  let totalWeightedDays = 0
  let totalAmount = 0
  let sample = 0
  let longest = 0

  for (const t of transactions) {
    if (dreGroupOf(t) !== 'revenue') continue
    if (t.status !== 'settled' || !t.settled_date) continue

    const days = daysBetween(t.competence_date, t.settled_date)
    if (days < 0) continue

    // Pondera pelo valor: uma comissão grande que demora pesa mais do
    // que uma pequena que entra rápido.
    totalWeightedDays += days * t.amount
    totalAmount += t.amount
    sample += 1
    if (days > longest) longest = days
  }

  return {
    averageDays: totalAmount > 0 ? Math.round(totalWeightedDays / totalAmount) : 0,
    sample,
    longestDays: longest,
  }
}

export interface TicketStats {
  /** Receita média por venda. */
  average: number
  /** Nº de vendas no período. */
  count: number
  largest: number
  /** Receita total considerada. */
  total: number
}

/** Ticket médio: quanto vale, em média, cada negócio fechado. */
export function ticketStats(transactions: Transaction[]): TicketStats {
  const revenues = transactions.filter((t) => dreGroupOf(t) === 'revenue')

  // Parcelas da mesma venda contam como um negócio só.
  const byOperation = new Map<string, number>()
  for (const t of revenues) {
    const key = t.group_id ?? t.id
    byOperation.set(key, (byOperation.get(key) ?? 0) + t.amount)
  }

  const values = [...byOperation.values()]
  const total = values.reduce((a, b) => a + b, 0)

  return {
    average: values.length > 0 ? round2(total / values.length) : 0,
    count: values.length,
    largest: values.length > 0 ? Math.max(...values) : 0,
    total: round2(total),
  }
}

/** Uma coluna do DRE comparativo. */
export interface DreColumn {
  date: Date
  label: string
  revenue: number
  taxes: number
  costOfSale: number
  grossProfit: number
  operatingExpense: number
  variableExpense: number
  netProfit: number
}

/**
 * DRE dos últimos N meses lado a lado. É assim que se enxerga um custo
 * subindo mês a mês antes de ele virar problema — coisa que o DRE de um
 * período só nunca mostra.
 */
export function dreSeries(
  transactions: Transaction[],
  companyId: string | null,
  reference: Date,
  taxRatePct: number | null,
  months = 12,
): DreColumn[] {
  return lastNMonths(reference, months).map((date) => {
    const rows = filterTransactions(transactions, companyId, date, 'accrual')

    let revenue = 0
    let costOfSale = 0
    let operatingExpense = 0
    let variableExpense = 0

    for (const t of rows) {
      const g = dreGroupOf(t)
      if (g === 'revenue') revenue += t.amount
      else if (g === 'cost_of_sale') costOfSale += t.amount
      else if (g === 'operating_expense') operatingExpense += t.amount
      else if (g === 'variable_expense') variableExpense += t.amount
    }

    const taxes = taxRatePct != null ? round2(revenue * (taxRatePct / 100)) : 0
    const grossProfit = revenue - taxes - costOfSale
    const netProfit = grossProfit - operatingExpense - variableExpense

    return {
      date,
      label: monthKey(date),
      revenue,
      taxes,
      costOfSale,
      grossProfit,
      operatingExpense,
      variableExpense,
      netProfit,
    }
  })
}

function daysBetween(from: string, to: string): number {
  const a = parseDateOnly(from).getTime()
  const b = parseDateOnly(to).getTime()
  return Math.round((b - a) / 86_400_000)
}

function round1(v: number): number {
  return isFinite(v) ? Math.round(v * 10) / 10 : v
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
