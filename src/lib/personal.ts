import {
  INVEST_CATEGORY,
  OWNER_TRANSFER_CATEGORY,
  PRO_LABORE_CATEGORIES,
  computeKpis,
  filterTransactions,
  inMonth,
  isOwnerPayout,
  lastNMonths,
  monthKey,
  personalSummary,
  taxRateOf,
} from './finance'
import { treasurySummary } from './treasury'
import { toDateOnly } from './format'
import type {
  Account,
  Company,
  PersonalAsset,
  Regime,
  Transaction,
  Transfer,
} from '@/types'

/**
 * Indicadores de planejamento financeiro pessoal — a camada que separa "lista
 * de gastos" de gestão de patrimônio. Tudo derivado dos lançamentos que já
 * existem; nada aqui exige digitação extra, exceto os bens (personal_assets),
 * que o sistema não tem como descobrir sozinho.
 */

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Último dia do mês em 'YYYY-MM-DD'. */
export function endOfMonth(date: Date): string {
  return toDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

// ---------------------------------------------------------------------------
// Custo de vida e taxa de poupança
// ---------------------------------------------------------------------------

export interface MonthlyPersonalPoint {
  date: Date
  monthKey: string
  inflow: number
  outflow: number
  /** Saídas que são consumo (exclui o que foi guardado e o que é da empresa). */
  livingCost: number
  invested: number
  /** Despesa da empresa paga do bolso pessoal — saída real, mas não custo de vida. */
  businessPaid: number
  surplus: number
  /** (entradas − saídas) / entradas. `null` quando não houve renda no mês. */
  savingsRate: number | null
}

/**
 * Série mensal do ledger pessoal. `livingCost` exclui duas categorias:
 * investimento (guardar não é gastar) e despesa da empresa paga do bolso
 * pessoal (se a renda parasse, o gasto pararia junto). Contá-las como custo de
 * vida inflaria o custo e derrubaria a reserva de emergência sem motivo.
 */
export function personalMonthlySeries(
  personalTx: Transaction[],
  businessTx: Transaction[],
  months: Date[],
  regime: Regime = 'cash',
): MonthlyPersonalPoint[] {
  return months.map((date) => {
    const s = personalSummary(personalTx, businessTx, date, regime)
    const livingCost = round2(s.outflow - s.invested - s.businessPaid)
    return {
      date,
      monthKey: monthKey(date),
      inflow: round2(s.inflow),
      outflow: round2(s.outflow),
      livingCost,
      invested: round2(s.invested),
      businessPaid: round2(s.businessPaid),
      surplus: round2(s.surplus),
      savingsRate: s.inflow > 0 ? s.surplus / s.inflow : null,
    }
  })
}

export interface PersonalVitals {
  /** Taxa de poupança do mês em foco. `null` se não houve renda. */
  savingsRateMonth: number | null
  /** Média da taxa de poupança dos meses fechados considerados. */
  savingsRateAvg: number | null
  /** Custo de vida médio dos meses FECHADOS (o mês corrente é parcial). */
  livingCostAvg: number
  /** Quantos meses fechados entraram na média — abaixo de 3 o número é frágil. */
  monthsUsed: number
  /** Dinheiro líquido disponível hoje (contas + investimentos − dívida de cartão). */
  liquid: number
  /** Reserva de emergência em meses. `null` sem custo de vida apurado. */
  reserveMonths: number | null
  /** Série usada, do mais antigo ao mais recente (inclui o mês em foco). */
  series: MonthlyPersonalPoint[]
}

/**
 * Os três números que respondem "como estou de verdade": quanto sobra do que
 * entra, quanto custa minha vida por mês, e por quantos meses eu aguento sem
 * receber nada.
 *
 * O mês em foco é excluído das MÉDIAS quando ainda está em curso — meio mês de
 * gasto viraria um custo de vida artificialmente baixo.
 */
export function personalVitals(
  personalTx: Transaction[],
  businessTx: Transaction[],
  accounts: Account[],
  transfers: Transfer[],
  period: Date,
  regime: Regime = 'cash',
  lookback = 12,
  today = new Date(),
): PersonalVitals {
  const months = lastNMonths(period, lookback)
  const series = personalMonthlySeries(personalTx, businessTx, months, regime)

  const currentKey = monthKey(today)
  const closed = series.filter((p) => p.monthKey < currentKey)
  // Meses sem nenhum movimento não são "custo de vida zero" — são ausência de
  // dado. Entrar na média puxaria o custo para baixo e inflaria a reserva.
  const withActivity = closed.filter((p) => p.inflow > 0 || p.outflow > 0)

  const livingCostAvg =
    withActivity.length > 0
      ? round2(withActivity.reduce((s, p) => s + p.livingCost, 0) / withActivity.length)
      : 0

  const rates = withActivity.map((p) => p.savingsRate).filter((r): r is number => r !== null)
  const savingsRateAvg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null

  const inFocus = series.find((p) => p.monthKey === monthKey(period))

  const treasury = treasurySummary(accounts, personalTx, transfers, toDateOnly(today))
  const liquid = round2(treasury.available - treasury.cardDebt)

  return {
    savingsRateMonth: inFocus?.savingsRate ?? null,
    savingsRateAvg,
    livingCostAvg,
    monthsUsed: withActivity.length,
    liquid,
    reserveMonths: livingCostAvg > 0 ? round2(liquid / livingCostAvg) : null,
    series,
  }
}

// ---------------------------------------------------------------------------
// Patrimônio líquido
// ---------------------------------------------------------------------------

export interface NetWorth {
  /** Contas correntes, poupança, dinheiro e investimentos. */
  cash: number
  /** Bens informados à mão (imóveis, veículos, participações). */
  assets: number
  /** Dívida de cartão (faturas em aberto). */
  cardDebt: number
  /** Financiamentos e empréstimos informados à mão. */
  debts: number
  /** cash + assets − cardDebt − debts. */
  net: number
}

export function netWorth(
  accounts: Account[],
  personalTx: Transaction[],
  transfers: Transfer[],
  assets: PersonalAsset[],
  upto: string = toDateOnly(new Date()),
): NetWorth {
  const t = treasurySummary(accounts, personalTx, transfers, upto)
  const active = assets.filter((a) => a.is_active)
  const assetsTotal = round2(
    active.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.value, 0),
  )
  const debtsTotal = round2(
    active.filter((a) => a.kind === 'liability').reduce((s, a) => s + a.value, 0),
  )
  return {
    cash: t.available,
    assets: assetsTotal,
    cardDebt: t.cardDebt,
    debts: debtsTotal,
    net: round2(t.available + assetsTotal - t.cardDebt - debtsTotal),
  }
}

