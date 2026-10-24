import type { SaleInstallment, Transaction } from '@/types'
import { vendaConta, vgvDaVenda, vlvDaVenda } from './comissao'
import { competenciaNoDre, lancamentoDevido, montarDre } from './dre'
import { monthKey } from './finance'
import type { MoneyItem, SaleView } from './sales'

/*
 * O DICIONÁRIO DE INDICADORES (Fase 6, 23/10/2026).
 *
 * Cada indicador diz o que é, a conta e de onde vem — é a ajuda contextual da
 * tela. Nenhum inventa regra: VGV e VLV vêm de lib/comissao.ts, resultado do
 * DRE realizado (só o devido), carteira das parcelas gravadas. O que o
 * sistema ainda não tem dado para medir aparece como "dados insuficientes",
 * dizendo o que falta — nunca como zero.
 */

export type FormatoIndicador = 'moeda' | 'percentual' | 'numero' | 'meses' | 'dias'

export interface Indicador {
  id: string
  grupo: 'Vendas' | 'Resultado' | 'Recebimento' | 'Caixa' | 'Dados insuficientes'
  nome: string
  /** O valor; nulo = sem dado para medir. */
  valor: number | null
  formato: FormatoIndicador
  /** A conta, em palavras. */
  formula: string
  /** O que falta, quando o valor é nulo. */
  falta?: string
}

const r2 = (v: number) => Math.round(v * 100) / 100

