import { BUSINESS_CATEGORY, INVEST_CATEGORY, inMonth, monthKey } from './finance'
import type { Account, Regime, Transaction } from '@/types'

/**
 * Leitura inteligente do gasto pessoal: não "quanto saiu", mas **para onde**,
 * **com quem**, **o que se repete** e **o que mudou**.
 *
 * Tudo aqui é derivado do que já está lançado — nada exige digitação extra.
 * Cada função responde a uma pergunta que o extrato não responde sozinho:
 *
 *  · `cardSpendByCategory` — onde o cartão dói mais
 *  · `topMerchants`        — os estabelecimentos que comem o orçamento
 *  · `recurringSpend`      — o que se repete todo mês (o custo fixo real)
 *  · `categoryTrends`      — o que subiu e o que caiu contra a própria média
 *  · `spendingPace`        — o ritmo do mês e onde ele fecha
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 'YYYY-MM-DD' + n meses, com clamp no último dia do mês curto. */
function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const total = m - 1 + n
  const ano = y + Math.floor(total / 12)
  const mes = ((total % 12) + 12) % 12
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/**
 * Dispersão dos valores mensais (desvio ÷ média). Perto de 0 = mesma quantia
 * todo mês (assinatura, pensão); alto = coincidência de ter ido ao mercado em
 * três meses seguidos, que não é compromisso fixo nenhum.
 */
function variacao(valores: number[]): number {
  if (valores.length < 2) return 0
  const media = valores.reduce((s, v) => s + v, 0) / valores.length
  if (media === 0) return 0
  const varia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length
  return Math.sqrt(varia) / media
}

/** Despesa de consumo: fora investimento e fora despesa da empresa. */
function isLivingExpense(t: Transaction): boolean {
  return t.kind === 'expense' && t.category !== INVEST_CATEGORY && t.category !== BUSINESS_CATEGORY
}

/**
 * Nome do estabelecimento sem o ruído da maquininha.
 *
 * A fatura vem com prefixo de adquirente ('EC *', 'CAPPTA *', 'IFD *'),
 * cidade colada no fim e o sufixo de parcela que o import acrescenta. Sem
 * limpar isso, a mesma padaria vira cinco estabelecimentos diferentes e o
 * ranking não serve para nada.
 */
export function merchantName(description: string): string {
  const original = description.replace(/\s*\(\d+\/\d+\)\s*$/, '').replace(/\s+—\s+.*$/, '').trim()
  // Alternativas MAIS LONGAS primeiro: com 'PG' antes de 'PGZ', 'pgz*Tiagophon'
  // perderia só o 'PG' e viraria 'z*Tiagophon'.
  let s = original
    .replace(/^(JIM\.COM|ADIQPLU|CAPPTA|VINDI|PGZ|EBN|MTD|HNA|IFD|MP|EC|PG|ZP|IG|FT)\s*\*?\s*/i, '')
    .replace(/^\*+/, '')
    .trim()
  // Cidade em CAIXA ALTA no fim ('MERCADO VELHO ITAJAI') — tira só quando
  // sobra nome suficiente, senão come o próprio estabelecimento.
  const semCidade = s.replace(
    /\s+(ITAJAI|ITAJA|BALNEARIO CAM|BALNEARIO|NAVEGANTES|SAO PAULO|SAO PAUL|ILHOTA|PALHOCA|BLUMENAU|PENHA|CAMBORIU|CASCAVEL|CAJAMAR|OSASCO|BELO HORIZONT|BELO HORIZ|ITAIM BIBI|BARUERI|CURITIBA|LAJEADO|GUARAPUAVA|FLORIANOPOL I?|SO PAULO|IPATINGA|TUBARAO|QUATRO BARRAS|PARIQUERA-?\s?ACU|REGISTRO|SAO VICENTE|TIJU\w*)\s*$/i,
    '',
  )
  if (semCidade.trim().length >= 4) s = semCidade
  s = s.trim().replace(/\s{2,}/g, ' ').replace(/[.\s]+$/, '')
  // Tirar o prefixo da adquirente às vezes deixa só o código do lojista
  // ('ADIQPLU*50 609 008' → '50 609 008'). Sem letra que dê para ler, é melhor
  // devolver o nome original do que mostrar um número no ranking.
  return /[A-Za-zÀ-ú]{3}/.test(s) ? s : original
}