export interface NetWorthPoint {
  date: Date
  monthKey: string
  net: number
  cash: number
}

/**
 * Evolução do patrimônio mês a mês. Os saldos das contas são recalculados na
 * data de cada mês (dado real); os bens informados à mão entram pelo valor
 * ATUAL em todos os meses — o sistema não guarda o histórico de avaliação
 * deles, então a curva mostra a variação de caixa e dívida, não a valorização
 * dos imóveis. A tela diz isso ao usuário.
 */
export function netWorthSeries(
  accounts: Account[],
  personalTx: Transaction[],
  transfers: Transfer[],
  assets: PersonalAsset[],
  months: Date[],
  today = new Date(),
): NetWorthPoint[] {
  const todayStr = toDateOnly(today)
  return months.map((date) => {
    const end = endOfMonth(date)
    // Mês futuro não tem saldo: trava em hoje para não projetar nada.
    const upto = end > todayStr ? todayStr : end
    const nw = netWorth(accounts, personalTx, transfers, assets, upto)
    return { date, monthKey: monthKey(date), net: nw.net, cash: nw.cash }
  })
}

// ---------------------------------------------------------------------------
// Renda do dono (PJ → PF)
// ---------------------------------------------------------------------------

export interface OwnerIncomeCompany {
  company: Company
  /** Pró-labore: remuneração do trabalho, tributável e recorrente. */
  proLabore: number
  /** Distribuição de lucros: remuneração do capital, isenta e variável. */
  distribution: number
  total: number
}

