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
  /** Outras despesas diretas da venda ligadas a esta parcela (taxas, marketing). */
  other: number
  /** Receita − imposto − comissão − outras desta parcela. */
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
  /** Outras despesas diretas da venda (taxas, marketing) amarradas ao negócio. */
  otherCost: number
  /** O que fica para a imobiliária: receita − imposto − comissão − outras. */
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
    // Imposto lançado como conta (categoria de imposto) — dedução, não despesa.
    const taxes = rows.filter((t) => dreGroupOf(t) === 'tax')
    // Demais despesas do grupo: custo direto da venda (taxa de tabela, marketing).
    const others = rows.filter((t) => {
      const g = dreGroupOf(t)
      return g !== 'revenue' && g !== 'cost_of_sale' && g !== 'withdrawal' && g !== 'tax'
    })

    const companyId = rows[0].company_id
    const taxRate = taxRateOf(companies, companyId)

    const grossRevenue = sum(revenues)
    const commissionCost = sum(commissions)
    const otherCost = sum(others)
    // Imposto lançado manda; a alíquota da empresa é fallback.
    const taxLaunched = sum(taxes)
    const tax = taxLaunched > 0 ? taxLaunched : taxRate != null ? round2(grossRevenue * taxRate / 100) : 0
    const taxConfigured = taxLaunched > 0 || taxRate != null
    const netToCompany = round2(grossRevenue - tax - commissionCost - otherCost)

    const received = sum(revenues.filter((t) => t.status === 'settled'))
    const toReceive = sum(revenues.filter((t) => t.status === 'pending'))
    const commissionPaid = sum(commissions.filter((t) => t.status === 'settled'))
    const commissionToPay = sum(commissions.filter((t) => t.status === 'pending'))
    const taxPaid = sum(taxes.filter((t) => t.status === 'settled'))
    const netReceived = round2(received - taxPaid - commissionPaid)

    // Duplicatas: uma linha por parcela que TEM receita. Comissão e outras
    // despesas do mesmo índice são anexadas; despesas órfãs (índice sem
    // receita) contam só no total da venda, nunca viram linha vazia.
    const revByIdx = new Map<number, Transaction[]>()
    const comByIdx = new Map<number, Transaction[]>()
    const taxByIdx = new Map<number, Transaction[]>()
    const othByIdx = new Map<number, Transaction[]>()
    const push = (m: Map<number, Transaction[]>, i: number, t: Transaction) => {
      const a = m.get(i)
      if (a) a.push(t)
      else m.set(i, [t])
    }
    for (const t of rows) {
      const idx = t.installment_index ?? 1
      const g = dreGroupOf(t)
      if (g === 'revenue') push(revByIdx, idx, t)
      else if (g === 'cost_of_sale') push(comByIdx, idx, t)
      else if (g === 'tax') push(taxByIdx, idx, t)
      else if (g !== 'withdrawal') push(othByIdx, idx, t)
    }

    let hasOverdue = false
    const indices = [...revByIdx.keys()].sort((a, b) => a - b)
    const installments: DealInstallment[] = indices.map((index) => {
      const revs = revByIdx.get(index) as Transaction[] // garantido por indices
      const coms = comByIdx.get(index) ?? []
      const txs2 = taxByIdx.get(index) ?? []
      const oths = othByIdx.get(index) ?? []
      const revenue = sum(revs)
      const commission = sum(coms)
      const other = sum(oths)
      const taxLaunchedIdx = sum(txs2)
      const instTax =
        taxLaunchedIdx > 0 ? taxLaunchedIdx : taxRate != null ? round2(revenue * taxRate / 100) : 0
      const first = revs[0]
      const date = first.settled_date ?? first.due_date ?? first.competence_date
      const revenueSettled = revs.every((t) => t.status === 'settled')
      const commissionSettled = coms.length > 0 && coms.every((t) => t.status === 'settled')
      if (revs.some((t) => t.status === 'pending') && date < today) hasOverdue = true
      return {
        index,
        count: indices.length,
        date,
        revenue,
        tax: instTax,
        commission,
        other,
        net: round2(revenue - instTax - commission - other),
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
      otherCost,
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
