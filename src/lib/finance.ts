import type { Contact, DreGroup, Goal, HealthStatus, Transaction } from '@/types'

/** Categorias de despesa consideradas FIXAS (fallback de classificação). */
export const FIXED_EXPENSE_CATEGORIES = new Set([
  'Aluguel',
  'Salários',
  'Ferramentas/Assinaturas',
  'Pró-labore',
  'Internet/Telefonia',
  'Contabilidade',
])

export const COST_OF_SALE_CATEGORIES = new Set(['Repasse a Corretores', 'Repasse de Comissão'])

/** Classificação DRE de um lançamento (usa o campo salvo, com fallback por categoria/tipo). */
export function dreGroupOf(tx: Transaction): DreGroup {
  if (tx.dre_group) return tx.dre_group
  if (tx.kind === 'income') return 'revenue'
  if (tx.kind === 'withdrawal') return 'withdrawal'
  if (COST_OF_SALE_CATEGORIES.has(tx.category)) return 'cost_of_sale'
  if (FIXED_EXPENSE_CATEGORIES.has(tx.category)) return 'operating_expense'
  return 'variable_expense'
}

// ---------------------------------------------------------------------------
// Datas / meses
// ---------------------------------------------------------------------------

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function firstDayOfMonth(date: Date): string {
  return `${monthKey(date)}-01`
}

export function lastNMonths(date: Date, n: number): Date[] {
  const out: Date[] = []
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(date.getFullYear(), date.getMonth() - i, 1))
  }
  return out
}

