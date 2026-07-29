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

export interface Runway {
  /** Meses até o caixa zerar considerando o que ainda vai entrar. */
  months: number | null
  /** Mês em que o caixa fica negativo ('YYYY-MM'), se ficar. */
  breaksAt: string | null
  /** Soma do que está contratado para entrar na janela projetada. */
  incoming: number
}

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
  /**
   * Fôlego COM os recebimentos contratados. É o número honesto para quem vive
   * de comissão: o saldo de hoje não conta a história toda quando há dinheiro
   * com data marcada para entrar.
   */
  withReceipts: Runway | null
  /**
   * Parte da dívida de cartão que é despesa da empresa (some quando a PJ
   * assumir o cartão). Não é custo de vida dele e não pode pesar como se fosse.
   */
  businessOnCard: number
}

/** Reserva de referência para renda variável — comissão não cai todo mês. */
export const RESERVE_TARGET_MONTHS = 6

export function survival(params: {
  liquid: number
  livingCostAvg: number
  fixedCommitment: number
  assets: PersonalAsset[]
  targetMonths?: number
  /** O que está contratado para entrar, com data. */
  receipts?: { date: string; amount: number }[]
  /** Quanto da fatura do cartão é despesa da empresa. */
  businessOnCard?: number
  today?: string
}): Survival {
  const { liquid, livingCostAvg, fixedCommitment, assets } = params
  const receipts = params.receipts ?? []
  const businessOnCard = round2(params.businessOnCard ?? 0)
  const today = params.today ?? toDateOnly(new Date())
  const targetMonths = params.targetMonths ?? RESERVE_TARGET_MONTHS

  const ativos = assets.filter((a) => a.is_active)
  const bens = ativos.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.value, 0)
  const dividas = ativos.filter((a) => a.kind === 'liability').reduce((s, a) => s + a.value, 0)

  const runwayMonths = livingCostAvg > 0 ? liquid / livingCostAvg : null
  const faixa: Faixa =
    runwayMonths == null ? 'atencao' : runwayMonths < 1 ? 'critico' : runwayMonths < 3 ? 'atencao' : 'saudavel'

  return {
    withReceipts: projectRunway(liquid + businessOnCard, livingCostAvg, receipts, today),
    businessOnCard,
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

/**
 * Simula mês a mês: entra o que está contratado, sai o custo de vida. Devolve
 * quando o caixa vira negativo.
 *
 * O MÊS CORRENTE entra proporcional aos dias que faltam — o saldo de hoje já
 * embute o que foi gasto até aqui, e cobrar o mês inteiro de novo contaria a
 * mesma despesa duas vezes (no dia 29, isso derrubava a projeção em um mês
 * inteiro de custo que já tinha saído).
 *
 * Projeta 24 meses no máximo — além disso a previsão vira ficção, porque
 * depende de vendas que ainda não existem.
 */
function projectRunway(
  saldoInicial: number,
  custoMensal: number,
  receipts: { date: string; amount: number }[],
  today: string,
): Runway | null {
  if (custoMensal <= 0) return null
  const porMes = new Map<string, number>()
  for (const r of receipts) {
    // Recebimento vencido conta no mês corrente: o dinheiro é devido agora.
    const k = r.date < today ? today.slice(0, 7) : r.date.slice(0, 7)
    porMes.set(k, (porMes.get(k) ?? 0) + r.amount)
  }

  let saldo = saldoInicial
  let meses = 0
  const [y0, m0, d0] = today.split('-').map(Number)
  const diasNoMes = new Date(y0, m0, 0).getDate()
  const fracaoRestante = Math.max(0, (diasNoMes - d0 + 1) / diasNoMes)

  for (let i = 0; i < 24; i++) {
    const t = m0 - 1 + i
    const chave = `${y0 + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
    const custo = i === 0 ? custoMensal * fracaoRestante : custoMensal
    saldo += porMes.get(chave) ?? 0
    saldo -= custo
    if (saldo < 0) {
      const sobra = custo > 0 ? (saldo + custo) / custo : 0
      return {
        months: round2(meses + Math.max(0, sobra) * (i === 0 ? fracaoRestante : 1)),
        breaksAt: chave,
        incoming: round2(receipts.reduce((s, r) => s + r.amount, 0)),
      }
    }
    meses += i === 0 ? fracaoRestante : 1
  }
  return { months: null, breaksAt: null, incoming: round2(receipts.reduce((s, r) => s + r.amount, 0)) }
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
