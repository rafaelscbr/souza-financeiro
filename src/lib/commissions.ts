import { isOwnerPayout } from './finance'
import type { Transaction } from '@/types'

/**
 * Para onde vai cada real de uma comissão de venda.
 *
 * A pergunta que isto responde não aparece em nenhuma outra tela: da comissão
 * bruta, quanto o governo leva, quanto vai para o parceiro, quanto sobra para o
 * Rafael e quanto de fato FICA na imobiliária. São quatro destinos e a conta só
 * fecha quando os quatro estão à vista.
 *
 * O agrupamento é por `group_id` — comissão, imposto, repasse e a parte do
 * Rafael da mesma venda compartilham o grupo. Agrupar por texto da descrição
 * quebraria no primeiro rótulo reescrito.
 */

/** Marcador do destinatário nas linhas destinadas ao dono. */
export const RAFAEL = 'Rafael Alves de Souza'

export interface SaleSplit {
  groupId: string
  /** Nome legível da venda, tirado da linha de comissão. */
  label: string
  companyId: string
  /** Comissão total que a imobiliária tem direito a receber. */
  gross: number
  /** Imposto do Simples sobre a comissão. */
  tax: number
  /** Repasse a corretor parceiro (Dionata e afins) — sem contar o Rafael. */
  partner: number
  /** O que o Rafael recebe como CORRETOR da venda. */
  toOwnerAsBroker: number
  /** O que o Rafael recebe como fatia do lucro. */
  toOwnerAsProfit: number
  /** Total destinado ao Rafael. */
  toOwner: number
  /** O que sobra de fato para a imobiliária. */
  toCompany: number
  /** Fatia do bruto que fica com a empresa (0–1). */
  companyShare: number
  /** Quanto da comissão já entrou. */
  received: number
  pending: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Limpa o rótulo da venda: tira o sufixo de parcela e o prefixo repetitivo. */
function labelOf(description: string): string {
  return description
    .replace(/\s*—?\s*Pc\s*\d+\/\d+\s*$/i, '')
    .replace(/\s*\(\d+\/\d+\)\s*$/, '')
    .replace(/^Comiss(ão|ao)\s*(—|-)?\s*/i, '')
    .trim()
}

/**
 * Divide cada venda entre governo, parceiro, dono e empresa.
 *
 * `transactions` deve ser o razão das EMPRESAS (nunca o pessoal): as linhas do
 * Rafael vivem no razão delas, porque é delas que o dinheiro sai.
 */
export function saleSplits(transactions: Transaction[]): SaleSplit[] {
  const grupos = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (!t.group_id) continue
    const a = grupos.get(t.group_id)
    if (a) a.push(t)
    else grupos.set(t.group_id, [t])
  }

  const saidas: SaleSplit[] = []
  for (const [groupId, itens] of grupos) {
    const comissoes = itens.filter((t) => t.kind === 'income' && t.category === 'Comissões de Venda')
    if (comissoes.length === 0) continue

    const soma = (f: (t: Transaction) => boolean) =>
      round2(itens.filter(f).reduce((s, t) => s + t.amount, 0))

    const gross = round2(comissoes.reduce((s, t) => s + t.amount, 0))
    const tax = soma((t) => t.category === 'Impostos e Taxas')
    // Repasse a terceiros: comissão de corretor que NÃO é do Rafael.
    const partner = soma(
      (t) => t.category === 'Comissões de Corretores' && t.counterparty !== RAFAEL,
    )
    const toOwnerAsBroker = soma(
      (t) => t.category === 'Comissões de Corretores' && t.counterparty === RAFAEL,
    )
    const toOwnerAsProfit = soma((t) => isOwnerPayout(t) && t.counterparty === RAFAEL)
    const toOwner = round2(toOwnerAsBroker + toOwnerAsProfit)

    saidas.push({
      groupId,
      label: labelOf(comissoes[0].description || 'Venda'),
      companyId: comissoes[0].company_id,
      gross,
      tax,
      partner,
      toOwnerAsBroker,
      toOwnerAsProfit,
      toOwner,
      toCompany: round2(gross - tax - partner - toOwner),
      companyShare: gross > 0 ? (gross - tax - partner - toOwner) / gross : 0,
      received: soma((t) => t.kind === 'income' && t.status === 'settled'),
      pending: soma((t) => t.kind === 'income' && t.status === 'pending'),
    })
  }

  return saidas.sort((a, b) => b.gross - a.gross)
}

export interface SplitTotals {
  gross: number
  tax: number
  partner: number
  toOwner: number
  toCompany: number
}

export function splitTotals(splits: SaleSplit[]): SplitTotals {
  const soma = (f: (s: SaleSplit) => number) => round2(splits.reduce((a, s) => a + f(s), 0))
  return {
    gross: soma((s) => s.gross),
    tax: soma((s) => s.tax),
    partner: soma((s) => s.partner),
    toOwner: soma((s) => s.toOwner),
    toCompany: soma((s) => s.toCompany),
  }
}

// ---------------------------------------------------------------------------
// O que o Rafael tem a receber
// ---------------------------------------------------------------------------

export interface OwnerReceivable {
  id: string
  date: string
  amount: number
  label: string
  /** 'corretagem' quando ele fez a venda · 'lucro' quando é fatia do resultado. */
  kind: 'corretagem' | 'lucro'
  companyId: string
  overdue: boolean
}

/**
 * O que as empresas ainda devem ao Rafael, em ordem de vencimento.
 *
 * Mora aqui, e não no razão pessoal, porque o dinheiro ainda é delas — só vira
 * receita dele quando sai. Duplicar no pessoal contaria a mesma entrada duas
 * vezes quando fosse liquidado.
 */
export function ownerReceivables(
  businessTransactions: Transaction[],
  today: string,
): OwnerReceivable[] {
  return businessTransactions
    .filter((t) => t.counterparty === RAFAEL && t.status === 'pending')
    .map((t) => {
      const date = t.due_date ?? t.competence_date
      return {
        id: t.id,
        date,
        amount: t.amount,
        label: labelOf(t.description || ''),
        kind: (isOwnerPayout(t) ? 'lucro' : 'corretagem') as 'corretagem' | 'lucro',
        companyId: t.company_id,
        overdue: date < today,
      }
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Agrupa os recebimentos por mês ('YYYY-MM'), para o gráfico e o resumo. */
export function receivablesByMonth(
  items: OwnerReceivable[],
): { month: string; amount: number; count: number }[] {
  const m = new Map<string, { amount: number; count: number }>()
  for (const i of items) {
    const k = i.date.slice(0, 7)
    const e = m.get(k) ?? { amount: 0, count: 0 }
    e.amount = round2(e.amount + i.amount)
    e.count += 1
    m.set(k, e)
  }
  return [...m.entries()]
    .map(([month, e]) => ({ month, ...e }))
    .sort((a, b) => (a.month < b.month ? -1 : 1))
}
