import {
  monthKey,
  monthKeyOf,
  pendingPayables,
  pendingReceivables,
  realizedCash,
  type CashItem,
} from './finance'
import { toDateOnly } from './format'
import type { Transaction } from '@/types'

/**
 * Projeção de caixa mês a mês. Diferente do simulador (que é hipotético),
 * o forecast usa só o que JÁ está contratado: os recebíveis e pagáveis
 * lançados, na data prevista. É o que responde "vou ter dinheiro em agosto?".
 */
export interface ForecastMonth {
  date: Date
  monthKey: string
  /** Entradas previstas no mês. */
  inflow: number
  /** Saídas previstas no mês. */
  outflow: number
  /** inflow − outflow. */
  net: number
  /** Saldo acumulado ao fim do mês. */
  endBalance: number
  /** Mês em que sai mais do que entra. */
  isDeficit: boolean
  /** Mês em que o saldo acumulado fica negativo — furo de caixa. */
  negativeBalance: boolean
  /** Duplicatas a receber que compõem a entrada do mês (para o drill-down). */
  receivables: CashItem[]
  /** Duplicatas a pagar que compõem a saída do mês. */
  payables: CashItem[]
}

/**
 * `startingBalance` é o caixa de partida (saldo real das contas, quando houver;
 * senão o caixa realizado). Compromissos vencidos entram no primeiro mês —
 * ainda não foram liquidados, então ainda vão pesar no caixa.
 */
export function cashForecast(
  txs: Transaction[],
  months: number,
  startingBalance: number | null = null,
  from = new Date(),
): ForecastMonth[] {
  const today = toDateOnly(from)
  const base = startingBalance ?? realizedCash(txs, today)
  const firstKey = monthKey(from)

  const receivables = pendingReceivables(txs)
  const payables = pendingPayables(txs)

  const inItems = new Map<string, CashItem[]>()
  const outItems = new Map<string, CashItem[]>()
  const bucketKey = (date: string) => {
    const mk = monthKeyOf(date)
    // Vencido (antes do mês atual) cai no mês atual — ainda impacta o caixa.
    return mk < firstKey ? firstKey : mk
  }
  const push = (m: Map<string, CashItem[]>, k: string, item: CashItem) => {
    const a = m.get(k)
    if (a) a.push(item)
    else m.set(k, [item])
  }
  for (const r of receivables) push(inItems, bucketKey(r.date), r)
  for (const p of payables) push(outItems, bucketKey(p.date), p)

  const out: ForecastMonth[] = []
  let running = base
  for (let i = 0; i < months; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1)
    const mk = monthKey(d)
    const monthReceivables = inItems.get(mk) ?? []
    const monthPayables = outItems.get(mk) ?? []
    const inflow = round2(monthReceivables.reduce((s, r) => s + r.amount, 0))
    const outflow = round2(monthPayables.reduce((s, p) => s + p.amount, 0))
    const net = round2(inflow - outflow)
    running = round2(running + net)
    out.push({
      date: d,
      monthKey: mk,
      inflow,
      outflow,
      net,
      endBalance: running,
      isDeficit: net < 0,
      negativeBalance: running < 0,
      receivables: monthReceivables,
      payables: monthPayables,
    })
  }
  return out
}

export interface ForecastAlert {
  /** Primeiro mês em que o saldo acumulado fica negativo. */
  firstNegative: ForecastMonth | null
  /** Menor saldo do período (o vale). */
  low: ForecastMonth | null
  /** Meses com déficit (sai mais do que entra). */
  deficitMonths: ForecastMonth[]
}

export function forecastAlert(forecast: ForecastMonth[]): ForecastAlert {
  const firstNegative = forecast.find((m) => m.negativeBalance) ?? null
  const low = forecast.reduce<ForecastMonth | null>(
    (min, m) => (min === null || m.endBalance < min.endBalance ? m : min),
    null,
  )
  return {
    firstNegative,
    low,
    deficitMonths: forecast.filter((m) => m.isDeficit),
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
