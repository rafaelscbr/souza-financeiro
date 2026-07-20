import type { Company, Contact, DreGroup, Goal, HealthStatus, Regime, Transaction } from '@/types'

/** Categorias de despesa consideradas FIXAS (fallback de classificação). */
export const FIXED_EXPENSE_CATEGORIES = new Set([
  'Aluguel',
  'Salários',
  'Ferramentas/Assinaturas',
  'Pró-labore',
  'Internet/Telefonia',
  'Contabilidade',
])

/**
 * Custo dos Serviços Prestados (CSP): o que só existe porque houve venda.
 * A comissão paga ao corretor é custo direto, não "repasse" — a imobiliária
 * fatura a comissão cheia (e é sobre ela que incide o imposto) e paga o
 * corretor como custo de entregar o serviço. "Repasse" fica como sinônimo
 * antigo para não quebrar lançamentos já gravados.
 */
export const COST_OF_SALE_CATEGORIES = new Set([
  'Comissões de Corretores',
  'Repasse a Corretores',
  'Repasse de Comissão',
])

/**
 * Pró-labore é remuneração do sócio pelo TRABALHO: despesa operacional,
 * entra antes do lucro. Distribuição de lucro é remuneração do CAPITAL:
 * sai depois do lucro líquido. Somar os dois como "retirada" mascara o
 * custo real da operação e infla a margem.
 */
export const PRO_LABORE_CATEGORIES = new Set(['Pró-labore', 'Pro-labore'])

