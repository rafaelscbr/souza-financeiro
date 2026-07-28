import { toDateOnly } from './format'

/**
 * Divide um total em N parcelas de centavos exatos — a última absorve o
 * arredondamento, então a soma sempre bate com o total.
 */
export function splitAmount(total: number, count: number): number[] {
  const base = Math.floor((total / count) * 100) / 100
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? Math.round((total - base * (count - 1)) * 100) / 100 : base,
  )
}

/**
 * Soma meses a uma data 'YYYY-MM-DD' PRESERVANDO o dia com clamp no fim do mês.
 *
 * `new Date(y, m + i, 31)` transborda para o mês seguinte (31/jan + 1 mês
 * virava 3/mar e fevereiro ficava sem parcela) — este helper fixa isso:
 * 31/jan + 1 mês = 28/fev (ou 29 em bissexto), + 2 meses = 31/mar.
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const targetMonthLastDay = new Date(y, m - 1 + months + 1, 0).getDate()
  return toDateOnly(new Date(y, m - 1 + months, Math.min(d, targetMonthLastDay)))
}

/**
 * Parcelas mensais a partir da primeira data: valores exatos + vencimentos
 * mês a mês no mesmo dia (com clamp em meses curtos).
 */
export function buildInstallments(
  total: number,
  count: number,
  firstDate: string,
): { amount: number; due: string }[] {
  const amounts = splitAmount(total, count)
  return amounts.map((amount, i) => ({ amount, due: addMonthsClamped(firstDate, i) }))
}
