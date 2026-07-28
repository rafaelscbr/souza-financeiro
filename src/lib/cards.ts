import { addMonthsClamped, splitAmount } from './installments'
import { toDateOnly } from './format'
import type { Account, Transaction, TransactionInput, Transfer } from '@/types'

/**
 * Cartão de crédito — o modelo em três regras:
 *
 * 1. A COMPRA é a despesa (categorizada, na fatura do seu ciclo). A transação
 *    guarda a data real da compra em `settled_date`/`competence_date` (extrato
 *    do cartão bate com o app do banco, linha a linha) e o carimbo
 *    `card_cycle_month` diz em qual FATURA — e portanto em qual mês — ela pesa.
 * 2. PAGAR A FATURA é transferência conta → cartão. Nunca despesa: a despesa
 *    já foi reconhecida em cada compra; contar de novo seria dupla contagem.
 * 3. O cartão é DÍVIDA, não dinheiro: seu saldo negativo fica fora do
 *    "disponível" na tesouraria.
 *
 * A fatura não é tabela: é a agregação das compras carimbadas num ciclo.
 * Como o carimbo é gravado no lançamento, mudar o dia de fechamento do
 * cartão depois só afeta compras futuras — o histórico não reescreve.
 */

/** Conta configurada como cartão com ciclo completo. */
export function isCardAccount(a: Account): boolean {
  return a.type === 'credit_card' && a.card_closing_day != null
}

function lastDayOfMonth(y: number, m1to12: number): number {
  return new Date(y, m1to12, 0).getDate()
}

/** 'YYYY-MM-01' do mês da data. */
function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

/**
 * Ciclo (mês da fatura, 'YYYY-MM-01') de uma compra feita em `purchaseDate`
 * num cartão que fecha em `closingDay`. Compra até o dia do fechamento
 * (inclusive) entra na fatura do mês; depois dele, na fatura seguinte.
 * Em meses curtos o fechamento é ajustado para o último dia.
 */
export function invoiceCycleOf(purchaseDate: string, closingDay: number): string {
  const [y, m, d] = purchaseDate.split('-').map(Number)
  const effectiveClosing = Math.min(closingDay, lastDayOfMonth(y, m))
  if (d <= effectiveClosing) return monthStart(purchaseDate)
  return addMonthsClamped(monthStart(purchaseDate), 1)
}

/** Data de fechamento de um ciclo ('YYYY-MM-01' → data-only do fechamento). */
export function cycleClosingDate(cycleMonth: string, closingDay: number): string {
  const [y, m] = cycleMonth.split('-').map(Number)
  const day = Math.min(closingDay, lastDayOfMonth(y, m))
  return `${cycleMonth.slice(0, 7)}-${String(day).padStart(2, '0')}`
}

/**
 * Vencimento da fatura de um ciclo: a PRIMEIRA ocorrência de `dueDay`
 * estritamente após o fechamento. Cartão que fecha dia 1 e vence dia 10
 * vence no MESMO mês; cartão que fecha dia 28 e vence dia 5 vence no seguinte.
 */
export function invoiceDueDate(cycleMonth: string, closingDay: number, dueDay: number): string {
  const closing = cycleClosingDate(cycleMonth, closingDay)
  const [y, m] = cycleMonth.split('-').map(Number)
  const sameMonthDue = `${cycleMonth.slice(0, 7)}-${String(Math.min(dueDay, lastDayOfMonth(y, m))).padStart(2, '0')}`
  if (sameMonthDue > closing) return sameMonthDue
  const next = addMonthsClamped(cycleMonth, 1)
  const [ny, nm] = next.split('-').map(Number)
  return `${next.slice(0, 7)}-${String(Math.min(dueDay, lastDayOfMonth(ny, nm))).padStart(2, '0')}`
}

/**
 * Gera os lançamentos de uma compra no cartão (1x ou parcelada).
 *
 * Cada parcela k: valor exato (última absorve arredondamento), data postada =
 * data da compra + (k−1) meses, e carimbo do ciclo correspondente. Todas
 * nascem `settled` — no cartão a compra está consumada; o que falta é pagar a
 * fatura, e isso é transferência, não baixa.
 */
