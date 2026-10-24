import type { SaleInstallment, Transaction } from '@/types'
import { computeKpis, dreGroupOf, monthKey, PRO_LABORE_CATEGORIES } from './finance'

/*
 * O DRE DA IMOBILIÁRIA (22/10/2026).
 *
 * A estrutura é a de uma prestadora de serviço no Simples: receita bruta,
 * deduções, receita líquida, custo do serviço (o corretor), lucro bruto,
 * despesas operacionais abertas em comerciais, administrativas e pessoal,
 * lucro líquido e, abaixo dele, a distribuição ao sócio.
 *
 * Esta camada NÃO decide nenhum total. Receita, dedução, custo, lucro e
 * distribuição vêm inteiros de `computeKpis`; aqui só se abre o que ele já
 * somou em contas menores. As contas folha somam exatamente o subtotal acima
 * delas — se algum dia não somarem, o erro é desta camada, nunca do número.
 *
 * Não há linha de IR/CSLL: no Simples eles já estão dentro do DAS. Não há
 * resultado financeiro: ainda não existe categoria de tarifa ou rendimento.
 */

/** A conta folha onde cada lançamento cai. */
export type ContaDre =
  | 'comissoes'
  | 'outras-receitas'
  | 'impostos'
  | 'corretores'
  | 'gestao'
  | 'comerciais'
  | 'administrativas'
  | 'pessoal'
  | 'distribuicao'

const OUTRAS_RECEITAS = new Set(['Outras Receitas'])
/** A gestão do gestor de equipe (041): custo da venda, mas linha própria. */
export const CATEGORIA_GESTAO = 'Gestão de Equipe'
const PESSOAL = new Set(['Salários', ...PRO_LABORE_CATEGORIES])

/** Em que conta do DRE o lançamento entra. Segue `dreGroupOf`, só que mais aberto. */
export function contaDoDre(t: Transaction): ContaDre {
  switch (dreGroupOf(t)) {
    case 'revenue':
      return OUTRAS_RECEITAS.has(t.category) ? 'outras-receitas' : 'comissoes'
    case 'tax':
      return 'impostos'
    case 'cost_of_sale':
      return t.category === CATEGORIA_GESTAO ? 'gestao' : 'corretores'
    case 'operating_expense':
      return PESSOAL.has(t.category) ? 'pessoal' : 'administrativas'
    case 'withdrawal':
      return 'distribuicao'
    default:
      // variable_expense: marketing, brinde, premiação — o que gira com a venda.
      return 'comerciais'
  }
}

