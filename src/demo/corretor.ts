import { brokerStatusOf } from '@/lib/sales'
import type { CorretorPainel, CorretorParcela, CorretorVenda } from '@/corretor/CorretorData'
import type { TransactionStatus } from '@/types'
import { CORRETORA_ID, costCenters, installments, sales, transactions } from './fixtures'

/**
 * O que as funções broker_sales, broker_installments e broker_home (migração
 * 010) devolveriam para a "Corretor Exemplo", lidas das mesmas linhas de
 * exemplo do administrador.
 *
 * O app do corretor não tem função pura em src/lib: a conta mora no SQL. Esta
 * é a tradução direta daquelas três consultas, só para a vitrine, e a
 * situação de cada parcela vem de brokerStatusOf (a mesma regra de
 * broker_status do banco).
 */

const r2 = (n: number) => Math.round(n * 100) / 100
const soma = (l: number[]) => r2(l.reduce((s, v) => s + v, 0))

const statusPorTx = new Map<string, TransactionStatus>(transactions.map((t) => [t.id, t.status]))
const txPorId = new Map(transactions.map((t) => [t.id, t]))
const nomeCc = new Map(costCenters.map((c) => [c.id, c.name]))

const minhas = sales.filter((s) => s.broker_id === CORRETORA_ID && s.status !== 'cancelada')

export const parcelasCorretor: CorretorParcela[] = installments
  .filter((i) => i.status !== 'cancelada' && minhas.some((s) => s.id === i.sale_id))
  .map((i) => {
    const s = minhas.find((v) => v.id === i.sale_id)!
    const tx = i.broker_tx_id ? txPorId.get(i.broker_tx_id) : undefined
    return {
      id: i.id,
      sale_id: s.id,
      sale_title: s.title,
      development: s.cost_center_id ? nomeCc.get(s.cost_center_id) ?? null : null,
      idx: i.idx,
      count: i.count,
      expected_date: i.expected_date,
      received_date: i.received_date,
      installment_amount: i.amount,
      iss_amount: i.iss_amount,
      simples_amount: i.simples_amount,
      broker_pct: s.broker_pct,
      broker_amount: i.broker_amount,
      broker_adjustment: i.broker_adjustment,
      status: brokerStatusOf(i, statusPorTx),
      paid_date: tx && tx.status === 'settled' ? tx.settled_date : null,
      notes: i.notes,
      is_personal: Boolean(s.is_personal),
    }
  })
  .sort((a, b) => (a.expected_date < b.expected_date ? -1 : 1))

export const vendasCorretor: CorretorVenda[] = minhas
  .map((s) => {
    const ps = parcelasCorretor.filter((p) => p.sale_id === s.id)
    const liquido = (p: CorretorParcela) => p.broker_amount - p.broker_adjustment
    const abertas = ps.filter((p) => p.status !== 'recebida').map((p) => p.expected_date).sort()
    return {
      id: s.id,
      title: s.title,
      unit: s.unit,
      client_name: s.client_name,
      development: s.cost_center_id ? nomeCc.get(s.cost_center_id) ?? null : null,
      sale_date: s.sale_date,
      property_value: s.property_value,
      broker_pct: s.broker_pct,
      status: s.status,
      commission_total: soma(ps.map(liquido)),
      commission_received: soma(ps.filter((p) => p.status === 'recebida').map(liquido)),
      commission_released: soma(ps.filter((p) => p.status === 'liberada').map((p) => p.broker_amount)),
      commission_expected: soma(ps.filter((p) => p.status === 'prevista').map((p) => p.broker_amount)),
      installments: ps.length,
      next_date: abertas[0] ?? null,
      is_personal: Boolean(s.is_personal),
    }
  })
  .sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1))

export function painelCorretor(ano: number, hoje: string): CorretorPainel {
  const vendas = vendasCorretor.filter((v) => Number(v.sale_date.slice(0, 4)) === ano)
  const doAno = parcelasCorretor.filter((p) => Number(p.expected_date.slice(0, 4)) === ano)
  const liquido = (p: CorretorParcela) => p.broker_amount - p.broker_adjustment
  const atrasadas = parcelasCorretor.filter((p) => p.status === 'liberada' && p.expected_date < hoje)
  const proxima = parcelasCorretor.find((p) => p.status !== 'recebida' && p.expected_date >= hoje) ?? null
  const meses = new Map<string, { amount: number; received: number }>()
  for (const p of doAno) {
    const m = p.expected_date.slice(0, 7)
    const atual = meses.get(m) ?? { amount: 0, received: 0 }
    atual.amount = r2(atual.amount + liquido(p))
    if (p.status === 'recebida') atual.received = r2(atual.received + liquido(p))
    meses.set(m, atual)
  }
  return {
    year: ano,
    sales_count: vendas.length,
    vgv: soma(vendas.map((v) => v.property_value ?? 0)),
    sales_without_vgv: vendas.filter((v) => v.property_value == null).length,
    commission_total: soma(doAno.map(liquido)),
    commission_received: soma(doAno.filter((p) => p.status === 'recebida').map(liquido)),
    commission_released: soma(doAno.filter((p) => p.status === 'liberada').map((p) => p.broker_amount)),
    commission_expected: soma(doAno.filter((p) => p.status === 'prevista').map((p) => p.broker_amount)),
    personal_total: soma(doAno.filter((p) => p.is_personal).map(liquido)),
    personal_count: vendas.filter((v) => v.is_personal).length,
    overdue_amount: soma(atrasadas.map((p) => p.broker_amount)),
    overdue_count: atrasadas.length,
    next: proxima
      ? { sale_title: proxima.sale_title, idx: proxima.idx, count: proxima.count, amount: proxima.broker_amount, date: proxima.expected_date, status: proxima.status }
      : null,
    by_month: [...meses.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, v]) => ({ month, ...v })),
  }
}