export function buildCardPurchase(params: {
  base: Omit<TransactionInput, 'status' | 'settled_date' | 'due_date' | 'amount' | 'group_id' | 'installment_index' | 'installment_count' | 'card_cycle_month'>
  total: number
  installments: number
  purchaseDate: string
  account: Account
}): TransactionInput[] {
  const { base, total, installments, purchaseDate, account } = params
  // Cartão sem dia de fechamento configurado: a fatura vira o próprio mês da
  // compra (fechamento no último dia).
  const closingDay = account.card_closing_day ?? 31
  const firstCycle = invoiceCycleOf(purchaseDate, closingDay)
  const amounts = splitAmount(total, Math.max(1, installments))
  const groupId = amounts.length > 1 ? crypto.randomUUID() : null

  return amounts.map((amount, i) => {
    const postedDate = addMonthsClamped(purchaseDate, i)
    return {
      ...base,
      amount,
      competence_date: postedDate,
      status: 'settled' as const,
      settled_date: postedDate,
      due_date: null,
      group_id: groupId,
      installment_index: amounts.length > 1 ? i + 1 : null,
      installment_count: amounts.length > 1 ? amounts.length : null,
      account_id: account.id,
      card_cycle_month: addMonthsClamped(firstCycle, i),
    }
  })
}

// ---------------------------------------------------------------------------
// Faturas derivadas
// ---------------------------------------------------------------------------

export type InvoiceState = 'open' | 'closed' | 'future'

export interface CardInvoice {
  cycleMonth: string
  closingDate: string
  dueDate: string
  /** Compras − créditos/estornos do ciclo. */
  total: number
  items: Transaction[]
  state: InvoiceState
}

export interface CardSummary {
  account: Account
  /** Faturas com movimento (+ a aberta, mesmo vazia), da mais antiga à mais nova. */
  invoices: CardInvoice[]
  /** Fatura do ciclo corrente (aberta). */
  open: CardInvoice
  /**
   * O que já fechou e ainda não foi pago: soma dos ciclos fechados menos as
   * transferências recebidas pelo cartão. É O número "fatura a pagar".
   */
  closedUnpaid: number
  /** Vencimento do ciclo fechado mais ANTIGO ainda não coberto por pagamento. */
  closedDueDate: string | null
  /** Crédito a favor: pagou além do que já fechou (abate faturas seguintes). */
  prepaid: number
  /** Fatura fechada, vencida e não coberta por pagamento. */
  overdue: boolean
  /**
   * Limite comprometido: TODAS as compras (inclusive parcelas futuras) menos
   * créditos e pagamentos. Diferente do saldo devedor de hoje — parcelas
   * futuras já consomem limite.
   */
  limitUsed: number
  /** card_limit − limitUsed (null se o limite não foi informado). */
  limitAvailable: number | null
}

/** Ciclo efetivo de uma transação do cartão (carimbo; deriva se faltar). */
export function cycleOfTx(t: Transaction, closingDay: number): string {
  if (t.card_cycle_month) return monthStart(t.card_cycle_month)
  return invoiceCycleOf(t.settled_date ?? t.competence_date, closingDay)
}

function isCredit(t: Transaction): boolean {
  return t.kind === 'income'
}

/**
 * Resumo completo de um cartão: faturas por ciclo, saldo devedor fechado,
 * limite comprometido e alerta de atraso. Deriva tudo de transactions +
 * transfers — não existe entidade fatura no banco.
 */