export interface LinhaDoDre {
  id: string
  rotulo: string
  /** `conta` é folha e recua; `grupo` e `subtotal` abrem a seção; `resultado` fecha. */
  tipo: 'grupo' | 'conta' | 'subtotal' | 'resultado'
  /** Com sinal: receita positiva, o que se desconta dela negativo. */
  valor: number
  /** As contas cujos lançamentos formam a linha — é nelas que ela abre. */
  contas: ContaDre[]
  explica: string
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** O DRE de um conjunto de lançamentos já recortado pelo período e pelo regime. */
export function montarDre(txs: Transaction[]): LinhaDoDre[] {
  const k = computeKpis(txs, null)
  const soma = new Map<ContaDre, number>()
  for (const t of txs) {
    const c = contaDoDre(t)
    soma.set(c, (soma.get(c) ?? 0) + t.amount)
  }
  const de = (c: ContaDre) => r2(soma.get(c) ?? 0)
  const despesas = k.operatingExpense + k.variableExpense + k.otherExpense

  return [
    { id: 'bruta', tipo: 'grupo', rotulo: 'Receita bruta', valor: k.revenue, contas: ['comissoes', 'outras-receitas'], explica: 'Tudo o que a imobiliária faturou no período: a comissão das vendas e o que entrou fora delas.' },
    { id: 'comissoes', tipo: 'conta', rotulo: 'Comissões de venda', valor: de('comissoes'), contas: ['comissoes'], explica: 'A comissão da imobiliária em cada parcela. Em parceria, só a parte dela.' },
    { id: 'outras-receitas', tipo: 'conta', rotulo: 'Outras receitas', valor: de('outras-receitas'), contas: ['outras-receitas'], explica: 'Entradas que não vieram de venda.' },
    { id: 'impostos', tipo: 'grupo', rotulo: '(−) Impostos sobre o faturamento', valor: -k.taxDeductions, contas: ['impostos'], explica: 'Simples Nacional e ISS retido pela construtora. É dedução da receita, não despesa da estrutura.' },
    { id: 'liquida', tipo: 'subtotal', rotulo: 'Receita líquida', valor: k.netRevenue, contas: ['comissoes', 'outras-receitas', 'impostos'], explica: 'A receita depois do imposto sobre o faturamento.' },
    { id: 'corretores', tipo: 'grupo', rotulo: '(−) Comissões de corretores', valor: -k.costOfSale, contas: ['corretores', 'gestao'], explica: 'O custo direto da venda: a parte do corretor e a gestão do gestor de equipe. Só existe quando há venda.' },
    { id: 'parte-corretor', tipo: 'conta', rotulo: 'Corretores', valor: -de('corretores'), contas: ['corretores'], explica: 'A parte de cada corretor nas vendas.' },
    { id: 'gestao', tipo: 'conta', rotulo: 'Gestão de equipe', valor: -de('gestao'), contas: ['gestao'], explica: 'O que o gestor ganha sobre as vendas do time: 3% da base, 8% no mês em que a imobiliária bate a meta geral. Sai da parte da imobiliária.' },
    { id: 'bruto', tipo: 'subtotal', rotulo: 'Lucro bruto', valor: k.grossProfit, contas: ['comissoes', 'outras-receitas', 'impostos', 'corretores', 'gestao'], explica: 'O que sobra de cada venda para pagar a estrutura.' },
    { id: 'despesas', tipo: 'grupo', rotulo: '(−) Despesas operacionais', valor: -despesas, contas: ['comerciais', 'administrativas', 'pessoal'], explica: 'O que a imobiliária gasta para funcionar, com ou sem venda no mês.' },
    { id: 'comerciais', tipo: 'conta', rotulo: 'Comerciais', valor: -de('comerciais'), contas: ['comerciais'], explica: 'Marketing, brindes de fechamento e premiações.' },
    { id: 'administrativas', tipo: 'conta', rotulo: 'Administrativas', valor: -de('administrativas'), contas: ['administrativas'], explica: 'Sistemas, material, contabilidade, aluguel.' },
    { id: 'pessoal', tipo: 'conta', rotulo: 'Pessoal', valor: -de('pessoal'), contas: ['pessoal'], explica: 'Pró-labore e salários. Pró-labore remunera o trabalho do sócio e entra antes do lucro.' },
    { id: 'liquido', tipo: 'resultado', rotulo: 'Lucro líquido', valor: k.netProfit, contas: ['comissoes', 'outras-receitas', 'impostos', 'corretores', 'gestao', 'comerciais', 'administrativas', 'pessoal'], explica: 'O resultado da imobiliária no período. Não é saldo em conta.' },
    { id: 'distribuicao', tipo: 'grupo', rotulo: '(−) Distribuição de lucros', valor: -k.profitDistribution, contas: ['distribuicao'], explica: 'Retiradas do sócio. Remuneram o capital e saem depois do lucro, nunca antes.' },
    { id: 'retido', tipo: 'resultado', rotulo: 'Lucro retido', valor: k.retainedProfit, contas: ['comissoes', 'outras-receitas', 'impostos', 'corretores', 'gestao', 'comerciais', 'administrativas', 'pessoal', 'distribuicao'], explica: 'O que fica na imobiliária depois das retiradas.' },
  ]
}

// ---------------------------------------------------------------------------
// Competência: quando a comissão vira receita
// ---------------------------------------------------------------------------

/*
 * DECISÃO DO RAFAEL EM 22/10/2026: no DRE, a comissão vira receita quando
 * fica devida — gatilho atingido e nota emitida —, não na data da venda.
 * Assinar o contrato não dá direito à comissão; o gatilho dá. Com a regra
 * antiga, 2026 mostrava R$ 293 mil de receita, R$ 222,9 mil dela só para
 * 2027 e ainda sujeita a distrato.
 *
 * A receita da parcela e tudo o que nasce dela (ISS, Simples, corretor,
 * parte do sócio) andam juntos, na mesma data: é o confronto da receita com
 * o custo que ela gera. Nada é regravado no banco; o `competence_date` dos
 * lançamentos continua sendo a data da venda, e só o DRE lê esta data.
 */

/**
 * A data em que a comissão da parcela fica devida. Nota emitida manda; sem
 * ela, o gatilho; sem os dois, o recebimento (venda sem nota, como a Rogga);
 * e, enquanto nada disso aconteceu, a data prevista — é previsão, e o DRE a
 * mostra como tal.
 */
export function dataDeReconhecimento(p: SaleInstallment): string {
  return p.invoice_issued_date ?? p.trigger_met_date ?? p.received_date ?? p.expected_date
}

/*
 * DECISÃO DE 23/10/2026 (C6, CPC 47): o DRE realizado só leva a comissão que
 * já é devida — nota, gatilho ou dinheiro. A parcela que ainda depende de um
 * evento futuro é previsão: aparece à parte, nunca somada ao resultado.
 */
/** A parcela já virou direito da imobiliária? */
export function parcelaDevida(p: SaleInstallment): boolean {
  return Boolean(p.invoice_issued_date ?? p.trigger_met_date ?? p.received_date)
}

/**
 * O lançamento entra no DRE realizado? Os de venda, só com a parcela devida;
 * os outros (despesas, retiradas) sempre — despesa lançada é obrigação.
 */
export function lancamentoDevido(t: Transaction, parcelas: Map<string, SaleInstallment>): boolean {
  const p = t.sale_installment_id ? parcelas.get(t.sale_installment_id) : undefined
  return p ? parcelaDevida(p) : true
}

/** A competência do lançamento no DRE: a da parcela de origem, quando há; senão a gravada. */
export function competenciaNoDre(t: Transaction, parcelas: Map<string, SaleInstallment>): string {
  const p = t.sale_installment_id ? parcelas.get(t.sale_installment_id) : undefined
  return p ? dataDeReconhecimento(p) : t.competence_date
}

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

export type TipoPeriodo = 'mes' | 'trimestre' | 'ano' | 'acumulado'

export interface PeriodoDre {
  /** Meses de-até, em `YYYY-MM`, os dois inclusos. */
  de: string
  ate: string
  rotulo: string
}

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const chave = (ano: number, mes0: number) => monthKey(new Date(ano, mes0, 1))

/**
 * O período escolhido e o anterior a ele, a partir do mês da tela. O
 * acumulado compara com o mesmo trecho do ano passado — jan a out contra jan
 * a out — porque comparar com o ano inteiro faria todo acumulado "cair".
 */
export function periodosDoDre(mes: Date, tipo: TipoPeriodo): { atual: PeriodoDre; anterior: PeriodoDre } {
  const a = mes.getFullYear()
  const m = mes.getMonth()
  const fmtMes = (ano: number, m0: number) => `${NOMES[m0]}/${ano}`
  switch (tipo) {
    case 'mes': {
      const p = new Date(a, m - 1, 1)
      return {
        atual: { de: chave(a, m), ate: chave(a, m), rotulo: fmtMes(a, m) },
        anterior: { de: monthKey(p), ate: monthKey(p), rotulo: fmtMes(p.getFullYear(), p.getMonth()) },
      }
    }
    case 'trimestre': {
      const q = Math.floor(m / 3)
      const pa = q === 0 ? a - 1 : a
      const pq = q === 0 ? 3 : q - 1
      return {
        atual: { de: chave(a, q * 3), ate: chave(a, q * 3 + 2), rotulo: `${q + 1}º tri/${a}` },
        anterior: { de: chave(pa, pq * 3), ate: chave(pa, pq * 3 + 2), rotulo: `${pq + 1}º tri/${pa}` },
      }
    }
    case 'ano':
      return {
        atual: { de: chave(a, 0), ate: chave(a, 11), rotulo: String(a) },
        anterior: { de: chave(a - 1, 0), ate: chave(a - 1, 11), rotulo: String(a - 1) },
      }
    case 'acumulado':
      return {
        atual: { de: chave(a, 0), ate: chave(a, m), rotulo: `jan a ${fmtMes(a, m)}` },
        anterior: { de: chave(a - 1, 0), ate: chave(a - 1, m), rotulo: `jan a ${fmtMes(a - 1, m)}` },
      }
  }
}

/** O mês `YYYY-MM` está dentro do período? */
export function noPeriodo(mesChave: string, p: PeriodoDre): boolean {
  return mesChave >= p.de && mesChave <= p.ate
}
