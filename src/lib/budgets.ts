import type { PersonalBudget } from '@/types'

/**
 * Resolve o limite de cada categoria para um mês: a linha do mês específico
 * vence o padrão (month = null). Devolve também a origem, para a UI poder
 * indicar "ajuste só deste mês".
 */
export interface ResolvedBudget {
  category: string
  limit: number
  /** true quando veio de um ajuste pontual do mês (não do padrão). */
  monthSpecific: boolean
}

export function resolveBudgets(budgets: PersonalBudget[], monthFirstDay: string): ResolvedBudget[] {
  const byCategory = new Map<string, ResolvedBudget>()
  for (const b of budgets) {
    if (b.month !== null && b.month !== monthFirstDay) continue
    const current = byCategory.get(b.category)
    const monthSpecific = b.month === monthFirstDay
    // Mês específico sempre vence; padrão só entra se não houver nada.
    if (!current || (monthSpecific && !current.monthSpecific)) {
      byCategory.set(b.category, { category: b.category, limit: b.monthly_limit, monthSpecific })
    }
  }
  return [...byCategory.values()]
}

/** Limite resolvido de uma única categoria (ou null se não há limite). */
export function budgetLimitOf(
  budgets: PersonalBudget[],
  category: string,
  monthFirstDay: string,
): number | null {
  const resolved = resolveBudgets(budgets, monthFirstDay).find((b) => b.category === category)
  return resolved ? resolved.limit : null
}
