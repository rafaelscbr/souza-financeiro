import type { BudgetLine, Sale, SaleInstallment, Transaction } from '@/types'
import { competenciaNoDre, contaDoDre, montarDre, noPeriodo, type PeriodoDre } from './dre'

/*
 * O ORÇAMENTO DE CUSTOS (22/10/2026).
 *
 * O Rafael não quis partir do que ele quer retirar: quis partir dos custos que
 * ele enxerga pela frente. Então a conta é esta:
 *
 *   custo orçado do período
 *   × o que as vendas deixam para a imobiliária (lucro bruto do DRE)
 *   = sobra (ou falta) depois da estrutura
 *
 * e, quando falta, quantas vendas a mais cobririam a diferença.
 *
 * O realizado vem do DRE (competência, comissão contada quando fica devida),
 * para orçado e realizado falarem a mesma língua. O orçamento não entra no
 * DRE nem no caixa: é o plano contra o qual eles são medidos.
 */

export type Cenario = 'confirmado' | 'com-possiveis'

const r2 = (v: number) => Math.round(v * 100) / 100

/** Os meses `YYYY-MM` do período, em ordem. */
export function mesesDoPeriodo(p: PeriodoDre): string[] {
  const out: string[] = []
  let [a, m] = p.de.split('-').map(Number)
  const [af, mf] = p.ate.split('-').map(Number)
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      a += 1
    }
  }
  return out
}

/** A linha vale no mês `YYYY-MM`? */
export function vigente(l: BudgetLine, mes: string): boolean {
  return l.start_month.slice(0, 7) <= mes && (l.end_month === null || l.end_month.slice(0, 7) >= mes)
}

export function linhasDoCenario(linhas: BudgetLine[], cenario: Cenario): BudgetLine[] {
  return cenario === 'confirmado' ? linhas.filter((l) => l.status === 'confirmado') : linhas
}

/** Quanto a linha custa no período: valor do mês × meses em que ela vale. */
export function custoNoPeriodo(l: BudgetLine, p: PeriodoDre): number {
  return r2(mesesDoPeriodo(p).filter((m) => vigente(l, m)).length * l.amount)
}

/** Despesa de estrutura (comercial, administrativa, pessoal) no período, pela competência do DRE. */
export function gastosDoPeriodo(
  transactions: Transaction[],
  parcelas: Map<string, SaleInstallment>,
  p: PeriodoDre,
): Transaction[] {
  return transactions.filter(
    (t) =>
      ['comerciais', 'administrativas', 'pessoal'].includes(contaDoDre(t)) &&
      noPeriodo(competenciaNoDre(t, parcelas).slice(0, 7), p),
  )
}

export interface CategoriaDoOrcamento {
  categoria: string
  orcado: number
  gasto: number
  linhas: BudgetLine[]
  lancamentos: Transaction[]
}

export interface ApuracaoDoOrcamento {
  /** Custo orçado da estrutura no período, no cenário escolhido. */
  orcado: number
  /** O que de fato se gastou com a estrutura no período (DRE). */
  gasto: number
  /** O que as vendas deixam para a imobiliária: receita − impostos − corretores. */
  vendasDeixam: number
  /** Lançamentos que formam o `vendasDeixam`. */
  lancamentosDasVendas: Transaction[]
  /** vendasDeixam − orcado. */
  sobra: number
  /** O período inclui comissão prevista (ainda não devida). */
  temPrevisto: boolean
  categorias: CategoriaDoOrcamento[]
  /** Linhas que valem em algum mês do período. */
  linhasDoPeriodo: BudgetLine[]
}

