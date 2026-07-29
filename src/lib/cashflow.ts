import { cardPayables, cardSummary } from './cards'
import { ownerReceivables } from './commissions'
import type { Account, Transaction, Transfer } from '@/types'

/**
 * Previsão de caixa pessoal: o que entra, o que sai e como fica o saldo, mês a
 * mês, usando SÓ o que já está lançado.
 *
 * A regra que mantém isto honesto é não estimar nada. As saídas saem das
 * faturas de cartão (que já contêm as parcelas em curso) e das contas a pagar
 * lançadas — pensão e financiamento. As entradas saem do que as empresas devem
 * a ele, com data. Nenhuma média, nenhum "provavelmente".
 *
 * O efeito colateral é bom: quanto mais ele lança, mais a projeção acerta — e
 * ele vê isso acontecer, o que é o melhor incentivo para manter o hábito.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

function proximosMeses(inicio: string, n: number): string[] {
  const [y, m] = inicio.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const t = m - 1 + i
    return `${y + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
  })
}

export interface CashflowMonth {
  month: string
  /** Recebimentos contratados das empresas. */
  inflow: number
  /** Faturas de cartão vencendo no mês. */
  card: number
  /** Contas a pagar fora do cartão (pensão, financiamento…). */
  bills: number
  outflow: number
  net: number
  /** Saldo projetado ao fim do mês. */
  balance: number
  /** Detalhe do que compõe o mês, para a tela abrir sob demanda. */
  items: { label: string; amount: number; kind: 'in' | 'out'; date: string }[]
}

export interface Cashflow {
  months: CashflowMonth[]
  /** Saldo líquido de hoje, ponto de partida da projeção. */
  opening: number
  /** Primeiro mês em que o saldo projetado fica negativo. */
  breaksAt: string | null
  /** Pior saldo da janela e em que mês acontece. */
  lowest: { month: string; balance: number } | null
  totalIn: number
  totalOut: number
}

export function personalCashflow(params: {
  liquid: number
  personalTransactions: Transaction[]
  businessTransactions: Transaction[]
  accounts: Account[]
  transfers: Transfer[]
  today: string
  months?: number
}): Cashflow {
  const { liquid, personalTransactions, businessTransactions, accounts, transfers, today } = params
  const janela = proximosMeses(mesDe(today), params.months ?? 8)

  const porMes = new Map<string, CashflowMonth>()
  for (const month of janela) {
    porMes.set(month, {
      month,
      inflow: 0,
      card: 0,
      bills: 0,
      outflow: 0,
      net: 0,
      balance: 0,
      items: [],
    })
  }
  const alvo = (data: string) => {
    // Vencido entra no mês corrente: o compromisso é agora, não no passado.
    const k = data < today ? janela[0] : mesDe(data)
    return porMes.get(k)
  }

  // ---- entradas: o que as empresas devem a ele
  for (const r of ownerReceivables(businessTransactions, today)) {
    const m = alvo(r.date)
    if (!m) continue
    m.inflow = round2(m.inflow + r.amount)
    m.items.push({ label: r.label, amount: r.amount, kind: 'in', date: r.date })
  }

  // ---- saídas 1: faturas de cartão (já incluem as parcelas em curso)
  const cartoes = accounts.filter((a) => a.is_active && a.type === 'credit_card')
  const resumos = cartoes.map((c) => cardSummary(c, personalTransactions, transfers, today))
  for (const p of cardPayables(resumos)) {
    const m = alvo(p.dueDate)
    if (!m || p.amount <= 0) continue
    m.card = round2(m.card + p.amount)
    m.items.push({
      label: `Fatura ${p.account.name}`,
      amount: p.amount,
      kind: 'out',
      date: p.dueDate,
    })
  }

  // ---- saídas 2: contas a pagar fora do cartão
  for (const t of personalTransactions) {
    if (t.status !== 'pending' || t.kind !== 'expense') continue
    if (t.card_cycle_month) continue // já está dentro da fatura
    const data = t.due_date ?? t.competence_date
    const m = alvo(data)
    if (!m) continue
    m.bills = round2(m.bills + t.amount)
    m.items.push({ label: t.description || t.category, amount: t.amount, kind: 'out', date: data })
  }

  // ---- fecha a conta e acumula o saldo
  let saldo = liquid
  let breaksAt: string | null = null
  let lowest: { month: string; balance: number } | null = null
  const months: CashflowMonth[] = []
  for (const key of janela) {
    const m = porMes.get(key)!
    m.outflow = round2(m.card + m.bills)
    m.net = round2(m.inflow - m.outflow)
    saldo = round2(saldo + m.net)
    m.balance = saldo
    m.items.sort((a, b) => (a.date < b.date ? -1 : 1))
    if (saldo < 0 && breaksAt === null) breaksAt = key
    if (lowest === null || saldo < lowest.balance) lowest = { month: key, balance: saldo }
    months.push(m)
  }

  return {
    months,
    opening: round2(liquid),
    breaksAt,
    lowest,
    totalIn: round2(months.reduce((s, m) => s + m.inflow, 0)),
    totalOut: round2(months.reduce((s, m) => s + m.outflow, 0)),
  }
}
