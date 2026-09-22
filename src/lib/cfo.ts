import { toDateOnly } from './format'
import type { MoneyItem, SaleView } from './sales'
import type { Transaction } from '@/types'

/*
 * AS CONTAS DE DIRETOR FINANCEIRO.
 *
 * As outras telas respondem "o que aconteceu" e "o que vai entrar". Aqui
 * moram as quatro perguntas que um CFO faz antes de decidir qualquer coisa,
 * e que o sistema não respondia:
 *
 *   1. PREVISÃO DE CAIXA — vou ter dinheiro no dia 10? Saldo de hoje, mais o
 *      que entra, menos o que sai, mês a mês. É a única conta aqui que mistura
 *      entrada com saída, porque caixa é exatamente isso.
 *   2. PONTO DE EQUILÍBRIO — quanto de comissão precisa entrar por mês só
 *      para pagar a estrutura. Abaixo disso, o mês consome reserva.
 *   3. AGING DA CARTEIRA — a comissão a receber está perto ou longe? Carteira
 *      longa não é ruim, mas é caixa que não existe.
 *   4. CONCENTRAÇÃO — está no Início (Raio-X): de quem a carteira depende.
 *
 * Nada aqui recalcula imposto, comissão ou resultado: tudo lê o que já está
 * gravado. O que este arquivo faz é aritmética de calendário.
 */

const r2 = (n: number) => Math.round(n * 100) / 100
const chaveDoMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// ---------------------------------------------------------------------------
// 1. Previsão de caixa
// ---------------------------------------------------------------------------

export interface MesDeCaixa {
  mes: Date
  entra: number
  sai: number
  /** entra − sai. */
  resultado: number
  /** Saldo projetado no fim do mês, partindo do saldo de hoje. */
  saldo: number
  entradas: MoneyItem[]
  saidas: MoneyItem[]
}

/**
 * O caixa projetado, mês a mês. `receber` e `pagar` são as MESMAS listas das
 * telas de A receber e A pagar — se um número divergir de lá, é bug, não
 * interpretação. Vencido entra no primeiro mês: ele não desaparece só porque
 * a data passou.
 */
export function previsaoDeCaixa(params: {
  saldoHoje: number
  receber: MoneyItem[]
  pagar: MoneyItem[]
  meses: Date[]
  hoje?: string
}): { meses: MesDeCaixa[]; menorSaldo: MesDeCaixa | null } {
  const { saldoHoje, receber, pagar, meses } = params
  const hoje = params.hoje ?? toDateOnly(new Date())
  const primeira = meses[0] ? chaveDoMes(meses[0]) : null

  /** O mês em que a linha cai: o vencido cai no primeiro mês da janela. */
  const mesDaLinha = (i: MoneyItem) => (i.date < hoje && primeira ? primeira : i.date.slice(0, 7))

  let saldo = saldoHoje
  const linhas = meses.map((mes) => {
    const chave = chaveDoMes(mes)
    const entradas = receber.filter((i) => mesDaLinha(i) === chave)
    const saidas = pagar.filter((i) => mesDaLinha(i) === chave)
    const entra = r2(entradas.reduce((s, i) => s + i.amount, 0))
    const sai = r2(saidas.reduce((s, i) => s + i.amount, 0))
    const resultado = r2(entra - sai)
    saldo = r2(saldo + resultado)
    return { mes, entra, sai, resultado, saldo, entradas, saidas }
  })

  const menorSaldo = linhas.reduce<MesDeCaixa | null>(
    (pior, m) => (pior === null || m.saldo < pior.saldo ? m : pior),
    null,
  )
  return { meses: linhas, menorSaldo }
}

// ---------------------------------------------------------------------------
// 2. Ponto de equilíbrio
// ---------------------------------------------------------------------------

export interface PontoDeEquilibrio {
  /** Estrutura média por mês, dos meses fechados que já têm despesa paga. */
  custoFixo: number
  mesesUsados: number
  /** Quanto de cada real de comissão sobra para a imobiliária (0–1). */
  margem: number
  /** Comissão bruta necessária por mês para cobrir a estrutura. */
  comissaoNecessaria: number
  /** Média de comissão que entrou por mês, na mesma janela. */
  comissaoMedia: number
  /** Quantos dos meses da janela cobriram a estrutura. */
  mesesQueCobriram: number
}