export function apurarOrcamento(params: {
  linhas: BudgetLine[]
  transactions: Transaction[]
  parcelas: Map<string, SaleInstallment>
  periodo: PeriodoDre
  cenario: Cenario
}): ApuracaoDoOrcamento {
  const { transactions, parcelas, periodo, cenario } = params
  const meses = mesesDoPeriodo(periodo)
  const linhas = linhasDoCenario(params.linhas, cenario).filter((l) => meses.some((m) => vigente(l, m)))

  const doPeriodo = transactions.filter((t) => noPeriodo(competenciaNoDre(t, parcelas).slice(0, 7), periodo))
  const bruto = montarDre(doPeriodo).find((l) => l.id === 'bruto')?.valor ?? 0
  const lancamentosDasVendas = doPeriodo.filter((t) =>
    ['comissoes', 'outras-receitas', 'impostos', 'corretores'].includes(contaDoDre(t)),
  )
  const gastos = gastosDoPeriodo(transactions, parcelas, periodo)

  // Uma entrada por categoria, orçada ou gasta: gasto fora do orçamento também aparece.
  const porCategoria = new Map<string, CategoriaDoOrcamento>()
  const entrada = (categoria: string) => {
    let c = porCategoria.get(categoria)
    if (!c) {
      c = { categoria, orcado: 0, gasto: 0, linhas: [], lancamentos: [] }
      porCategoria.set(categoria, c)
    }
    return c
  }
  for (const l of linhas) {
    const c = entrada(l.category)
    c.orcado = r2(c.orcado + custoNoPeriodo(l, periodo))
    c.linhas.push(l)
  }
  for (const t of gastos) {
    const c = entrada(t.category)
    c.gasto = r2(c.gasto + t.amount)
    c.lancamentos.push(t)
  }

  const orcado = r2(linhas.reduce((s, l) => s + custoNoPeriodo(l, periodo), 0))
  const gasto = r2(gastos.reduce((s, t) => s + t.amount, 0))
  return {
    orcado,
    gasto,
    vendasDeixam: r2(bruto),
    lancamentosDasVendas,
    sobra: r2(bruto - orcado),
    temPrevisto: lancamentosDasVendas.some((t) => t.status !== 'settled'),
    categorias: [...porCategoria.values()].sort((a, b) => b.orcado - a.orcado || b.gasto - a.gasto),
    linhasDoPeriodo: linhas,
  }
}

// ---------------------------------------------------------------------------
// O teto de gastos (040)
// ---------------------------------------------------------------------------

/*
 * O X do Rafael (22/10/2026): um teto de gastos por mês, o mesmo todo mês, e
 * o sistema gira em torno dele. Os gastos orçados mostram onde o teto vai:
 *
 *   teto = gasto (lançado no mês) + reservado (orçado e ainda não lançado) + livre
 *
 * Lançar o coworking não diminui o livre: consome a reserva dele. Só gasto
 * além do planejado come o livre — e é isso que o lançamento e o sino avisam.
 */

export interface ReservaDoTeto {
  categoria: string
  /** Orçado confirmado para a categoria no mês. */
  orcado: number
  /** O que ainda falta lançar dela no mês. */
  falta: number
  linhas: BudgetLine[]
}

export interface SituacaoDoTeto {
  teto: number
  gasto: number
  reservado: number
  /** teto − gasto − reservado. Negativo = o mês vai passar do teto. */
  livre: number
  lancamentos: Transaction[]
  reservas: ReservaDoTeto[]
}

