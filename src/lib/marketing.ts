import type { Transaction } from '@/types'
import { vendaConta, vgvDaVenda } from './comissao'
import { noPeriodo, type PeriodoDre } from './dre'
import { ORIGENS, ehCategoriaDeMarketing, type Origem } from './origens'
import type { SaleView } from './sales'

/*
 * MARKETING E RETORNO (Fase 8, 23/10/2026).
 *
 * O que cada canal custou no período contra o que ele trouxe. O custo é a
 * despesa de marketing pela competência, com o canal gravado nela (044). O
 * que ele trouxe são as vendas do período com a mesma origem — o contrato
 * assinado, com a comissão contratada e o que fica para a imobiliária depois
 * de impostos, corretor e gestão (cascadeOf).
 *
 * Retorno = o que fica para a imobiliária ÷ o investido. É retorno sobre
 * comissão contratada, não sobre caixa: a comissão entra ao longo dos meses
 * (prazo médio de ~8 meses na carteira de hoje).
 */

const r2 = (v: number) => Math.round(v * 100) / 100

export type CanalId = Origem | 'sem'

export interface CanalDoMarketing {
  id: CanalId
  nome: string
  investido: number
  despesas: Transaction[]
  vendas: SaleView[]
  vgv: number
  comissao: number
  fica: number
  /** Investido ÷ número de vendas. Nulo sem venda ou sem investimento. */
  custoPorVenda: number | null
  /** Fica ÷ investido: quantos reais ficam para cada real investido. */
  retorno: number | null
}

export function ehDespesaDeMarketing(t: Transaction): boolean {
  return t.kind !== 'income' && t.kind !== 'withdrawal' && ehCategoriaDeMarketing(t.category)
}

export function marketingPorCanal(p: { vendas: SaleView[]; transactions: Transaction[]; periodo: PeriodoDre }) {
  const despesas = p.transactions.filter(
    (t) => ehDespesaDeMarketing(t) && noPeriodo(t.competence_date.slice(0, 7), p.periodo),
  )
  const vendas = p.vendas.filter((v) => vendaConta(v) && noPeriodo(v.sale_date.slice(0, 7), p.periodo))

  const montar = (id: CanalId, nome: string): CanalDoMarketing => {
    const d = despesas.filter((t) => (t.marketing_channel ?? 'sem') === id)
    const v = vendas.filter((s) => (s.origin ?? 'sem') === id)
    const investido = r2(d.reduce((s, t) => s + t.amount, 0))
    const fica = r2(v.reduce((s, x) => s + x.cascade.net, 0))
    return {
      id,
      nome,
      investido,
      despesas: d,
      vendas: v,
      vgv: r2(v.reduce((s, x) => s + vgvDaVenda(x), 0)),
      comissao: r2(v.reduce((s, x) => s + x.cascade.commission, 0)),
      fica,
      // Sem canal não tem retorno: misturaria gasto e venda que não se conhecem.
      custoPorVenda: id !== 'sem' && investido > 0 && v.length > 0 ? r2(investido / v.length) : null,
      retorno: id !== 'sem' && investido > 0 ? r2(fica / investido) : null,
    }
  }

  const canais = [...ORIGENS.map((o) => montar(o.id, o.rotulo)), montar('sem', 'Sem canal ou sem origem')].filter(
    (c) => c.id !== 'sem' || c.investido > 0 || c.vendas.length > 0,
  )
  const investido = r2(canais.reduce((s, c) => s + c.investido, 0))
  const fica = r2(canais.reduce((s, c) => s + c.fica, 0))
  // O retorno geral só conta canal com investimento e venda classificada.
  const medidos = canais.filter((c) => c.retorno != null)
  const investidoMedido = medidos.reduce((s, c) => s + c.investido, 0)
  return {
    canais,
    despesas,
    vendas,
    total: {
      investido,
      vendas: vendas.length,
      vgv: r2(canais.reduce((s, c) => s + c.vgv, 0)),
      fica,
      retorno: investidoMedido > 0 ? r2(medidos.reduce((s, c) => s + c.fica, 0) / investidoMedido) : null,
      semCanal: r2(canais.find((c) => c.id === 'sem')?.investido ?? 0),
    },
  }
}
