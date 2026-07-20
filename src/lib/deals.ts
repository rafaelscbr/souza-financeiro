import { dreGroupOf, taxRateOf } from './finance'
import type { Company, Transaction } from '@/types'

/**
 * Uma "venda" (operação) é o conjunto de lançamentos que nasceram do mesmo
 * negócio: a comissão e suas parcelas + os repasses ao corretor. O que amarra
 * tudo é o `group_id`; uma receita avulsa (sem grupo) é uma venda de 1 parcela.
 *
 * Esta é a visão que o formulário de lançamento não dá: em vez de olhar mês a
 * mês, olha o negócio inteiro — quanto entra, quanto sai de imposto e comissão,
 * e o que de fato fica para a imobiliária.
 */

/** Uma duplicata: a parcela da venda, com receita, imposto e repasse próprios. */
export interface DealInstallment {
  index: number
  count: number
  /** Data que representa a parcela (recebimento previsto ou realizado). */
  date: string
  revenue: number
  /** Imposto proporcional a esta parcela. */
  tax: number
  commission: number
  /** Receita − imposto − comissão desta parcela. */
  net: number
  revenueSettled: boolean
  commissionSettled: boolean
}

export interface Deal {
  /** group_id, ou id da transação quando avulsa. */
  key: string
  title: string
  companyId: string
  client: string | null
  brokerId: string | null
  saleDate: string

  // Resultado da operação inteira
  grossRevenue: number
  taxRate: number | null
  taxConfigured: boolean
  tax: number
  commissionCost: number
  /** O que fica para a imobiliária: receita − imposto − comissão. */
  netToCompany: number
  netMargin: number

  // Fluxo (caixa realizado × pendente)
  received: number
  toReceive: number
  commissionPaid: number
  commissionToPay: number
  /** Já embolsado limpo até aqui (recebido − imposto pago − comissão paga). */
  netReceived: number

  installments: DealInstallment[]
  hasOverdue: boolean
}

/** Remove o sufixo "— Pc 3/9" do título, deixando o nome do negócio. */
function cleanTitle(desc: string, fallback: string): string {
  const cleaned = desc.replace(/\s*[—–-]\s*Pc\.?\s*\d+\s*\/\s*\d+\s*$/i, '').trim()
  return cleaned || fallback
}

function sum(txs: Transaction[]): number {
  return round2(txs.reduce((s, t) => s + t.amount, 0))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Deriva as vendas a partir dos lançamentos. Só entram grupos que têm receita —
 * uma despesa parcelada avulsa não é uma venda.
 */
export function deriveDeals(
  txs: Transaction[],
  companies: Company[],
  today: string,
): Deal[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    const key = t.group_id ?? t.id
    const arr = groups.get(key)
    if (arr) arr.push(t)
    else groups.set(key, [t])
  }

  const deals: Deal[] = []

  for (const [key, rows] of groups) {
    const revenues = rows.filter((t) => dreGroupOf(t) === 'revenue')
    if (revenues.length === 0) continue

    const commissions = rows.filter((t) => dreGroupOf(t) === 'cost_of_sale')
    const companyId = rows[0].company_id
    const taxRate = taxRateOf(companies, companyId)
    const taxConfigured = taxRate != null

    const grossRevenue = sum(revenues)
    const commissionCost = sum(commissions)
    const tax = taxConfigured ? round2(grossRevenue * (taxRate as number) / 100) : 0
    const netToCompany = round2(grossRevenue - tax - commissionCost)

    const received = sum(revenues.filter((t) => t.status === 'settled'))
    const toReceive = sum(revenues.filter((t) => t.status === 'pending'))
    const commissionPaid = sum(commissions.filter((t) => t.status === 'settled'))
    const commissionToPay = sum(commissions.filter((t) => t.status === 'pending'))
    const taxPaid = taxConfigured ? round2(received * (taxRate as number) / 100) : 0
    const netReceived = round2(received - taxPaid - commissionPaid)

    // Duplicatas: agrupa por índice de parcela.
    const byIndex = new Map<number, { rev: Transaction[]; com: Transaction[] }>()
    for (const t of rows) {
      const idx = t.installment_index ?? 1
      const bucket = byIndex.get(idx) ?? { rev: [], com: [] }
      if (dreGroupOf(t) === 'revenue') bucket.rev.push(t)
      else if (dreGroupOf(t) === 'cost_of_sale') bucket.com.push(t)
      byIndex.set(idx, bucket)
    }

    let hasOverdue = false
    const installments: DealInstallment[] = [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, b]) => {
        const revenue = sum(b.rev)
        const commission = sum(b.com)
        const instTax = taxConfigured ? round2(revenue * (taxRate as number) / 100) : 0
        const first = b.rev[0] ?? b.com[0]
        const date = first.settled_date ?? first.due_date ?? first.competence_date
        const revenueSettled = b.rev.every((t) => t.status === 'settled') && b.rev.length > 0
        const commissionSettled = b.com.every((t) => t.status === 'settled') && b.com.length > 0
        const pendingRev = b.rev.some((t) => t.status === 'pending')
        if (pendingRev && date < today) hasOverdue = true
        return {
          index,
          count: byIndex.size,
          date,
          revenue,
          tax: instTax,
          commission,
          net: round2(revenue - instTax - commission),
          revenueSettled,
          commissionSettled,
        }
      })

    deals.push({
      key,
      title: cleanTitle(revenues[0].description, revenues[0].category),
      companyId,
      client: revenues.find((r) => r.counterparty)?.counterparty ?? null,
      brokerId: commissions.find((c) => c.contact_id)?.contact_id ?? null,
      saleDate: revenues[0].competence_date,
      grossRevenue,
      taxRate,
      taxConfigured,
      tax,
      commissionCost,
      netToCompany,
      netMargin: grossRevenue > 0 ? netToCompany / grossRevenue : 0,
      received,
      toReceive,
      commissionPaid,
      commissionToPay,
      netReceived,
      installments,
      hasOverdue,
    })
  }

  // Mais recentes primeiro.
  return deals.sort((a, b) => (a.saleDate < b.saleDate ? 1 : a.saleDate > b.saleDate ? -1 : 0))
}