/** Classificação DRE de um lançamento (usa o campo salvo, com fallback por categoria/tipo). */
export function dreGroupOf(tx: Transaction): DreGroup {
  // Pró-labore vence o dre_group gravado: lançamentos antigos foram salvos
  // como 'withdrawal' e precisam migrar para despesa operacional.
  if (PRO_LABORE_CATEGORIES.has(tx.category)) return 'operating_expense'
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

/**
 * Data que coloca o lançamento dentro de um mês, conforme o regime:
 * - `accrual` (competência): mês da venda/faturamento, mesmo que o dinheiro caia depois.
 * - `cash` (caixa): mês em que o dinheiro entrou/saiu de fato. Pendente não entra
 *   em mês nenhum — por isso devolve `null`.
 */
export function regimeDate(t: Transaction, regime: Regime): string | null {
  if (regime === 'accrual') return t.competence_date
  if (t.status !== 'settled') return null
  return t.settled_date ?? t.competence_date
}

/**
 * Data usada para POSICIONAR o lançamento numa lista/extrato — diferente de
 * `regimeDate`, que serve para somar KPIs. Aqui um pendente não some: ele
 * aparece na data em que o dinheiro é esperado. É o que faz a comissão de
 * setembro sair de julho quando você está no regime de caixa.
 */
export function listingDate(t: Transaction, regime: Regime): string {
  if (regime === 'accrual') return t.competence_date
  return t.settled_date ?? t.due_date ?? t.competence_date
}

export function inMonth(t: Transaction, date: Date, regime: Regime = 'accrual'): boolean {
  const d = regimeDate(t, regime)
  return d !== null && monthKeyOf(d) === monthKey(date)
}

export function filterTransactions(
  transactions: Transaction[],
  companyId: string | null,
  date: Date,
  regime: Regime = 'accrual',
): Transaction[] {
  return transactions.filter((t) => inScope(t, companyId) && inMonth(t, date, regime))
}

// ---------------------------------------------------------------------------
// KPIs (DRE)
// ---------------------------------------------------------------------------

export interface Kpis {
  /** Receita bruta de serviços — base de cálculo do imposto no Simples. */
  revenue: number
  /** Impostos sobre o faturamento (Simples/ISS/PIS/COFINS). */
  taxDeductions: number
  /** Receita líquida = bruta − impostos. */
  netRevenue: number
  /** Custo dos Serviços Prestados: comissões de corretores. */
  costOfSale: number
  /** Lucro bruto = receita líquida − CSP. O que sobra para pagar a estrutura. */
  grossProfit: number
  grossMargin: number
  /** Despesas operacionais fixas (estrutura, pessoal, pró-labore). */
  operatingExpense: number
  /** Despesas variáveis (marketing, comercial). */
  variableExpense: number
  /** Despesas não classificadas (fallback). */
  otherExpense: number
  /** Resultado operacional antes de juros — capacidade de gerar caixa. */
  ebitda: number
  ebitdaMargin: number
  /** Total de saídas de despesa (não inclui impostos nem distribuição). */
  totalExpense: number
  /** Lucro líquido — depois de imposto, custo e estrutura. */
  netProfit: number
  netMargin: number
  /** Distribuição de lucros ao sócio (sai DEPOIS do lucro líquido). */
  profitDistribution: number
  /** Lucro retido = líquido − distribuição. O que fica na empresa. */
  retainedProfit: number
  /** @deprecated use `profitDistribution` — mantido para compatibilidade. */
  withdrawals: number
  /** Receita já recebida (caixa). */
  received: number
  /** Receita a receber (pipeline). */
  toReceive: number
  /** Despesas já pagas. */
  paid: number
  /** Despesas a pagar. */
  toPay: number
  /** `false` quando a alíquota da empresa não foi configurada. */
  taxConfigured: boolean
  count: number
}

/**
 * DRE do conjunto de lançamentos.
 *
 * `taxRatePct` é a alíquota EFETIVA sobre a receita bruta (ex.: 8.5 para 8,5%).
 * Passar `null` significa "não configurada": o imposto entra como zero e
 * `taxConfigured` fica falso para a tela poder avisar, em vez de mostrar um
 * lucro que não existe.
 */
export function computeKpis(txs: Transaction[], taxRatePct: number | null = null): Kpis {
  let revenue = 0
  let costOfSale = 0
  let operatingExpense = 0
  let variableExpense = 0
  let otherExpense = 0
  let profitDistribution = 0
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
      profitDistribution += t.amount
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

  const taxDeductions = taxRatePct != null ? round2(revenue * (taxRatePct / 100)) : 0
  const netRevenue = revenue - taxDeductions
  const grossProfit = netRevenue - costOfSale
  const structure = operatingExpense + variableExpense + otherExpense
  const ebitda = grossProfit - structure
  // Sem empréstimos/juros modelados, o resultado operacional é o próprio líquido.
  const netProfit = ebitda
  const totalExpense = costOfSale + structure

  return {
    revenue,
    taxDeductions,
    netRevenue,
    costOfSale,
    grossProfit,
    grossMargin: netRevenue > 0 ? grossProfit / netRevenue : 0,
    operatingExpense,
    variableExpense,
    otherExpense,
    ebitda,
    ebitdaMargin: revenue > 0 ? ebitda / revenue : 0,
    totalExpense,
    netProfit,
    netMargin: revenue > 0 ? netProfit / revenue : 0,
    profitDistribution,
    retainedProfit: netProfit - profitDistribution,
    withdrawals: profitDistribution,
    received,
    toReceive,
    paid,
    toPay,
    taxConfigured: taxRatePct != null,
    count: txs.length,
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Alíquota efetiva configurada para a empresa, ou `null` se não houver. */
export function taxRateOf(companies: Company[], companyId: string): number | null {
  return companies.find((c) => c.id === companyId)?.tax_rate ?? null
}

/**
 * DRE consolidado de várias empresas. Cada uma é apurada com a PRÓPRIA
 * alíquota e só depois os resultados são somados — somar o faturamento
 * do grupo e aplicar uma alíquota média daria imposto errado, porque
 * Imobiliária, Escola e Assessoria têm enquadramentos distintos.
 */
export function computeKpisMulti(txs: Transaction[], companies: Company[]): Kpis {
  const byCompany = new Map<string, Transaction[]>()
  for (const t of txs) {
    const arr = byCompany.get(t.company_id)
    if (arr) arr.push(t)
    else byCompany.set(t.company_id, [t])
  }

  const parts = [...byCompany.entries()].map(([companyId, list]) =>
    computeKpis(list, taxRateOf(companies, companyId)),
  )
  return sumKpis(parts, txs.length)
}

/** Soma DREs já apurados. Margens são recalculadas sobre os totais. */
export function sumKpis(parts: Kpis[], count: number): Kpis {
  const acc = parts.reduce<Kpis>(
    (a, k) => ({
      ...a,
      revenue: a.revenue + k.revenue,
      taxDeductions: a.taxDeductions + k.taxDeductions,
      netRevenue: a.netRevenue + k.netRevenue,
      costOfSale: a.costOfSale + k.costOfSale,
      grossProfit: a.grossProfit + k.grossProfit,
      operatingExpense: a.operatingExpense + k.operatingExpense,
      variableExpense: a.variableExpense + k.variableExpense,
      otherExpense: a.otherExpense + k.otherExpense,
      ebitda: a.ebitda + k.ebitda,
      totalExpense: a.totalExpense + k.totalExpense,
      netProfit: a.netProfit + k.netProfit,
      profitDistribution: a.profitDistribution + k.profitDistribution,
      retainedProfit: a.retainedProfit + k.retainedProfit,
      withdrawals: a.withdrawals + k.withdrawals,
      received: a.received + k.received,
      toReceive: a.toReceive + k.toReceive,
      paid: a.paid + k.paid,
      toPay: a.toPay + k.toPay,
      // Só é "configurado" se TODAS as empresas com receita tiverem alíquota.
      taxConfigured: a.taxConfigured && k.taxConfigured,
    }),
    { ...EMPTY_KPIS, taxConfigured: true },
  )

  return {
    ...acc,
    grossMargin: acc.netRevenue > 0 ? acc.grossProfit / acc.netRevenue : 0,
    ebitdaMargin: acc.revenue > 0 ? acc.ebitda / acc.revenue : 0,
    netMargin: acc.revenue > 0 ? acc.netProfit / acc.revenue : 0,
    count,
  }
}

const EMPTY_KPIS: Kpis = {
  revenue: 0,
  taxDeductions: 0,
  netRevenue: 0,
  costOfSale: 0,
  grossProfit: 0,
  grossMargin: 0,
  operatingExpense: 0,
  variableExpense: 0,
  otherExpense: 0,
  ebitda: 0,
  ebitdaMargin: 0,
  totalExpense: 0,
  netProfit: 0,
  netMargin: 0,
  profitDistribution: 0,
  retainedProfit: 0,
  withdrawals: 0,
  received: 0,
  toReceive: 0,
  paid: 0,
  toPay: 0,
  taxConfigured: false,
  count: 0,
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
  regime: Regime = 'accrual',
  companies: Company[] = [],
): MonthlyPoint[] {
  return months.map((date) => {
    const kpis = computeKpisMulti(
      filterTransactions(transactions, companyId, date, regime),
      companies,
    )
    return {
      date,
      monthKey: monthKey(date),
      revenue: kpis.revenue,
      expense: kpis.totalExpense + kpis.taxDeductions,
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

/**
 * Pendências em aberto — o que ainda vai entrar ou sair. Independe do regime:
 * são compromissos, não competência. É o que mantém o painel útil num mês
 * sem nenhum lançamento novo.
 */
export interface Pipeline {
  /** Tudo que ainda há de receber, em qualquer data. */
  receivable: number
  payable: number
  /** Vencidos: previsão já passou e ninguém deu baixa. */
  overdueReceivable: number
  overduePayable: number
  overdueCount: number
  /** Vence dentro do mês em foco. */
  dueThisMonthIn: number
  dueThisMonthOut: number
  /** Próximos 30 dias a partir de hoje. */
  next30In: number
  next30Out: number
}

export function pipelineSummary(txs: Transaction[], date: Date, today = new Date()): Pipeline {
  const todayStr = isoDate(today)
  const in30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)
  const in30Str = isoDate(in30)
  const focusMonth = monthKey(date)

  const p: Pipeline = {
    receivable: 0,
    payable: 0,
    overdueReceivable: 0,
    overduePayable: 0,
    overdueCount: 0,
    dueThisMonthIn: 0,
    dueThisMonthOut: 0,
    next30In: 0,
    next30Out: 0,
  }

  for (const t of txs) {
    if (t.status !== 'pending') continue
    const due = t.due_date ?? t.competence_date
    const isIn = dreGroupOf(t) === 'revenue'

    if (isIn) p.receivable += t.amount
    else p.payable += t.amount

    if (due < todayStr) {
      if (isIn) p.overdueReceivable += t.amount
      else p.overduePayable += t.amount
      p.overdueCount += 1
    }

    if (monthKeyOf(due) === focusMonth) {
      if (isIn) p.dueThisMonthIn += t.amount
      else p.dueThisMonthOut += t.amount
    }

    if (due >= todayStr && due <= in30Str) {
      if (isIn) p.next30In += t.amount
      else p.next30Out += t.amount
    }
  }

  return p
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
// Finanças pessoais
// ---------------------------------------------------------------------------

export interface PersonalSummary {
  /** Retiradas das empresas (pró-labore + distribuição) no mês → entrada pessoal. */
  inflowFromBusiness: number
  /** Receitas pessoais lançadas manualmente. */
  inflowManual: number
  inflow: number
  outflow: number
  surplus: number
  invested: number
  byCategory: { name: string; value: number }[]
}

const INVEST_CATEGORY = 'Investimentos/Poupança'

/**
 * Resumo pessoal do mês. `personalTx` = lançamentos do ledger Pessoal;
 * `businessTx` = transações das empresas (usadas só para captar as retiradas).
 */
export function personalSummary(
  personalTx: Transaction[],
  businessTx: Transaction[],
  date: Date,
  regime: Regime = 'accrual',
): PersonalSummary {
  let inflowManual = 0
  let outflow = 0
  let invested = 0
  const catMap = new Map<string, number>()

  for (const t of personalTx) {
    if (!inMonth(t, date, regime)) continue
    if (t.kind === 'income') {
      inflowManual += t.amount
    } else if (t.kind === 'expense') {
      outflow += t.amount
      catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount)
      if (t.category === INVEST_CATEGORY) invested += t.amount
    }
  }

  const inflowFromBusiness = businessTx
    .filter((t) => dreGroupOf(t) === 'withdrawal' && inMonth(t, date, regime))
    .reduce((s, t) => s + t.amount, 0)

  const inflow = inflowFromBusiness + inflowManual
  const byCategory = [...catMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return { inflowFromBusiness, inflowManual, inflow, outflow, surplus: inflow - outflow, invested, byCategory }
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
        title: `Comissões altas em ${e.companyName}`,
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