export interface OwnerIncome {
  byCompany: OwnerIncomeCompany[]
  proLabore: number
  distribution: number
  total: number
  /** Média mensal do total nos meses considerados. */
  monthlyAvg: number
  /** Quantas vezes a renda cobre o custo de vida. `null` sem custo apurado. */
  coverage: number | null
  /** Fatia da renda que veio de distribuição (variável). */
  distributionShare: number
  monthsUsed: number
}

/**
 * Quanto suas empresas te pagam, separando pró-labore de distribuição.
 *
 * A distinção não é cosmética: pró-labore é previsível e tributado;
 * distribuição depende de ter lucro. Custo de vida coberto por distribuição é
 * um risco silencioso — se o lucro cai, a vida pessoal aperta junto.
 */
export function ownerIncome(
  businessTx: Transaction[],
  companies: Company[],
  months: Date[],
  regime: Regime = 'cash',
  livingCostAvg = 0,
): OwnerIncome {
  const byId = new Map<string, OwnerIncomeCompany>()
  for (const c of companies) {
    if (c.is_personal) continue
    byId.set(c.id, { company: c, proLabore: 0, distribution: 0, total: 0 })
  }

  for (const t of businessTx) {
    if (!isOwnerPayout(t)) continue
    if (!months.some((m) => inMonth(t, m, regime))) continue
    const entry = byId.get(t.company_id)
    if (!entry) continue
    if (PRO_LABORE_CATEGORIES.has(t.category)) entry.proLabore += t.amount
    else entry.distribution += t.amount
    entry.total += t.amount
  }

  const byCompany = [...byId.values()]
    .map((e) => ({
      ...e,
      proLabore: round2(e.proLabore),
      distribution: round2(e.distribution),
      total: round2(e.total),
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)

  const proLabore = round2(byCompany.reduce((s, e) => s + e.proLabore, 0))
  const distribution = round2(byCompany.reduce((s, e) => s + e.distribution, 0))
  const total = round2(proLabore + distribution)
  const monthlyAvg = months.length > 0 ? round2(total / months.length) : 0

  return {
    byCompany,
    proLabore,
    distribution,
    total,
    monthlyAvg,
    coverage: livingCostAvg > 0 ? round2(monthlyAvg / livingCostAvg) : null,
    distributionShare: total > 0 ? distribution / total : 0,
    monthsUsed: months.length,
  }
}

// ---------------------------------------------------------------------------
// Distribuição sugerida (quanto dá para tirar sem descapitalizar)
// ---------------------------------------------------------------------------

export interface DistributionSuggestion {
  company: Company
  /** Caixa da empresa hoje (contas dela). */
  cash: number
  /** Despesa mensal média — a régua da reserva. */
  monthlyExpense: number
  /** Caixa que precisa ficar: `reserveMonths` × despesa mensal. */
  reserveNeeded: number
  /** Lucro acumulado no período menos o que já foi distribuído. */
  undistributedProfit: number
  /** O menor entre a folga de caixa e o lucro ainda não distribuído. */
  suggested: number
  /** Motivo do limite, para a tela explicar em vez de só mostrar número. */
  limitedBy: 'caixa' | 'lucro' | 'nada'
}

/**
 * Quanto cada empresa comporta distribuir agora.
 *
 * Duas travas, e vence a menor: você não pode distribuir o que não virou lucro
 * (senão está devolvendo capital, não repartindo resultado), nem tirar o caixa
 * que a operação precisa para andar nos próximos meses.
 */
export function suggestedDistribution(
  businessTx: Transaction[],
  companies: Company[],
  accounts: Account[],
  transfers: Transfer[],
  months: Date[],
  regime: Regime = 'cash',
  reserveMonths = 2,
  today = new Date(),
): DistributionSuggestion[] {
  const todayStr = toDateOnly(today)

  return companies
    .filter((c) => !c.is_personal)
    .map((company) => {
      const companyAccounts = accounts.filter((a) => a.company_id === company.id)
      const cash = treasurySummary(companyAccounts, businessTx, transfers, todayStr).available

      let profit = 0
      let distributed = 0
      let expense = 0
      for (const m of months) {
        const txs = filterTransactions(businessTx, company.id, m, regime)
        const k = computeKpis(txs, taxRateOf(companies, company.id))
        profit += k.netProfit
        distributed += k.profitDistribution
        expense += k.totalExpense + k.taxDeductions
      }

      const monthlyExpense = months.length > 0 ? round2(expense / months.length) : 0
      const reserveNeeded = round2(monthlyExpense * reserveMonths)
      const undistributedProfit = round2(profit - distributed)
      const cashHeadroom = round2(cash - reserveNeeded)
      const suggested = round2(Math.max(0, Math.min(cashHeadroom, undistributedProfit)))

      const limitedBy: DistributionSuggestion['limitedBy'] =
        suggested <= 0 ? 'nada' : cashHeadroom < undistributedProfit ? 'caixa' : 'lucro'

      return {
        company,
        cash,
        monthlyExpense,
        reserveNeeded,
        undistributedProfit,
        suggested,
        limitedBy,
      }
    })
    .sort((a, b) => b.suggested - a.suggested)
}

// ---------------------------------------------------------------------------
// Relatório anual (apoio à declaração de IR)
// ---------------------------------------------------------------------------

export interface AnnualCategoryRow {
  category: string
  total: number
  months: number
}

export interface AnnualReport {
  year: number
  /** Renda tributável (pró-labore) recebida das empresas. */
  proLabore: number
  /** Renda isenta (distribuição de lucros). */
  distribution: number
  /** Receitas pessoais lançadas à mão. */
  otherIncome: number
  expensesByCategory: AnnualCategoryRow[]
  totalExpenses: number
  invested: number
  net: number
}

/**
 * Consolidado do ano por categoria. Não substitui a declaração, mas põe no
 * mesmo lugar o que o contador sempre pede: o que veio como pró-labore
 * (tributável) versus distribuição (isenta), e o gasto por categoria.
 */
export function annualReport(
  personalTx: Transaction[],
  businessTx: Transaction[],
  year: number,
  regime: Regime = 'cash',
): AnnualReport {
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))

  let proLabore = 0
  let distribution = 0
  for (const t of businessTx) {
    if (!isOwnerPayout(t)) continue
    if (!months.some((m) => inMonth(t, m, regime))) continue
    if (PRO_LABORE_CATEGORIES.has(t.category)) proLabore += t.amount
    else distribution += t.amount
  }

  let otherIncome = 0
  let invested = 0
  const byCategory = new Map<string, { total: number; months: Set<string> }>()

  for (const t of personalTx) {
    const m = months.find((mm) => inMonth(t, mm, regime))
    if (!m) continue
    if (t.kind === 'income') {
      // Retirada de empresa já foi contada pelo razão dela — ver
      // OWNER_TRANSFER_CATEGORY. Somar aqui dobraria a renda do ano.
      if (t.category !== OWNER_TRANSFER_CATEGORY) otherIncome += t.amount
      continue
    }
    if (t.kind !== 'expense') continue
    if (t.category === INVEST_CATEGORY) invested += t.amount
    const entry = byCategory.get(t.category)
    if (entry) {
      entry.total += t.amount
      entry.months.add(monthKey(m))
    } else {
      byCategory.set(t.category, { total: t.amount, months: new Set([monthKey(m)]) })
    }
  }

  const expensesByCategory = [...byCategory.entries()]
    .map(([category, v]) => ({ category, total: round2(v.total), months: v.months.size }))
    .sort((a, b) => b.total - a.total)

  const totalExpenses = round2(expensesByCategory.reduce((s, r) => s + r.total, 0))
  const totalIncome = round2(proLabore + distribution + otherIncome)

  return {
    year,
    proLabore: round2(proLabore),
    distribution: round2(distribution),
    otherIncome: round2(otherIncome),
    expensesByCategory,
    totalExpenses,
    invested: round2(invested),
    net: round2(totalIncome - totalExpenses),
  }
}