export function situacaoDoTeto(params: {
  teto: number
  linhas: BudgetLine[]
  transactions: Transaction[]
  parcelas: Map<string, SaleInstallment>
  /** `YYYY-MM`. */
  mes: string
}): SituacaoDoTeto {
  const { teto, transactions, parcelas, mes } = params
  const periodo: PeriodoDre = { de: mes, ate: mes, rotulo: mes }
  const lancamentos = gastosDoPeriodo(transactions, parcelas, periodo)
  const gasto = r2(lancamentos.reduce((s, t) => s + t.amount, 0))

  const porCategoria = new Map<string, ReservaDoTeto>()
  for (const l of params.linhas) {
    if (l.status !== 'confirmado' || !vigente(l, mes)) continue
    const r = porCategoria.get(l.category) ?? { categoria: l.category, orcado: 0, falta: 0, linhas: [] }
    r.orcado = r2(r.orcado + l.amount)
    r.linhas.push(l)
    porCategoria.set(l.category, r)
  }
  for (const r of porCategoria.values()) {
    const lancado = lancamentos.filter((t) => t.category === r.categoria).reduce((s, t) => s + t.amount, 0)
    r.falta = r2(Math.max(0, r.orcado - lancado))
  }
  const reservas = [...porCategoria.values()].sort((a, b) => b.orcado - a.orcado)
  const reservado = r2(reservas.reduce((s, r) => s + r.falta, 0))
  return { teto, gasto, reservado, livre: r2(teto - gasto - reservado), lancamentos, reservas }
}

/**
 * O teto depois de um gasto que ainda vai ser lançado: o mesmo cálculo com o
 * gasto incluído, para o formulário dizer quanto fica livre antes de salvar.
 */
export function tetoDepoisDe(
  params: Parameters<typeof situacaoDoTeto>[0],
  gasto: { categoria: string; valor: number; data: string; dreGroup: Transaction['dre_group'] },
): SituacaoDoTeto {
  const hipotetico = {
    id: 'hipotetico',
    kind: 'expense',
    category: gasto.categoria,
    dre_group: gasto.dreGroup,
    amount: gasto.valor,
    competence_date: gasto.data,
    status: 'pending',
  } as Transaction
  return situacaoDoTeto({ ...params, transactions: [...params.transactions, hipotetico] })
}

/**
 * O orçamento mês a mês, do primeiro ao último mês com gasto orçado (gasto
 * sem fim conta até 12 meses depois do mês de hoje). É a leitura que o Rafael
 * pediu: uma linha por mês, custo × o que as vendas deixam × o que sobra.
 */
export function orcamentoMesAMes(params: {
  linhas: BudgetLine[]
  transactions: Transaction[]
  parcelas: Map<string, SaleInstallment>
  cenario: Cenario
  hoje: Date
}): { mes: string; periodo: PeriodoDre; apuracao: ApuracaoDoOrcamento }[] {
  const linhas = linhasDoCenario(params.linhas, params.cenario)
  if (linhas.length === 0) return []
  const limite = new Date(params.hoje.getFullYear(), params.hoje.getMonth() + 12, 1)
  const chaveLimite = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}`
  const de = linhas.map((l) => l.start_month.slice(0, 7)).sort()[0]
  const ate = linhas.map((l) => l.end_month?.slice(0, 7) ?? chaveLimite).sort().reverse()[0]
  return mesesDoPeriodo({ de, ate, rotulo: '' }).map((mes) => {
    const periodo: PeriodoDre = { de: mes, ate: mes, rotulo: mes }
    return { mes, periodo, apuracao: apurarOrcamento({ ...params, periodo }) }
  })
}

/**
 * Quanto de cada real de comissão fica para a imobiliária, pela carteira de
 * vendas ativas: comissão menos ISS, Simples e corretor. A parte do sócio não
 * desconta — ela sai do lucro, não do custo da venda.
 */
export function margemDaCarteira(parcelas: SaleInstallment[]): number {
  let bruto = 0
  let fica = 0
  for (const p of parcelas) {
    bruto += p.amount
    fica += p.amount - p.iss_amount - p.simples_amount - (p.broker_amount - (p.broker_adjustment ?? 0))
  }
  return bruto > 0 ? fica / bruto : 0
}

/** A comissão média por venda ativa da imobiliária (sem venda de pessoa física nem cancelada). */
export function comissaoMedia(sales: Sale[]): number {
  const ativas = sales.filter((s) => !s.is_personal && s.status !== 'cancelada')
  return ativas.length ? ativas.reduce((s, v) => s + v.commission_total, 0) / ativas.length : 0
}
