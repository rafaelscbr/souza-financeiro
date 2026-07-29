import { toDateOnly } from './format'
import type { PersonalAsset } from '@/types'

/**
 * Os indicadores que respondem a única pergunta que importa quando a renda é
 * variável: **por quanto tempo eu aguento?**
 *
 * Não são métricas de contabilidade — são de sobrevivência. A diferença é que
 * elas comparam o que você TEM líquido contra o que sai TODO MÊS aconteça o
 * que acontecer, e não contra a média de um ano bom.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type Faixa = 'critico' | 'atencao' | 'saudavel'

export interface Survival {
  /** Dinheiro que dá para usar hoje: contas − fatura do cartão. */
  liquid: number
  /** Custo de vida médio dos meses fechados. */
  livingCost: number
  /** Compromisso que vence todo mês independente de faturar (parcelas, pensão, financiamento). */
  fixedCommitment: number
  /** Meses de autonomia: `liquid ÷ custo de vida`. `null` sem custo apurado. */
  runwayMonths: number | null
  /** Autonomia em dias — mais concreto que "0,7 mês". */
  runwayDays: number | null
  /** Meses cobertos considerando SÓ o compromisso fixo (o pior cenário de corte). */
  runwayIfCutToBone: number | null
  /** Quanto falta guardar para chegar em `targetMonths` de reserva. */
  reserveGap: number
  targetMonths: number
  /** Fatia do custo de vida que é compromisso fixo (0–1). */
  fixedShare: number
  /** Dívidas ÷ ativos (0–1). Acima de 1 o patrimônio é negativo. */
  leverage: number | null
  faixa: Faixa
}

/** Reserva de referência para renda variável — comissão não cai todo mês. */
export const RESERVE_TARGET_MONTHS = 6

export function survival(params: {
  liquid: number
  livingCostAvg: number
  fixedCommitment: number
  assets: PersonalAsset[]
  targetMonths?: number
}): Survival {
  const { liquid, livingCostAvg, fixedCommitment, assets } = params
  const targetMonths = params.targetMonths ?? RESERVE_TARGET_MONTHS

  const ativos = assets.filter((a) => a.is_active)
  const bens = ativos.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.value, 0)
  const dividas = ativos.filter((a) => a.kind === 'liability').reduce((s, a) => s + a.value, 0)

  const runwayMonths = livingCostAvg > 0 ? liquid / livingCostAvg : null
  const faixa: Faixa =
    runwayMonths == null ? 'atencao' : runwayMonths < 1 ? 'critico' : runwayMonths < 3 ? 'atencao' : 'saudavel'

  return {
    liquid: round2(liquid),
    livingCost: round2(livingCostAvg),
    fixedCommitment: round2(fixedCommitment),
    runwayMonths: runwayMonths != null ? round2(runwayMonths) : null,
    runwayDays: runwayMonths != null ? Math.round(runwayMonths * 30) : null,
    runwayIfCutToBone: fixedCommitment > 0 ? round2(liquid / fixedCommitment) : null,
    reserveGap: round2(Math.max(0, livingCostAvg * targetMonths - liquid)),
    targetMonths,
    fixedShare: livingCostAvg > 0 ? Math.min(1, fixedCommitment / livingCostAvg) : 0,
    leverage: bens > 0 ? round2(dividas / bens) : null,
    faixa,
  }
}

export interface NextObligation {
  label: string
  amount: number
  date: string
  daysAway: number
}

/**
 * O próximo compromisso grande e quanto falta para ele. Saber que a fatura de
 * R$ 4 mil vence em 18 dias muda a decisão de hoje — o saldo sozinho não conta
 * essa parte da história.
 */
export function nextObligations(
  items: { label: string; amount: number; date: string }[],
  today: string = toDateOnly(new Date()),
  limit = 3,
): NextObligation[] {
  const dia = 24 * 60 * 60 * 1000
  return items
    .filter((i) => i.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, limit)
    .map((i) => ({
      ...i,
      amount: round2(i.amount),
      daysAway: Math.round((Date.parse(i.date) - Date.parse(today)) / dia),
    }))
}
