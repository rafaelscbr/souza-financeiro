import { dreGroupOf } from './finance'
import { toDateOnly } from './format'
import type { Account, Transaction, Transfer } from '@/types'

/**
 * Saldo de uma conta numa data.
 *
 * A conta começa no `opening_balance` e só é movida por dinheiro que
 * REALMENTE se moveu (`status = 'settled'`). Pendente é compromisso, não
 * saldo — misturar os dois é o erro que faz o app mostrar dinheiro que
 * ainda não existe.
 */
export interface AccountBalance {
  account: Account
  opening: number
  /** Entradas liquidadas. */
  inflow: number
  /** Saídas liquidadas. */
  outflow: number
  /** Transferências recebidas − enviadas. */
  transfersNet: number
  balance: number
  /** Nº de lançamentos que compõem o saldo. */
  movements: number
}

export function accountBalance(
  account: Account,
  transactions: Transaction[],
  transfers: Transfer[],
  upto: string = toDateOnly(new Date()),
): AccountBalance {
  let inflow = 0
  let outflow = 0
  let movements = 0

  for (const t of transactions) {
    if (t.account_id !== account.id) continue
    if (t.status !== 'settled') continue
    const d = t.settled_date ?? t.competence_date
    if (d < account.opening_date || d > upto) continue

    movements += 1
    if (dreGroupOf(t) === 'revenue') inflow += t.amount
    else outflow += t.amount
  }

  let transfersNet = 0
  for (const tr of transfers) {
    if (tr.date < account.opening_date || tr.date > upto) continue
    if (tr.to_account_id === account.id) {
      transfersNet += tr.amount
      movements += 1
    }
    if (tr.from_account_id === account.id) {
      transfersNet -= tr.amount
      movements += 1
    }
  }

  return {
    account,
    opening: account.opening_balance,
    inflow,
    outflow,
    transfersNet,
    balance: round2(account.opening_balance + inflow - outflow + transfersNet),
    movements,
  }
}

export interface TreasurySummary {
  balances: AccountBalance[]
  /** Soma das contas cadastradas. */
  total: number
  /**
   * Movimento liquidado que ainda não foi atribuído a nenhuma conta.
   * Aparece separado porque somá-lo ao total daria um saldo que não
   * corresponde a banco nenhum — e escondê-lo daria um total incompleto.
   */
  unassigned: number
  unassignedCount: number
}

export function treasurySummary(
  accounts: Account[],
  transactions: Transaction[],
  transfers: Transfer[],
  upto: string = toDateOnly(new Date()),
): TreasurySummary {
  const balances = accounts
    .filter((a) => a.is_active)
    .map((a) => accountBalance(a, transactions, transfers, upto))

  let unassigned = 0
  let unassignedCount = 0
  for (const t of transactions) {
    if (t.account_id !== null) continue
    if (t.status !== 'settled') continue
    const d = t.settled_date ?? t.competence_date
    if (d > upto) continue
    unassignedCount += 1
    unassigned += dreGroupOf(t) === 'revenue' ? t.amount : -t.amount
  }

  return {
    balances,
    total: round2(balances.reduce((s, b) => s + b.balance, 0)),
    unassigned: round2(unassigned),
    unassignedCount,
  }
}

/** Uma linha do extrato: lançamento ou transferência, com saldo acumulado. */
export interface StatementEntry {
  id: string
  date: string
  description: string
  category: string
  amount: number
  direction: 'in' | 'out'
  running: number
  kind: 'transaction' | 'transfer'
}

/**
 * Extrato de uma conta, do mais antigo ao mais recente, com saldo corrido.
 * É a visão que permite conferir contra o extrato do banco, linha a linha.
 */
export function accountStatement(
  account: Account,
  transactions: Transaction[],
  transfers: Transfer[],
  accounts: Account[],
  upto: string = toDateOnly(new Date()),
): StatementEntry[] {
  type Raw = Omit<StatementEntry, 'running'>
  const raw: Raw[] = []

  for (const t of transactions) {
    if (t.account_id !== account.id || t.status !== 'settled') continue
    const d = t.settled_date ?? t.competence_date
    if (d < account.opening_date || d > upto) continue
    const isIn = dreGroupOf(t) === 'revenue'
    raw.push({
      id: t.id,
      date: d,
      description: t.description || t.category,
      category: t.category,
      amount: t.amount,
      direction: isIn ? 'in' : 'out',
      kind: 'transaction',
    })
  }

  for (const tr of transfers) {
    if (tr.date < account.opening_date || tr.date > upto) continue
    const isIn = tr.to_account_id === account.id
    const isOut = tr.from_account_id === account.id
    if (!isIn && !isOut) continue
    const other = accounts.find(
      (a) => a.id === (isIn ? tr.from_account_id : tr.to_account_id),
    )
    raw.push({
      id: tr.id,
      date: tr.date,
      description:
        tr.description || (isIn ? `Recebido de ${other?.name ?? 'outra conta'}` : `Enviado para ${other?.name ?? 'outra conta'}`),
      category: 'Transferência',
      amount: tr.amount,
      direction: isIn ? 'in' : 'out',
      kind: 'transfer',
    })
  }

  raw.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))

  let running = account.opening_balance
  return raw.map((r) => {
    running = round2(running + (r.direction === 'in' ? r.amount : -r.amount))
    return { ...r, running }
  })
}

export const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  investment: 'Investimento',
  credit_card: 'Cartão de crédito',
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
