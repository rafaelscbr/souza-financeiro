import { monthKey, monthKeyOf } from './finance'
import { toDateOnly } from './format'
import type { Transaction, TransactionInput } from '@/types'

/**
 * Despesas fixas que já existiram e ainda não foram lançadas no mês em foco.
 *
 * A flag `is_recurring` era só uma etiqueta: marcava a despesa como fixa mas
 * não gerava nada, e o aluguel precisava ser redigitado todo mês. Aqui ela
 * finalmente serve para alguma coisa.
 */
export interface RecurringCandidate {
  /** O lançamento mais recente daquela despesa, usado como modelo. */
  template: Transaction
  /** Mês de onde veio o modelo. */
  sourceMonth: string
}

export function pendingRecurring(
  transactions: Transaction[],
  companyId: string | null,
  target: Date,
): RecurringCandidate[] {
  const targetKey = monthKey(target)

  // Chave da despesa: empresa + categoria + descrição. É o que identifica
  // "o aluguel" como a mesma conta mês após mês.
  const keyOf = (t: Transaction) =>
    `${t.company_id}|${t.category.toLowerCase()}|${t.description.trim().toLowerCase()}`

  const latest = new Map<string, Transaction>()
  const alreadyInTarget = new Set<string>()

  for (const t of transactions) {
    if (companyId !== null && t.company_id !== companyId) continue
    if (t.kind !== 'expense') continue

    const k = keyOf(t)
    const m = monthKeyOf(t.competence_date)

    if (m === targetKey) {
      alreadyInTarget.add(k)
      continue
    }
    // Só olha para o passado: um lançamento futuro não é modelo.
    if (m > targetKey) continue
    if (!t.is_recurring) continue

    const current = latest.get(k)
    if (!current || t.competence_date > current.competence_date) latest.set(k, t)
  }

  return [...latest.entries()]
    .filter(([k]) => !alreadyInTarget.has(k))
    .map(([, template]) => ({
      template,
      sourceMonth: monthKeyOf(template.competence_date),
    }))
    .sort((a, b) => b.template.amount - a.template.amount)
}

/**
 * Gera o lançamento do mês a partir do modelo, mantendo o dia do vencimento
 * e nascendo como PENDENTE — a conta ainda não foi paga, e marcar como paga
 * sem que o dinheiro tenha saído é o erro que descola o saldo do extrato.
 */
export function buildRecurringInput(
  candidate: RecurringCandidate,
  target: Date,
): TransactionInput {
  const t = candidate.template
  const day = Number(t.competence_date.slice(8, 10)) || 1
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const competence = toDateOnly(
    new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay)),
  )

  // Vencimento mantém o mesmo dia do mês do modelo, quando havia.
  const dueDay = t.due_date ? Number(t.due_date.slice(8, 10)) : day
  const due = toDateOnly(
    new Date(target.getFullYear(), target.getMonth(), Math.min(dueDay || day, lastDay)),
  )

  return {
    company_id: t.company_id,
    kind: 'expense',
    category: t.category,
    dre_group: t.dre_group,
    description: t.description,
    amount: t.amount,
    competence_date: competence,
    status: 'pending',
    settled_date: null,
    due_date: due,
    is_recurring: true,
    contact_id: t.contact_id,
    counterparty: t.counterparty,
    property_value: null,
    commission_pct: null,
    broker_pct: null,
    group_id: null,
    installment_index: null,
    installment_count: null,
    account_id: null,
  }
}