export function calcularIndicadores(p: {
  vendas: SaleView[]
  transactions: Transaction[]
  installments: SaleInstallment[]
  receber: MoneyItem[]
  saldo: number
  teto: number | null
  /** Último mês da janela de 12 meses. */
  ate: Date
}): Indicador[] {
  const fim = monthKey(p.ate)
  const inicio = monthKey(new Date(p.ate.getFullYear(), p.ate.getMonth() - 11, 1))
  const naJanela = (data: string) => data.slice(0, 7) >= inicio && data.slice(0, 7) <= fim

  // Vendas da imobiliária nos 12 meses (a data do contrato).
  const vendas12 = p.vendas.filter((v) => vendaConta(v) && naJanela(v.sale_date))
  const comValor = vendas12.filter((v) => v.property_value != null && v.property_value > 0)
  const vgv = r2(comValor.reduce((s, v) => s + vgvDaVenda(v), 0))
  const vlv = r2(comValor.reduce((s, v) => s + vlvDaVenda(v), 0))
  const comissao12 = r2(comValor.reduce((s, v) => s + v.cascade.commission, 0))

  // DRE realizado dos 12 meses.
  const parcelas = new Map(p.installments.map((i) => [i.id, i]))
  const dre = montarDre(
    p.transactions.filter((t) => naJanela(competenciaNoDre(t, parcelas)) && lancamentoDevido(t, parcelas)),
  )
  const de = (id: string) => dre.find((l) => l.id === id)?.valor ?? 0
  const receita = de('bruta')

  // Carteira ativa: o que cada real de comissão contratada deixa para a imobiliária.
  const ativas = p.vendas.filter(vendaConta)
  const carteiraComissao = ativas.reduce((s, v) => s + v.cascade.commission, 0)
  const carteiraFica = ativas.reduce((s, v) => s + v.cascade.net, 0)

  // Prazo de recebimento: dias do contrato até o dinheiro, ponderado pelo valor.
  let pesoDias = 0
  let pesoValor = 0
  for (const v of ativas)
    for (const i of v.installments) {
      if (i.status !== 'recebida' || !i.received_date) continue
      const dias = (Date.parse(i.received_date) - Date.parse(v.sale_date)) / 86_400_000
      pesoDias += dias * i.amount
      pesoValor += i.amount
    }
  const recebido = ativas.reduce((s, v) => s + v.received, 0)

  const aReceber = p.receber.reduce((s, i) => s + i.amount, 0)
  const emAtraso = p.receber.filter((i) => i.overdue).reduce((s, i) => s + i.amount, 0)

  // Concentração: a construtora com a maior fatia da comissão contratada ativa.
  const porConstrutora = new Map<string, number>()
  for (const v of ativas) {
    const nome = v.developer ?? v.development ?? 'Sem construtora'
    porConstrutora.set(nome, (porConstrutora.get(nome) ?? 0) + v.cascade.commission)
  }
  const maior = [...porConstrutora.entries()].sort((a, b) => b[1] - a[1])[0]

  // Ponto de equilíbrio (Fase 8): quanto cada real de VGV deixa, e quanto VGV paga o teto.
  const comVgv = ativas.filter((v) => (v.property_value ?? 0) > 0)
  const vgvCarteira = comVgv.reduce((s, v) => s + vgvDaVenda(v), 0)
  const ficaPorVgv = vgvCarteira > 0 ? comVgv.reduce((s, v) => s + v.cascade.net, 0) / vgvCarteira : 0

  return [
    { id: 'vgv', grupo: 'Vendas', nome: 'VGV · 12 meses', valor: vgv, formato: 'moeda', formula: 'Soma do valor inteiro dos imóveis vendidos nos últimos 12 meses, pela data do contrato.' },
    { id: 'vlv', grupo: 'Vendas', nome: 'VLV · 12 meses', valor: vlv, formato: 'moeda', formula: 'Valor Líquido Vendido: o VGV vezes a fatia da Souza em cada venda (em parceria, só a parte dela).' },
    { id: 'vendas', grupo: 'Vendas', nome: 'Vendas · 12 meses', valor: vendas12.length, formato: 'numero', formula: 'Contratos da imobiliária no período, sem os cancelados e sem os de pessoa física.' },
    { id: 'ticket', grupo: 'Vendas', nome: 'Ticket médio', valor: comValor.length ? r2(vgv / comValor.length) : null, formato: 'moeda', formula: 'VGV dividido pelo número de vendas com valor do imóvel informado.', falta: 'nenhuma venda com valor do imóvel nos 12 meses' },
    { id: 'comissao-media', grupo: 'Vendas', nome: 'Comissão média', valor: vlv ? r2((comissao12 / vlv) * 100) : null, formato: 'percentual', formula: 'Comissão da imobiliária dividida pelo VLV: quanto do valor do imóvel vira comissão para a Souza.', falta: 'sem VLV no período' },

    { id: 'receita', grupo: 'Resultado', nome: 'Receita · 12 meses', valor: receita, formato: 'moeda', formula: 'Receita bruta do DRE realizado: só a comissão já devida (nota, gatilho ou dinheiro).' },
    { id: 'margem-bruta', grupo: 'Resultado', nome: 'Margem bruta', valor: receita ? r2((de('bruto') / receita) * 100) : null, formato: 'percentual', formula: 'Lucro bruto ÷ receita: o que sobra da comissão depois de impostos, corretores e gestão.', falta: 'sem receita devida no período' },
    { id: 'margem-liquida', grupo: 'Resultado', nome: 'Margem líquida', valor: receita ? r2((de('liquido') / receita) * 100) : null, formato: 'percentual', formula: 'Lucro líquido ÷ receita: o que sobra depois também das despesas da estrutura.', falta: 'sem receita devida no período' },
    { id: 'fica', grupo: 'Resultado', nome: 'Fica de cada R$ 100 de comissão', valor: carteiraComissao ? r2((carteiraFica / carteiraComissao) * 100) : null, formato: 'moeda', formula: 'Na carteira ativa, a parte da comissão contratada que fica com a imobiliária depois de impostos, corretores e gestão.', falta: 'sem vendas ativas' },

    { id: 'prazo', grupo: 'Recebimento', nome: 'Prazo médio de recebimento', valor: pesoValor ? r2(pesoDias / pesoValor / 30.44) : null, formato: 'meses', formula: 'Tempo do contrato até o dinheiro entrar, em média ponderada pelo valor de cada parcela recebida.', falta: 'nenhuma parcela recebida ainda' },
    { id: 'recebido', grupo: 'Recebimento', nome: 'Carteira já recebida', valor: carteiraComissao ? r2((recebido / carteiraComissao) * 100) : null, formato: 'percentual', formula: 'Comissão recebida ÷ comissão contratada das vendas ativas.', falta: 'sem vendas ativas' },
    { id: 'atraso', grupo: 'Recebimento', nome: 'Em atraso', valor: aReceber ? r2((emAtraso / aReceber) * 100) : null, formato: 'percentual', formula: 'Parcelas vencidas que a construtora não pagou ÷ tudo o que está a receber.', falta: 'nada a receber' },
    { id: 'concentracao', grupo: 'Recebimento', nome: maior ? `Maior construtora · ${maior[0]}` : 'Maior construtora', valor: maior && carteiraComissao ? r2((maior[1] / carteiraComissao) * 100) : null, formato: 'percentual', formula: 'A fatia da comissão contratada que depende de uma construtora só. Quanto maior, mais o atraso dela pesa.', falta: 'sem vendas ativas' },

    { id: 'saldo', grupo: 'Caixa', nome: 'Saldo em conta', valor: r2(p.saldo), formato: 'moeda', formula: 'Soma das contas ativas da imobiliária hoje, sem o cartão de crédito.' },
    { id: 'folego', grupo: 'Caixa', nome: 'Fôlego', valor: p.teto ? r2(p.saldo / p.teto) : null, formato: 'meses', formula: 'Saldo ÷ teto de gastos do mês: quantos meses de estrutura o caixa paga sem venda nova.', falta: 'teto de gastos não definido' },

    { id: 'equilibrio', grupo: 'Caixa', nome: 'Ponto de equilíbrio · VGV por mês', valor: p.teto && ficaPorVgv > 0 ? r2(p.teto / ficaPorVgv) : null, formato: 'moeda', formula: `Teto de gastos ÷ o que cada R$ 1 de VGV deixa para a imobiliária (${ficaPorVgv > 0 ? `R$ ${(ficaPorVgv * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} a cada R$ 100` : 'sem carteira'}). É a venda mensal que paga a estrutura — e o dinheiro dela entra ao longo dos meses.`, falta: 'teto de gastos não definido ou carteira sem valor de imóvel' },

    { id: 'liquidez', grupo: 'Dados insuficientes', nome: 'Liquidez e endividamento', valor: null, formato: 'percentual', formula: 'Ativos ÷ passivos da empresa.', falta: 'o balanço (bens, dívidas e patrimônio) não está no sistema' },
  ]
}

export function formatarIndicador(i: Indicador): string {
  if (i.valor == null) return 'Dados insuficientes'
  switch (i.formato) {
    case 'percentual':
      return `${i.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    case 'numero':
      return i.valor.toLocaleString('pt-BR')
    case 'meses':
      return `${i.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${i.valor === 1 ? 'mês' : 'meses'}`
    case 'dias':
      return `${Math.round(i.valor)} dias`
    default:
      return i.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
}
