import type { Account, Transaction, Transfer } from '@/types'
import { accountBalance } from './treasury'
import { contaDoDre, type ContaDre, type PeriodoDre } from './dre'
import { toDateOnly } from './format'

/*
 * FLUXO DE CAIXA DA IMOBILIÁRIA (22/10/2026).
 *
 * O par do DRE. O DRE diz quanto a empresa ganhou; este diz quanto dinheiro
 * entrou e saiu das contas dela, e com quanto ela começou e terminou o
 * período. Lucro sem caixa quebra empresa — por isso os dois.
 *
 * A conta fecha com o banco por construção:
 *   saldo no início + entradas − saídas ± transferências + abertura = saldo no fim
 * e os dois saldos vêm de `accountBalance`, a mesma conta da tela de saldo.
 *
 * O que entra: lançamento liquidado numa conta de dinheiro da imobiliária
 * (corrente, poupança, caixa, investimento), a partir da abertura dela no
 * sistema. Compra no cartão não é saída de caixa: o dinheiro sai quando a
 * fatura é paga, e esse pagamento é uma transferência para o cartão.
 *
 * O que fica de fora, à vista e com valor: o liquidado sem conta (recebido
 * direto na conta pessoal, o acumulado perdoado) e o anterior à abertura da
 * conta no sistema. Não somem: aparecem num quadro próprio.
 */

export type IdLinhaDoCaixa =
  | 'saldo-inicial'
  | 'recebimentos'
  | 'comissoes'
  | 'outras-receitas'
  | 'pagamentos'
  | 'impostos'
  | 'corretores'
  | 'despesas'
  | 'gerado'
  | 'retiradas'
  | 'transferencias'
  | 'abertura'
  | 'variacao'
  | 'saldo-final'

export interface LinhaDoCaixa {
  id: IdLinhaDoCaixa
  rotulo: string
  tipo: 'grupo' | 'conta' | 'subtotal' | 'resultado'
  valor: number
  explica: string
  /** Os lançamentos que formam a linha (com sinal na conta: entrada +, saída −). */
  lancamentos: Transaction[]
  /** Nas linhas de saldo, o saldo de cada conta. */
  saldos?: { conta: Account; saldo: number }[]
}

export interface FluxoDeCaixa {
  linhas: LinhaDoCaixa[]
  /** Liquidado no período que não passou por conta de dinheiro da imobiliária. */
  foraDoSaldo: Transaction[]
  /** A data mais antiga em que alguma conta de dinheiro começa no sistema. */
  contasDesde: string | null
}

const r2 = (v: number) => Math.round(v * 100) / 100
const ehCaixa = (a: Account) => a.type !== 'credit_card'

/** Primeiro e último dia do período, e a véspera do primeiro. */
function limites(p: PeriodoDre) {
  const inicio = `${p.de}-01`
  const [a, m] = p.ate.split('-').map(Number)
  const fim = toDateOnly(new Date(a, m, 0))
  const [ai, mi] = p.de.split('-').map(Number)
  const vespera = toDateOnly(new Date(ai, mi - 1, 0))
  return { inicio, fim, vespera }
}