/** Chave de agrupamento: ignora pontuação e caixa ('APPLE.COM/BILL' = 'APPLECOMBILL'). */
function merchantKey(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// Onde o cartão dói
// ---------------------------------------------------------------------------

export interface CategorySlice {
  category: string
  total: number
  count: number
  /** Fatia do total (0–1). */
  share: number
}

/**
 * Gasto do cartão por categoria no período. Diferente do gráfico geral da
 * página: aqui entra SÓ o que passou no cartão, que é a pergunta "no que eu
 * mais gasto no crédito".
 */
export function cardSpendByCategory(
  transactions: Transaction[],
  cardIds: Set<string>,
  months: Date[],
  regime: Regime = 'cash',
): CategorySlice[] {
  const map = new Map<string, { total: number; count: number }>()
  let total = 0
  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    if (!t.account_id || !cardIds.has(t.account_id)) continue
    if (!months.some((m) => inMonth(t, m, regime))) continue
    const e = map.get(t.category) ?? { total: 0, count: 0 }
    e.total += t.amount
    e.count += 1
    map.set(t.category, e)
    total += t.amount
  }
  return [...map.entries()]
    .map(([category, e]) => ({
      category,
      total: round2(e.total),
      count: e.count,
      share: total > 0 ? e.total / total : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

// ---------------------------------------------------------------------------
// Com quem o dinheiro fica
// ---------------------------------------------------------------------------

export interface MerchantRow {
  merchant: string
  total: number
  count: number
  category: string
  /** Em quantos meses distintos apareceu — 1 é compra avulsa. */
  months: number
  /** Maior valor único, para separar "muitas comprinhas" de "uma compra grande". */
  biggest: number
}

interface Bucket {
  display: string
  total: number
  count: number
  cats: Map<string, number>
  months: Set<string>
  biggest: number
  /** Total por mês — usado para medir se o valor é estável. */
  perMonth: Map<string, number>
}

/**
 * Agrupa lançamentos por estabelecimento, ABATENDO os estornos.
 *
 * O estorno é `kind = 'income'` na mesma conta e com a mesma descrição da
 * compra. Sem abater, uma academia cobrada e devolvida no mesmo dia continua
 * aparecendo como gasto ativo — foi exatamente o que aconteceu na conta do
 * Rafael em junho.
 */
function bucketByMerchant(
  transactions: Transaction[],
  months: Date[],
  regime: Regime,
  accept: (t: Transaction) => boolean,
): Map<string, Bucket> {
  const map = new Map<string, Bucket>()
  for (const t of transactions) {
    const estorno = t.kind === 'income' && t.account_id != null
    if (!estorno && !accept(t)) continue
    if (estorno && t.category === INVEST_CATEGORY) continue
    const m = months.find((mm) => inMonth(t, mm, regime))
    if (!m) continue
    const display = merchantName(t.description || t.category)
    if (!display) continue
    const key = merchantKey(display)
    if (!key) continue
    const mk = monthKey(m)
    const e =
      map.get(key) ??
      {
        display,
        total: 0,
        count: 0,
        cats: new Map(),
        months: new Set<string>(),
        biggest: 0,
        perMonth: new Map<string, number>(),
      }
    if (estorno) {
      // Só abate de quem já tem gasto: um crédito solto (reembolso avulso) não
      // deve criar estabelecimento com total negativo no ranking.
      if (e.count === 0) continue
      e.total -= t.amount
      e.cats.set(t.category, (e.cats.get(t.category) ?? 0) - t.amount)
      e.perMonth.set(mk, (e.perMonth.get(mk) ?? 0) - t.amount)
    } else {
      e.total += t.amount
      e.count += 1
      e.biggest = Math.max(e.biggest, t.amount)
      e.months.add(mk)
      e.cats.set(t.category, (e.cats.get(t.category) ?? 0) + t.amount)
      e.perMonth.set(mk, (e.perMonth.get(mk) ?? 0) + t.amount)
    }
    map.set(key, e)
  }
  return map
}

function topCategory(cats: Map<string, number>): string {
  return [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

/** Ranking de estabelecimentos por total gasto no período. */
export function topMerchants(
  transactions: Transaction[],
  months: Date[],
  regime: Regime = 'cash',
  limit = 12,
): MerchantRow[] {
  return [...bucketByMerchant(transactions, months, regime, isLivingExpense).values()]
    .filter((e) => e.total > 0.005)
    .map((e) => ({
      merchant: e.display,
      total: round2(e.total),
      count: e.count,
      months: e.months.size,
      biggest: round2(e.biggest),
      category: topCategory(e.cats),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// O que se repete — o custo fixo de verdade
// ---------------------------------------------------------------------------

export interface RecurringRow {
  merchant: string
  category: string
  /** Média por mês entre os meses em que apareceu. */
  monthly: number
  months: number
  total: number
  /** Ainda aparece no mês mais recente da janela? Se não, provavelmente acabou. */
  active: boolean
}

export interface RecurringSummary {
  rows: RecurringRow[]
  /** Soma mensal só dos que continuam ativos — o compromisso fixo real. */
  monthlyTotal: number
  /** Assinaturas/serviços que sumiram: dinheiro que parou de sair. */
  ended: RecurringRow[]
}

/**
 * Detecta gasto recorrente sem depender do usuário marcar nada: o mesmo
 * estabelecimento aparecendo em `minMonths` meses distintos da janela.
 *
 * Compra PARCELADA fica de fora — ela tem fim, e misturar as duas coisas dá um
 * "custo fixo" que nunca cai. Parcelamento é assunto de `activeInstallments`.
 *
 * O total mensal considera só os ATIVOS. Uma academia cancelada em maio não
 * pode continuar pesando no custo fixo de agosto — esse é justamente o erro
 * que faz a pessoa achar que gasta mais do que gasta.
 */
export function recurringSpend(
  transactions: Transaction[],
  months: Date[],
  regime: Regime = 'cash',
  minMonths = 3,
): RecurringSummary {
  if (months.length === 0) return { rows: [], monthlyTotal: 0, ended: [] }
  const lastTwo = new Set(months.map(monthKey).sort().slice(-2))
  const map = bucketByMerchant(
    transactions,
    months,
    regime,
    (t) => isLivingExpense(t) && !t.installment_count,
  )

  const rows: RecurringRow[] = [...map.values()]
    .filter((e) => e.months.size >= minMonths && e.total > 0.005)
    // Repetir não basta: o valor precisa ser parecido todo mês. Ir ao mercado
    // em três meses seguidos não cria despesa fixa — só assinatura, mensalidade
    // e conta de consumo têm valor estável.
    .filter((e) => variacao([...e.perMonth.values()]) <= 0.7)
    .map((e) => ({
      merchant: e.display,
      category: topCategory(e.cats),
      monthly: round2(e.total / e.months.size),
      months: e.months.size,
      total: round2(e.total),
      active: [...e.months].some((k) => lastTwo.has(k)),
    }))
    .sort((a, b) => b.monthly - a.monthly)

  const ativos = rows.filter((r) => r.active)
  return {
    rows: ativos,
    monthlyTotal: round2(ativos.reduce((s, r) => s + r.monthly, 0)),
    ended: rows.filter((r) => !r.active),
  }
}

// ---------------------------------------------------------------------------
// Parcelamentos em curso — compromisso fixo COM data de validade
// ---------------------------------------------------------------------------

export interface InstallmentPlan {
  label: string
  category: string
  /** Valor da parcela mensal. */
  monthly: number
  /** Parcelas que ainda vão cair. */
  remaining: number
  count: number
  /** Mês da última parcela ('YYYY-MM'). */
  endsAt: string
  /** Quanto ainda falta pagar no total. */
  outstanding: number
}

/**
 * Parcelamentos que ainda estão correndo, com quando acabam.
 *
 * É a diferença entre "meu fixo é X" e "meu fixo é X, mas cai R$ 414 em
 * dezembro quando o MacBook terminar" — a segunda frase é a que dá para
 * planejar em cima.
 */
export function activeInstallments(
  transactions: Transaction[],
  today: string,
  limit = 12,
): InstallmentPlan[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.kind !== 'expense' || !t.group_id || !t.installment_count) continue
    // Mesmo recorte de `isLivingExpense`: o Eemovel parcelado é compromisso da
    // imobiliária, não do Rafael. Contá-lo aqui inflaria a fatia "fixa" contra
    // um custo de vida que já o exclui.
    if (!isLivingExpense(t)) continue
    const arr = groups.get(t.group_id)
    if (arr) arr.push(t)
    else groups.set(t.group_id, [t])
  }

  const planos: InstallmentPlan[] = []
  for (const items of groups.values()) {
    const ref = items[0]
    const count = ref.installment_count ?? items.length
    const dataDe = (t: Transaction) => t.settled_date ?? t.competence_date
    const ordenadas = [...items].sort((a, b) => (dataDe(a) < dataDe(b) ? -1 : 1))
    const ultima = ordenadas[ordenadas.length - 1]

    // Faltam as parcelas com data futura MAIS as que nem foram lançadas.
    // A importação de fatura só traz o que já apareceu no extrato: sem esta
    // segunda parcela da conta, um financiamento de 60x com 35 lançadas
    // sumiria do painel justamente por ser o maior compromisso do mês.
    const futuras = items.filter((t) => dataDe(t) > today)
    const maiorIndice = items.reduce((n, t) => Math.max(n, t.installment_index ?? 0), 0)
    const naoLancadas = Math.max(0, count - maiorIndice)
    const remaining = futuras.length + naoLancadas
    if (remaining === 0) continue // parcelamento encerrado

    const monthly = round2(ultima.amount)
    planos.push({
      label: merchantName(ref.description || ref.category),
      category: ref.category,
      monthly,
      remaining,
      count,
      endsAt: addMonths(dataDe(ultima), naoLancadas).slice(0, 7),
      outstanding: round2(
        futuras.reduce((s, t) => s + t.amount, 0) + naoLancadas * monthly,
      ),
    })
  }
  return planos.sort((a, b) => b.monthly - a.monthly).slice(0, limit)
}

// ---------------------------------------------------------------------------
// O que mudou
// ---------------------------------------------------------------------------

export interface CategoryTrend {
  category: string
  current: number
  /** Média dos meses anteriores da janela (exclui o mês em foco). */
  average: number
  diff: number
  /** Variação em fração; `null` quando não havia base de comparação. */
  pct: number | null
}

/**
 * Compara o mês em foco com a média dos meses anteriores, categoria a
 * categoria. É o que transforma "gastei R$ 900 em restaurante" em "gastei
 * R$ 300 a mais que o meu normal".
 *
 * Categorias que aparecem só no mês em foco entram com `pct = null`: é gasto
 * novo, não aumento — misturar os dois produziria variações de +∞.
 */
export function categoryTrends(
  transactions: Transaction[],
  period: Date,
  previous: Date[],
  regime: Regime = 'cash',
): CategoryTrend[] {
  const cur = new Map<string, number>()
  const prev = new Map<string, number>()

  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    if (inMonth(t, period, regime)) {
      cur.set(t.category, (cur.get(t.category) ?? 0) + t.amount)
      continue
    }
    if (previous.some((m) => inMonth(t, m, regime))) {
      prev.set(t.category, (prev.get(t.category) ?? 0) + t.amount)
    }
  }

  const n = Math.max(1, previous.length)
  const names = new Set([...cur.keys(), ...prev.keys()])
  return [...names]
    .map((category) => {
      const current = round2(cur.get(category) ?? 0)
      const average = round2((prev.get(category) ?? 0) / n)
      return {
        category,
        current,
        average,
        diff: round2(current - average),
        pct: average > 0 ? (current - average) / average : null,
      }
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

// ---------------------------------------------------------------------------
// Ritmo do mês
// ---------------------------------------------------------------------------

export interface SpendingPace {
  spent: number
  /** Fração do mês já decorrida (0–1). */
  elapsed: number
  /** Média por dia corrido até agora. */
  perDay: number
  /** Onde o mês fecha mantendo o ritmo. `null` se é cedo demais para projetar. */
  projected: number | null
  /** Média dos meses fechados, para comparar com a projeção. */
  average: number
}

/**
 * Ritmo de gasto do mês corrente. A projeção só aparece depois de 20% do mês:
 * antes disso um único gasto grande projetaria um mês catastrófico e o número
 * assustaria à toa.
 */
export function spendingPace(
  transactions: Transaction[],
  period: Date,
  previous: Date[],
  elapsed: number,
  regime: Regime = 'cash',
): SpendingPace {
  let spent = 0
  const prev = new Map<string, number>()
  for (const t of transactions) {
    if (!isLivingExpense(t)) continue
    if (inMonth(t, period, regime)) {
      spent += t.amount
      continue
    }
    const m = previous.find((mm) => inMonth(t, mm, regime))
    if (m) prev.set(monthKey(m), (prev.get(monthKey(m)) ?? 0) + t.amount)
  }
  const meses = [...prev.values()]
  const daysInMonth = new Date(period.getFullYear(), period.getMonth() + 1, 0).getDate()
  const e = Math.min(1, Math.max(0, elapsed))
  return {
    spent: round2(spent),
    elapsed: e,
    perDay: e > 0 ? round2(spent / Math.max(1, e * daysInMonth)) : 0,
    projected: e >= 0.2 && e < 0.98 ? round2(spent / e) : null,
    average: meses.length > 0 ? round2(meses.reduce((s, v) => s + v, 0) / meses.length) : 0,
  }
}

// ---------------------------------------------------------------------------
// Fixo × variável
// ---------------------------------------------------------------------------

export interface FixedVsVariable {
  fixed: number
  variable: number
  /** Fatia do custo de vida que é compromisso fixo (0–1). */
  fixedShare: number
}

/**
 * Separa o custo de vida entre compromisso fixo (recorrente detectado +
 * parcelamentos em curso) e gasto variável. Quanto maior a fatia fixa, menor
 * a margem de manobra num mês ruim — e é isso que a tela precisa dizer.
 */
export function fixedVsVariable(recurringMonthly: number, livingCostAvg: number): FixedVsVariable {
  const fixed = round2(Math.min(recurringMonthly, livingCostAvg))
  const variable = round2(Math.max(0, livingCostAvg - fixed))
  return { fixed, variable, fixedShare: livingCostAvg > 0 ? fixed / livingCostAvg : 0 }
}

/**
 * Quanto da DÍVIDA ATUAL do cartão é despesa da empresa.
 *
 * Só o que já está lançado até hoje e ainda não foi pago — ou seja, a fatura em
 * aberto. Somar as parcelas futuras aqui daria um número muitas vezes maior que
 * a própria fatura (foi o erro que o Rafael pegou: R$ 6.309 "da fatura" quando
 * a fatura era R$ 4.284, porque a conta ia até 2027).
 *
 * Pressupõe que as faturas já fechadas estão pagas — se houver fatura fechada
 * em aberto, esta conta subestima a parte da empresa.
 */
export function businessShareOfCardDebt(
  transactions: Transaction[],
  cardIds: Set<string>,
  openCycle: string,
  today: string,
): number {
  return round2(
    transactions
      .filter(
        (t) =>
          t.kind === 'expense' &&
          t.category === BUSINESS_CATEGORY &&
          t.account_id != null &&
          cardIds.has(t.account_id) &&
          t.card_cycle_month === openCycle &&
          (t.settled_date ?? t.competence_date) <= today,
      )
      .reduce((s, t) => s + t.amount, 0),
  )
}

/** Ids das contas de cartão de crédito de uma empresa. */
export function cardIdsOf(accounts: Account[], companyId: string | undefined): Set<string> {
  return new Set(
    accounts.filter((a) => a.company_id === companyId && a.type === 'credit_card').map((a) => a.id),
  )
}