export function monthElapsedFraction(date: Date, today = new Date()): number {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const isCurrentMonth = monthKey(date) === monthKey(today)
  if (!isCurrentMonth) return 1
  return Math.min(1, today.getDate() / daysInMonth)
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export function inScope(t: Transaction, companyId: string | null): boolean {
  return companyId === null || t.company_id === companyId
}

export function inMonth(t: Transaction, date: Date): boolean {
  return monthKeyOf(t.competence_date) === monthKey(date)
}

export function filterTransactions(
  transactions: Transaction[],
  companyId: string | null,
  date: Date,
): Transaction[] {
  return transactions.filter((t) => inScope(t, companyId) && inMonth(t, date))
}

// ---------------------------------------------------------------------------
// KPIs (DRE)
// ---------------------------------------------------------------------------

export interface Kpis {
  /** Receita bruta (competência). */
  revenue: number
  /** Custos diretos (repasses a corretores). */
  costOfSale: number
  /** Lucro bruto = receita − custos diretos. */
  grossProfit: number
  grossMargin: number
  operatingExpense: number
  variableExpense: number
  /** Despesas não classificadas (fallback). */
  otherExpense: number
  /** Total de saídas de despesa (custos + operacionais + variáveis + outras). */
  totalExpense: number
  /** Lucro líquido = receita − total de despesas. */
  netProfit: number
  netMargin: number
  withdrawals: number
  /** Receita já recebida (caixa). */
  received: number
  /** Receita a receber (pipeline). */
  toReceive: number
  /** Despesas já pagas. */
  paid: number
  /** Despesas a pagar. */
  toPay: number
  count: number
}

export function computeKpis(txs: Transaction[]): Kpis {
  let revenue = 0
  let costOfSale = 0
  let operatingExpense = 0
  let variableExpense = 0
  let otherExpense = 0
  let withdrawals = 0
  let received = 0
  let toReceive = 0
  let paid = 0
  let toPay = 0

  for (const t of txs) {
    const g = dreGroupOf(t)
    if (g === 'revenue') {
      revenue += t.amount
      if (t.status === 'settled') received += t.amount
      else toReceive += t.amount
    } else if (g === 'withdrawal') {
      withdrawals += t.amount
    } else {
      // despesa (custo direto / operacional / variável / outra)
      if (g === 'cost_of_sale') costOfSale += t.amount
      else if (g === 'operating_expense') operatingExpense += t.amount
      else if (g === 'variable_expense') variableExpense += t.amount
      else otherExpense += t.amount
      if (t.status === 'settled') paid += t.amount
      else toPay += t.amount
    }
  }

  const grossProfit = revenue - costOfSale
  const totalExpense = costOfSale + operatingExpense + variableExpense + otherExpense
  const netProfit = revenue - totalExpense

  return {
    revenue,
    costOfSale,
    grossProfit,
    grossMargin: revenue > 0 ? grossProfit / revenue : 0,
    operatingExpense,
    variableExpense,
    otherExpense,
    totalExpense,
    netProfit,
    netMargin: revenue > 0 ? netProfit / revenue : 0,
    withdrawals,
    received,
    toReceive,
    paid,
    toPay,
    count: txs.length,
  }
}

// ---------------------------------------------------------------------------
// Saúde da empresa
// ---------------------------------------------------------------------------

/** 🟢 margem líquida ≥ 20% · 🟡 0–20% · 🔴 prejuízo. */
export function healthFromKpis(kpis: Kpis, goalMet = true): HealthStatus {
  if (kpis.revenue === 0 && kpis.totalExpense === 0) return 'warning'
  if (kpis.netProfit < 0) return 'critical'
  if (kpis.netMargin < 0.2 || !goalMet) return 'warning'
  return 'healthy'
}

// ---------------------------------------------------------------------------
// Séries temporais
// ---------------------------------------------------------------------------

export interface MonthlyPoint {
  date: Date
  monthKey: string
  revenue: number
  expense: number
  profit: number
}

export function monthlySeries(
  transactions: Transaction[],
  companyId: string | null,
  months: Date[],
): MonthlyPoint[] {
  return months.map((date) => {
    const kpis = computeKpis(filterTransactions(transactions, companyId, date))
    return {
      date,
      monthKey: monthKey(date),
      revenue: kpis.revenue,
      expense: kpis.totalExpense,
      profit: kpis.netProfit,
    }
  })
}

// ---------------------------------------------------------------------------
// Projeções e tendência
// ---------------------------------------------------------------------------

export type Trend = 'up' | 'flat' | 'down'

export function trendOf(values: number[]): Trend {
  const clean = values.filter((v) => isFinite(v))
  if (clean.length < 2) return 'flat'
  const first = clean[0]
  const last = clean[clean.length - 1]
  if (first === 0) return last > 0 ? 'up' : 'flat'
  const change = (last - first) / Math.abs(first)
  if (change > 0.05) return 'up'
  if (change < -0.05) return 'down'
  return 'flat'
}

export interface Projection {
  projected: number
  current: number
  historicalAvg: number
  trend: Trend
}

export function project(current: number, elapsedFraction: number, history: number[]): Projection {
  const historicalAvg =
    history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : current
  let projected: number
  if (elapsedFraction >= 0.98) projected = current
  else if (elapsedFraction < 0.15) projected = historicalAvg
  else projected = (current / elapsedFraction) * 0.7 + historicalAvg * 0.3
  return { projected, current, historicalAvg, trend: trendOf([...history, projected]) }
}

// ---------------------------------------------------------------------------
// Fluxo de caixa (a receber / a pagar / saldo projetado)
// ---------------------------------------------------------------------------

export interface CashItem {
  tx: Transaction
  date: string // due_date (previsão)
  amount: number
  direction: 'in' | 'out'
}

/** Contas a receber (receitas pendentes), ordenadas pela data prevista. */
export function pendingReceivables(txs: Transaction[]): CashItem[] {
  return txs
    .filter((t) => dreGroupOf(t) === 'revenue' && t.status === 'pending')
    .map((t) => ({ tx: t, date: t.due_date ?? t.competence_date, amount: t.amount, direction: 'in' as const }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Contas a pagar (despesas/retiradas pendentes), ordenadas pela data prevista. */
export function pendingPayables(txs: Transaction[]): CashItem[] {
  return txs
    .filter((t) => dreGroupOf(t) !== 'revenue' && t.status === 'pending')
    .map((t) => ({ tx: t, date: t.due_date ?? t.competence_date, amount: t.amount, direction: 'out' as const }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Saldo de caixa REALIZADO (entradas liquidadas − saídas liquidadas) até uma data. */
export function realizedCash(txs: Transaction[], uptoDate?: string): number {
  let balance = 0
  for (const t of txs) {
    if (t.status !== 'settled') continue
    const d = t.settled_date ?? t.competence_date
    if (uptoDate && d > uptoDate) continue
    balance += dreGroupOf(t) === 'revenue' ? t.amount : -t.amount
  }
  return balance
}

// ---------------------------------------------------------------------------
// Relatórios por contato (corretor / fornecedor)
// ---------------------------------------------------------------------------

export interface ContactSummary {
  contact: Contact
  paid: number // já liquidado
  pending: number // a pagar/receber
  total: number
  count: number
}

export function sumByContact(txs: Transaction[], contacts: Contact[]): ContactSummary[] {
  const byId = new Map<string, ContactSummary>()
  for (const c of contacts) {
    byId.set(c.id, { contact: c, paid: 0, pending: 0, total: 0, count: 0 })
  }
  for (const t of txs) {
    if (!t.contact_id) continue
    const entry = byId.get(t.contact_id)
    if (!entry) continue
    entry.total += t.amount
    entry.count += 1
    if (t.status === 'settled') entry.paid += t.amount
    else entry.pending += t.amount
  }
  return [...byId.values()].filter((e) => e.count > 0).sort((a, b) => b.total - a.total)
}

// ---------------------------------------------------------------------------
// Alertas automáticos
// ---------------------------------------------------------------------------

export type AlertLevel = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  level: AlertLevel
  title: string
  description: string
  companyId: string | null
}

export interface CompanyKpiEntry {
  companyId: string
  companyName: string
  kpis: Kpis
  revenueGoal?: number
  profitGoal?: number
}

export function buildAlerts(entries: CompanyKpiEntry[]): Alert[] {
  const alerts: Alert[] = []

  for (const e of entries) {
    const hasActivity = e.kpis.revenue > 0 || e.kpis.totalExpense > 0
    if (!hasActivity) continue

    if (e.kpis.netProfit < 0) {
      alerts.push({
        id: `${e.companyId}-prejuizo`,
        level: 'critical',
        title: `${e.companyName} no prejuízo`,
        description: `Despesas superam a receita neste mês (margem líquida ${(e.kpis.netMargin * 100).toFixed(0)}%).`,
        companyId: e.companyId,
      })
    } else if (e.kpis.netMargin < 0.2) {
      alerts.push({
        id: `${e.companyId}-margem`,
        level: 'warning',
        title: `Margem líquida baixa em ${e.companyName}`,
        description: `${(e.kpis.netMargin * 100).toFixed(0)}% está abaixo dos 20% saudáveis.`,
        companyId: e.companyId,
      })
    }

    if (e.kpis.revenue > 0 && e.kpis.costOfSale / e.kpis.revenue > 0.6) {
      alerts.push({
        id: `${e.companyId}-repasse`,
        level: 'warning',
        title: `Repasses altos em ${e.companyName}`,
        description: `Corretores consomem ${((e.kpis.costOfSale / e.kpis.revenue) * 100).toFixed(0)}% da comissão (acima de 60%).`,
        companyId: e.companyId,
      })
    }

    if (e.kpis.revenue > 0 && e.kpis.variableExpense / e.kpis.revenue > 0.4) {
      alerts.push({
        id: `${e.companyId}-variavel`,
        level: 'warning',
        title: `Despesa variável alta em ${e.companyName}`,
        description: `Variáveis representam ${((e.kpis.variableExpense / e.kpis.revenue) * 100).toFixed(0)}% da receita (limite 40%).`,
        companyId: e.companyId,
      })
    }

    if (e.revenueGoal && e.revenueGoal > 0 && e.kpis.revenue < e.revenueGoal) {
      const pct = (e.kpis.revenue / e.revenueGoal) * 100
      alerts.push({
        id: `${e.companyId}-meta-receita`,
        level: 'info',
        title: `Meta de receita de ${e.companyName}`,
        description: `Atingiu ${pct.toFixed(0)}% da meta (faltam ${formatShortBRL(e.revenueGoal - e.kpis.revenue)}).`,
        companyId: e.companyId,
      })
    }
  }

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}

function formatShortBRL(v: number): string {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

export function findGoal(
  goals: Goal[],
  companyId: string | null,
  date: Date,
  metric: Goal['metric'],
): Goal | undefined {
  const mk = firstDayOfMonth(date)
  return goals.find((g) => g.company_id === companyId && g.metric === metric && g.month === mk)
}
