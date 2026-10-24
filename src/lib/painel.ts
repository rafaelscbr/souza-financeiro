import type { BudgetLine, SaleInstallment, Transaction } from '@/types'
import { competenciaNoDre, lancamentoDevido, montarDre } from './dre'
import { monthKey } from './finance'
import { situacaoDoTeto } from './orcamento'
import type { MoneyItem } from './sales'

/*
 * O PAINEL EXECUTIVO (Fase 3, 23/10/2026).
 *
 * As três perguntas de dono que o Início ainda não respondia: a imobiliária
 * deu lucro no mês? o caixa aguenta os próximos meses? quanto tempo ela anda
 * sem venda nova? Nada aqui inventa regra: o resultado é o DRE realizado
 * (só o devido, decisão C6), a previsão lê as mesmas listas de Receber e
 * Pagar, e o custo fixo que ainda não foi lançado vem do orçamento.
 */

const r2 = (v: number) => Math.round(v * 100) / 100

/** O lucro líquido do mês no DRE realizado: só a comissão já devida entra. */
export function resultadoDoMes(
  transactions: Transaction[],
  parcelas: Map<string, SaleInstallment>,
  mes: string,
): { lucro: number; receita: number; lancamentos: Transaction[] } {
  const lancamentos = transactions.filter(
    (t) => competenciaNoDre(t, parcelas).slice(0, 7) === mes && lancamentoDevido(t, parcelas),
  )
  const dre = montarDre(lancamentos)
  const de = (id: string) => dre.find((l) => l.id === id)?.valor ?? 0
  return { lucro: de('liquido'), receita: de('bruta'), lancamentos }
}

export interface MesDaPrevisao {
  /** `YYYY-MM`. */
  mes: string
  entra: number
  sai: number
  /** Custo do orçamento que ainda não virou lançamento (incluso em `sai`). */
  reservado: number
  saldoFim: number
  entradas: MoneyItem[]
  saidas: MoneyItem[]
}

/**
 * O saldo de hoje andando mês a mês. No primeiro mês entra também o que está
 * em atraso dos dois lados: a parcela que a construtora deve e a conta que a
 * imobiliária deve. Retirada do sócio fica fora — é decisão dele, não custo.
 */
export function previsaoDeCaixa(p: {
  saldo: number
  receber: MoneyItem[]
  pagar: MoneyItem[]
  orcamento: BudgetLine[]
  teto: number | null
  transactions: Transaction[]
  parcelas: Map<string, SaleInstallment>
  inicio: Date
  meses?: number
}): MesDaPrevisao[] {
  const n = p.meses ?? 6
  const pagar = p.pagar.filter((i) => i.kind !== 'socio')
  let saldo = p.saldo
  return Array.from({ length: n }, (_, k) => {
    const mes = monthKey(new Date(p.inicio.getFullYear(), p.inicio.getMonth() + k, 1))
    const doMes = (i: MoneyItem) => i.date.slice(0, 7) === mes || (k === 0 && i.overdue)
    const entradas = p.receber.filter(doMes)
    const saidas = pagar.filter(doMes)
    const reservado = p.orcamento.length
      ? situacaoDoTeto({ teto: p.teto ?? 0, linhas: p.orcamento, transactions: p.transactions, parcelas: p.parcelas, mes }).reservado
      : 0
    const entra = r2(entradas.reduce((s, i) => s + i.amount, 0))
    const sai = r2(saidas.reduce((s, i) => s + i.amount, 0) + reservado)
    saldo = r2(saldo + entra - sai)
    return { mes, entra, sai, reservado, saldoFim: saldo, entradas, saidas }
  })
}

/**
 * Fôlego: quantos meses de estrutura o caixa de hoje paga sem nenhuma venda
 * nova. A estrutura é o teto de gastos do mês; sem teto, não há como dizer.
 */
export function folegoDoCaixa(saldo: number, teto: number | null): number | null {
  if (!teto || teto <= 0) return null
  return Math.max(0, Math.floor((saldo / teto) * 10) / 10)
}