/**
 * O ponto de equilíbrio da imobiliária.
 *
 * Estrutura é despesa que existe com ou sem venda (aluguel, contabilidade,
 * ferramenta): `dre_group = 'operating_expense'`. Imposto e comissão de
 * corretor NÃO entram — eles só existem quando há venda, e já estão
 * descontados na margem.
 *
 * A margem vem da carteira real (quanto sobra de cada real de comissão), não
 * de um chute: com margem de 61%, cada R$ 1,00 de estrutura exige R$ 1,64 de
 * comissão bruta.
 */
export function pontoDeEquilibrio(params: {
  transactions: Transaction[]
  /** Meses fechados a considerar (o mês corrente entra pela metade e distorce). */
  meses: Date[]
  margem: number
  entradasPorMes: { mes: Date; total: number }[]
}): PontoDeEquilibrio {
  const { transactions, meses, margem, entradasPorMes } = params
  const chaves = meses.map(chaveDoMes)

  const porMes = new Map<string, number>()
  for (const t of transactions) {
    if (t.dre_group !== 'operating_expense') continue
    const data = t.status === 'settled' ? t.settled_date ?? t.competence_date : t.due_date ?? t.competence_date
    const chave = data?.slice(0, 7)
    if (!chave || !chaves.includes(chave)) continue
    porMes.set(chave, r2((porMes.get(chave) ?? 0) + t.amount))
  }

  const comDespesa = [...porMes.values()].filter((v) => v > 0)
  const custoFixo = comDespesa.length > 0 ? r2(comDespesa.reduce((s, v) => s + v, 0) / comDespesa.length) : 0
  const comissaoNecessaria = margem > 0 ? r2(custoFixo / margem) : 0

  const entradas = entradasPorMes.filter((e) => chaves.includes(chaveDoMes(e.mes)))
  const comissaoMedia = entradas.length > 0 ? r2(entradas.reduce((s, e) => s + e.total, 0) / entradas.length) : 0
  const mesesQueCobriram = entradas.filter((e) => comissaoNecessaria > 0 && e.total >= comissaoNecessaria).length

  return {
    custoFixo,
    mesesUsados: comDespesa.length,
    margem,
    comissaoNecessaria,
    comissaoMedia,
    mesesQueCobriram,
  }
}

// ---------------------------------------------------------------------------
// 3. Aging da carteira
// ---------------------------------------------------------------------------

export interface FaixaDeAging {
  rotulo: string
  /** Limite superior em dias; `null` no último. */
  ate: number | null
  total: number
  parcelas: number
  fatia: number
}

/**
 * A comissão a receber, por distância. Carteira longa não é defeito — parcela
 * de 2027 é venda feita e assinada. Mas é caixa que não existe, e quem decide
 * contratação ou compra precisa saber disso com número na mão.
 *
 * Parcela com a data passada fica na primeira faixa, com nome próprio: ela é
 * cobrança, não previsão.
 */
export function agingDaCarteira(vendas: SaleView[], hoje = toDateOnly(new Date())): FaixaDeAging[] {
  const faixas: FaixaDeAging[] = [
    { rotulo: 'Em atraso', ate: 0, total: 0, parcelas: 0, fatia: 0 },
    { rotulo: 'Até 90 dias', ate: 90, total: 0, parcelas: 0, fatia: 0 },
    { rotulo: '91 a 180 dias', ate: 180, total: 0, parcelas: 0, fatia: 0 },
    { rotulo: '181 a 360 dias', ate: 360, total: 0, parcelas: 0, fatia: 0 },
    { rotulo: 'Mais de um ano', ate: null, total: 0, parcelas: 0, fatia: 0 },
  ]
  const dias = (iso: string) => Math.round((Date.parse(iso) - Date.parse(hoje)) / 86400000)

  for (const v of vendas) {
    if (v.status === 'cancelada' || v.is_personal) continue
    for (const p of v.installments) {
      if (p.status !== 'prevista') continue
      const d = dias(p.expected_date)
      const faixa = faixas.find((f) => f.ate !== null && d <= f.ate) ?? faixas[faixas.length - 1]
      faixa.total = r2(faixa.total + p.amount)
      faixa.parcelas += 1
    }
  }
  const total = r2(faixas.reduce((s, f) => s + f.total, 0))
  return faixas.map((f) => ({ ...f, fatia: total > 0 ? f.total / total : 0 }))
}