export function montarFluxoDeCaixa(params: {
  accounts: Account[]
  transactions: Transaction[]
  transfers: Transfer[]
  periodo: PeriodoDre
}): FluxoDeCaixa {
  const { accounts, transactions, transfers, periodo } = params
  const { inicio, fim, vespera } = limites(periodo)
  const caixa = accounts.filter(ehCaixa)
  const porId = new Map(caixa.map((a) => [a.id, a]))

  const saldosEm = (data: string, contas: Account[]) =>
    contas.map((conta) => ({ conta, saldo: r2(accountBalance(conta, transactions, transfers, data).balance) }))
  const somaSaldos = (s: { saldo: number }[]) => r2(s.reduce((acc, x) => acc + x.saldo, 0))

  // Conta aberta antes do período entra pelo saldo; aberta dentro dele, pela abertura.
  const saldosIniciais = saldosEm(vespera, caixa.filter((a) => a.opening_date <= vespera))
  const abertas = caixa.filter((a) => a.opening_date >= inicio && a.opening_date <= fim)
  const saldosFinais = saldosEm(fim, caixa.filter((a) => a.opening_date <= fim))

  const doPeriodo = transactions.filter((t) => {
    if (t.status !== 'settled') return false
    const d = t.settled_date ?? t.competence_date
    return d >= inicio && d <= fim
  })
  const controlado = (t: Transaction) => {
    const conta = t.account_id ? porId.get(t.account_id) : undefined
    return !!conta && (t.settled_date ?? t.competence_date) >= conta.opening_date
  }
  const movimentos = doPeriodo.filter(controlado)
  const foraDoSaldo = doPeriodo.filter((t) => !controlado(t) && !accounts.some((a) => a.id === t.account_id && !ehCaixa(a)))

  const de = (...contas: ContaDre[]) => movimentos.filter((t) => contas.includes(contaDoDre(t)))
  const soma = (txs: Transaction[]) => r2(txs.reduce((s, t) => s + t.amount, 0))

  // Transferência só move caixa quando cruza a fronteira (ex.: pagar a fatura do cartão).
  let transferencias = 0
  for (const tr of transfers) {
    if (tr.date < inicio || tr.date > fim) continue
    const para = porId.get(tr.to_account_id)
    const de_ = porId.get(tr.from_account_id)
    if (para && tr.date >= para.opening_date) transferencias += tr.amount
    if (de_ && tr.date >= de_.opening_date) transferencias -= tr.amount
  }
  transferencias = r2(transferencias)

  const comissoes = de('comissoes')
  const outras = de('outras-receitas')
  const impostos = de('impostos')
  const corretores = de('corretores')
  const despesas = de('comerciais', 'administrativas', 'pessoal')
  const retiradas = de('distribuicao')

  const recebido = soma([...comissoes, ...outras])
  const pago = soma([...impostos, ...corretores, ...despesas])
  const gerado = r2(recebido - pago)
  const abertura = r2(abertas.reduce((s, a) => s + a.opening_balance, 0))
  const saldoInicial = somaSaldos(saldosIniciais)
  const variacao = r2(gerado - soma(retiradas) + transferencias + abertura)

  const linhas: LinhaDoCaixa[] = [
    { id: 'saldo-inicial', tipo: 'grupo', rotulo: 'Saldo no início', valor: saldoInicial, explica: 'O dinheiro nas contas da imobiliária na véspera do período.', lancamentos: [], saldos: saldosIniciais },
    { id: 'recebimentos', tipo: 'grupo', rotulo: '(+) Recebimentos', valor: recebido, explica: 'O dinheiro que entrou nas contas da imobiliária.', lancamentos: [...comissoes, ...outras] },
    { id: 'comissoes', tipo: 'conta', rotulo: 'Comissões recebidas', valor: soma(comissoes), explica: 'O que as construtoras pagaram de comissão.', lancamentos: comissoes },
    { id: 'outras-receitas', tipo: 'conta', rotulo: 'Outros recebimentos', valor: soma(outras), explica: 'Entradas que não vieram de venda.', lancamentos: outras },
    { id: 'pagamentos', tipo: 'grupo', rotulo: '(−) Pagamentos da operação', valor: -pago, explica: 'O dinheiro que saiu para tocar a imobiliária.', lancamentos: [...impostos, ...corretores, ...despesas] },
    { id: 'impostos', tipo: 'conta', rotulo: 'Impostos pagos', valor: -soma(impostos), explica: 'Guias do Simples e ISS pagos ou retidos.', lancamentos: impostos },
    { id: 'corretores', tipo: 'conta', rotulo: 'Comissões pagas aos corretores', valor: -soma(corretores), explica: 'O repasse aos corretores.', lancamentos: corretores },
    { id: 'despesas', tipo: 'conta', rotulo: 'Despesas pagas', valor: -soma(despesas), explica: 'Marketing, brindes, sistemas e estrutura.', lancamentos: despesas },
    { id: 'gerado', tipo: 'subtotal', rotulo: 'Caixa gerado pela operação', valor: gerado, explica: 'Recebimentos menos pagamentos: o caixa que o próprio negócio produziu.', lancamentos: [...comissoes, ...outras, ...impostos, ...corretores, ...despesas] },
    { id: 'retiradas', tipo: 'grupo', rotulo: '(−) Retiradas do sócio', valor: -soma(retiradas), explica: 'O que o sócio tirou da empresa. Sai depois da operação.', lancamentos: retiradas },
    { id: 'transferencias', tipo: 'grupo', rotulo: '(±) Transferências e fatura do cartão', valor: transferencias, explica: 'Dinheiro que foi para outra conta ou pagou a fatura do cartão da empresa.', lancamentos: [] },
    { id: 'abertura', tipo: 'grupo', rotulo: '(+) Saldo de abertura de conta', valor: abertura, explica: 'O saldo com que uma conta começou no sistema dentro do período.', lancamentos: [], saldos: abertas.map((conta) => ({ conta, saldo: conta.opening_balance })) },
    { id: 'variacao', tipo: 'subtotal', rotulo: 'Variação do caixa', valor: variacao, explica: 'Quanto o dinheiro em conta subiu ou desceu no período.', lancamentos: movimentos },
    { id: 'saldo-final', tipo: 'resultado', rotulo: 'Saldo no fim', valor: somaSaldos(saldosFinais), explica: 'O dinheiro nas contas da imobiliária no último dia do período.', lancamentos: [], saldos: saldosFinais },
  ]

  const contasDesde = caixa.length ? caixa.map((a) => a.opening_date).sort()[0] : null
  return { linhas, foraDoSaldo, contasDesde }
}