export function cardSummary(
  account: Account,
  transactions: Transaction[],
  transfers: Transfer[],
  today: string = toDateOnly(new Date()),
): CardSummary {
  const closingDay = account.card_closing_day ?? 31
  const dueDay = account.card_due_day ?? closingDay

  const byCycle = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.account_id !== account.id) continue
    // Mesma âncora de `accountBalance`: o que é anterior à data do saldo
    // inicial já está embutido nele. Sem esta guarda, uma dívida cadastrada
    // como saldo de abertura seria contada duas vezes.
    if ((t.settled_date ?? t.competence_date) < account.opening_date) continue
    const cycle = cycleOfTx(t, closingDay)
    const arr = byCycle.get(cycle)
    if (arr) arr.push(t)
    else byCycle.set(cycle, [t])
  }

  const currentCycle = invoiceCycleOf(today, closingDay)
  if (!byCycle.has(currentCycle)) byCycle.set(currentCycle, [])

  const invoices: CardInvoice[] = [...byCycle.entries()]
    .map(([cycleMonth, items]) => {
      const total = round2(
        items.reduce((s, t) => s + (isCredit(t) ? -t.amount : t.amount), 0),
      )
      const state: InvoiceState =
        cycleMonth < currentCycle ? 'closed' : cycleMonth === currentCycle ? 'open' : 'future'
      return {
        cycleMonth,
        closingDate: cycleClosingDate(cycleMonth, closingDay),
        dueDate: invoiceDueDate(cycleMonth, closingDay, dueDay),
        total,
        items: items.sort((a, b) =>
          (a.settled_date ?? a.competence_date) < (b.settled_date ?? b.competence_date) ? -1 : 1,
        ),
        state,
      }
    })
    .sort((a, b) => (a.cycleMonth < b.cycleMonth ? -1 : 1))

  const open = invoices.find((i) => i.state === 'open')!

  // Pagamentos = transferências líquidas recebidas pelo cartão.
  let paymentsNet = 0
  for (const tr of transfers) {
    if (tr.to_account_id === account.id) paymentsNet += tr.amount
    if (tr.from_account_id === account.id) paymentsNet -= tr.amount
  }

  const closedInvoices = invoices.filter((i) => i.state === 'closed')
  const closedTotal = closedInvoices.reduce((s, i) => s + i.total, 0)
  // Saldo inicial negativo de um cartão cadastrado com fatura em aberto
  // também é dívida já fechada.
  const openingDebt = account.opening_balance < 0 ? -account.opening_balance : 0
  const closedUnpaid = Math.max(0, round2(closedTotal + openingDebt - paymentsNet))

  // O pagamento é um agregado, então a cobertura é FIFO: quita primeiro a
  // dívida de abertura, depois os ciclos fechados do mais ANTIGO ao mais novo.
  // O vencimento que importa é o do primeiro ciclo ainda descoberto — usar o
  // ciclo mais recente esconderia um atraso antigo atrás de uma data futura.
  let remaining = paymentsNet - openingDebt
  let closedDueDate: string | null = null
  for (const inv of closedInvoices) {
    if (remaining >= inv.total - 0.005) {
      remaining -= inv.total
      continue
    }
    closedDueDate = inv.dueDate
    break
  }
  if (closedUnpaid > 0.005 && closedDueDate === null) {
    // Resíduo da dívida de abertura sem nenhum ciclo fechado descoberto: por
    // definição já venceu, então ancora no vencimento do ciclo anterior.
    closedDueDate =
      closedInvoices[closedInvoices.length - 1]?.dueDate ??
      invoiceDueDate(addMonthsClamped(currentCycle, -1), closingDay, dueDay)
  }
  const overdue = closedUnpaid > 0.005 && closedDueDate != null && closedDueDate < today

  // Sobra de pagamento (pagou adiantado): crédito a favor que abate as faturas
  // aberta/futuras. Sem isto o Math.max(0, …) engolia o valor e o "a pagar"
  // continuava mostrando a fatura cheia.
  const prepaid = closedUnpaid > 0.005 ? 0 : round2(Math.max(0, remaining))

  const allTotal = invoices.reduce((s, i) => s + i.total, 0)
  const limitUsed = Math.max(0, round2(allTotal + openingDebt - paymentsNet))
  const limitAvailable =
    account.card_limit != null ? round2(account.card_limit - limitUsed) : null

  return {
    account,
    invoices,
    open,
    closedUnpaid,
    closedDueDate,
    prepaid,
    overdue,
    limitUsed,
    limitAvailable,
  }
}

/**
 * Compromissos futuros dos cartões para o "a pagar" e a previsão de caixa:
 * fatura fechada não paga (no vencimento dela) + faturas aberta/futuras com
 * saldo (no vencimento de cada uma). Sem isto, o parcelamento fica invisível
 * ao "vou ter dinheiro em setembro?".
 */
export interface CardPayable {
  account: Account
  cycleMonth: string
  dueDate: string
  amount: number
  state: InvoiceState | 'overdue'
}

export function cardPayables(summaries: CardSummary[]): CardPayable[] {
  const out: CardPayable[] = []
  for (const s of summaries) {
    if (s.closedUnpaid > 0.005 && s.closedDueDate) {
      out.push({
        account: s.account,
        cycleMonth: 'closed',
        dueDate: s.closedDueDate,
        amount: s.closedUnpaid,
        state: s.overdue ? 'overdue' : 'closed',
      })
    }
    // Crédito por pagamento adiantado abate as próximas faturas, na ordem.
    let credit = s.prepaid
    for (const inv of s.invoices) {
      if (inv.state === 'closed') continue
      if (inv.total <= 0.005) continue
      const devido = round2(inv.total - Math.min(credit, inv.total))
      credit = round2(Math.max(0, credit - inv.total))
      if (devido <= 0.005) continue
      out.push({
        account: s.account,
        cycleMonth: inv.cycleMonth,
        dueDate: inv.dueDate,
        amount: devido,
        state: inv.state,
      })
    }
  }
  return out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
