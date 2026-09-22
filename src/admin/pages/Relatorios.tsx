import { useMemo, useState, type ReactNode } from 'react'
import { Banknote, BarChart3, Building2, CalendarRange, Download, Hourglass, Landmark, PieChart, Receipt, Scale, TrendingUp, Users } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Kpi } from '@/components/ui/Kpi'
import { Colunas } from '@/components/ui/Colunas'
import { Barra } from '@/components/ui/Barra'
import { Linha } from '@/components/ui/Lista'
import { Tabela, type ColunaTabela } from '@/components/ui/Tabela'
import { NumeroComOrigem, Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Button } from '@/components/ui/Button'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { EstadoVazio } from '@/components/ui/Estados'
import { computeKpis, dreGroupOf, lastNMonths, monthKey } from '@/lib/finance'
import { ACCOUNT_TYPE_LABEL, treasurySummary } from '@/lib/treasury'
import {
  brokerProduction,
  developmentResults,
  entradasPorMes,
  volumeDeVendas,
  type BrokerProduction,
  type DevelopmentResult,
  type SaleView,
} from '@/lib/sales'
import { composicaoDoVgl } from '@/lib/composicaoDoVgl'
import { agingDaCarteira, pontoDeEquilibrio, previsaoDeCaixa } from '@/lib/cfo'
import type { LinhaDemonstrativo } from '@/lib/linhasDaVenda'
import { formatCurrency, formatDate, formatMonthShort, formatMonthTiny, formatMonthYear, formatPercent } from '@/lib/format'
import type { DreGroup, Transaction } from '@/types'

type Regime = 'caixa' | 'competencia'

const FRASE_HEROI =
  'Da comissão saem os impostos sobre o faturamento, depois a comissão dos corretores e por fim a estrutura. O que resta é o resultado — não é saldo em conta, e retirada de sócio não está descontada dele.'

/*
 * RELATÓRIOS — a tela do DRE.
 *
 * Aqui mora a palavra "Resultado", e ela mora só aqui. O Início chamava de
 * "Resultado do mês" uma conta que tratava retirada de sócio como despesa,
 * enquanto esta tela manda retirada para distribuição de lucro e a deixa FORA
 * do lucro líquido. Eram dois números com o mesmo nome divergindo exatamente
 * pelo valor das retiradas. O Início passou a dizer "Sobrou no mês"; esta tela
 * ficou com "Resultado", e o número vem inteiro de `computeKpis` — esta tela
 * não soma nada por fora.
 *
 * Desenho (9.7, 7.6): PageLayout com Caixa/Competência nos filtros rápidos da
 * faixa (nunca colado no herói); herói ouro "Resultado do mês" que abre os
 * lançamentos; cartões com `Tabela` (DRE, doze meses, empreendimento,
 * corretor) e `Cartao.Lista` (saldo, categorias). Colunas, somas e textos são
 * os de antes; todo total continua abrindo no que o compõe até a venda.
 */
export function Relatorios() {
  const { transactions, accounts, transfers, mes, vendas, contacts, contatosComAcesso, receber, pagar, hoje } = useAdmin()
  const { abrir } = useComposicao()
  const [regime, setRegime] = useState<Regime>('caixa')

  const dataDoRegime = (t: Transaction): string | null => {
    if (regime === 'competencia') return t.competence_date
    if (t.status !== 'settled') return null
    return t.settled_date ?? t.competence_date
  }

  const doMes = useMemo(
    () => transactions.filter((t) => dataDoRegime(t)?.slice(0, 7) === monthKey(mes)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, mes, regime],
  )
  const kpis = useMemo(() => computeKpis(doMes, null), [doMes])

  const serie = useMemo(() => {
    const meses = lastNMonths(mes, 12)
    return meses.map((m) => {
      const doMes = transactions.filter((t) => dataDoRegime(t)?.slice(0, 7) === monthKey(m))
      return { mes: m, kpis: computeKpis(doMes, null) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, mes, regime])

  const tesouraria = useMemo(
    () => treasurySummary(accounts, transactions, transfers),
    [accounts, transactions, transfers],
  )
  /*
   * Só o dinheiro da imobiliária. Venda marcada como pessoa física (026) é do
   * Rafael: não tem lançamento no razão da empresa e não pode entrar no
   * resultado por empreendimento dela.
   */
  const vendasDaEmpresa = useMemo(() => vendas.filter((v) => !v.is_personal), [vendas])
  const porEmpreendimento = useMemo(() => developmentResults(vendasDaEmpresa), [vendasDaEmpresa])
  const porCorretor = useMemo(
    () => brokerProduction({ vendas, contacts, comAcesso: contatosComAcesso, year: null }),
    [vendas, contacts, contatosComAcesso],
  )

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of doMes) {
      const g = dreGroupOf(t)
      if (g === 'revenue') continue
      m.set(t.category, Math.round(((m.get(t.category) ?? 0) + t.amount) * 100) / 100)
    }
    return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
  }, [doMes])

  /*
   * AS CONTAS DE CFO (21/09/2026). Todas em src/lib/cfo.ts, todas lendo o que
   * já está gravado. Esta tela não recalcula imposto, comissão nem resultado.
   */
  // `r2` desta tela é declarado mais abaixo; aqui vale a mesma conta com nome
  // próprio, porque const não existe antes da linha que o declara.
  const cent = (n: number) => Math.round(n * 100) / 100

  const doze = useMemo(() => lastNMonths(mes, 12), [mes])
  const volume = useMemo(() => volumeDeVendas(vendasDaEmpresa, doze), [vendasDaEmpresa, doze])
  const entradas = useMemo(() => entradasPorMes(vendasDaEmpresa, doze), [vendasDaEmpresa, doze])

  /**
   * A economia da carteira: quanto de cada real de comissão sobra de fato.
   * As quatro deduções vêm abertas porque a margem abre a conta inteira —
   * nenhum número sem origem vale também para o percentual.
   */
  const carteira = useMemo(() => {
    const ativas = vendasDaEmpresa.filter((v) => v.status !== 'cancelada')
    const somar = (fn: (v: SaleView) => number) => cent(ativas.reduce((s, v) => s + fn(v), 0))
    const comissao = somar((v) => v.cascade.commission)
    const liquido = somar((v) => v.cascade.net)
    return {
      ativas,
      comissao,
      iss: somar((v) => v.cascade.iss),
      simples: somar((v) => v.cascade.simples),
      corretor: somar((v) => cent(v.cascade.broker - v.cascade.brokerAdjustment)),
      socio: somar((v) => v.cascade.owner),
      liquido,
      margem: comissao > 0 ? liquido / comissao : 0,
    }
  }, [vendasDaEmpresa])

  const proximos3 = useMemo(
    () => [0, 1, 2].map((i) => new Date(mes.getFullYear(), mes.getMonth() + i, 1)),
    [mes],
  )
  const caixa = useMemo(
    () => previsaoDeCaixa({ saldoHoje: tesouraria.available, receber, pagar, meses: proximos3, hoje }),
    [tesouraria.available, receber, pagar, proximos3, hoje],
  )

  /* O mês corrente fica fora: ele entra pela metade e puxa a média para baixo. */
  const mesesFechados = useMemo(() => doze.slice(0, 11), [doze])
  const equilibrio = useMemo(
    () =>
      pontoDeEquilibrio({
        transactions,
        meses: mesesFechados,
        margem: carteira.margem,
        entradasPorMes: entradas,
      }),
    [transactions, mesesFechados, carteira.margem, entradas],
  )

  const aging = useMemo(() => agingDaCarteira(vendas, hoje), [vendas, hoje])
  const carteiraAReceber = useMemo(() => cent(aging.reduce((s, f) => s + f.total, 0)), [aging])

  function exportarDre() {
    const linhas = [
      ['Mês', 'Receita', 'Impostos', 'Comissões', 'Despesas', 'Resultado'],
      ...serie.map((s) => [
        monthKey(s.mes),
        s.kpis.revenue,
        s.kpis.taxDeductions,
        s.kpis.costOfSale,
        s.kpis.operatingExpense + s.kpis.variableExpense + s.kpis.otherExpense,
        s.kpis.netProfit,
      ]),
    ]
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace('.', ',')}"`).join(';'))
      .join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `dre-12-meses-${monthKey(mes)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /*
   * Data nunca aparece sozinha neste sistema: sempre com o verbo do que
   * aconteceu. Num lançamento isso depende do lado do DRE — receita se recebe,
   * despesa se paga — e do status.
   */
  const frase = (t: Transaction) => {
    if (t.status === 'settled') {
      const d = t.settled_date ?? t.competence_date
      return `${dreGroupOf(t) === 'revenue' ? 'recebido' : 'pago'} em ${formatDate(d)}`
    }
    return `previsto para ${formatDate(t.due_date ?? t.competence_date)}`
  }

  /**
   * Transforma lançamentos na composição que a folha exibe. Receita entra
   * positiva e o resto negativo, porque é assim que a soma fecha com o
   * resultado — e `para` leva à venda que originou o lançamento (migração 008).
   */
  const compLancamentos = (txs: Transaction[]) =>
    txs.map((t) => ({
      id: t.id,
      titulo: t.description || t.category,
      meta: `${frase(t)} · ${t.category}`,
      valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
      para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
    }))

  /** O resultado de um mês da série, aberto nos lançamentos que o formam. */
  const abrirMes = (s: { mes: Date; kpis: ReturnType<typeof computeKpis> }) =>
    abrir({
      rotulo: 'Resultado',
      titulo: `Resultado de ${formatMonthYear(s.mes)}`,
      explica:
        'Receita de comissão menos imposto sobre o faturamento, comissão de corretor e estrutura. O total vem do DRE; a lista abaixo é o que o formou.',
      total: s.kpis.netProfit,
      itens: compLancamentos(
        transactions
          .filter((t) => dataDoRegime(t)?.slice(0, 7) === monthKey(s.mes))
          .filter((t) => dreGroupOf(t) !== 'withdrawal')
          .sort((a, b) => (dataDoRegime(a) ?? '').localeCompare(dataDoRegime(b) ?? '')),
      ),
      nota: 'Retirada de sócio não aparece aqui: ela é remuneração do capital e sai DEPOIS do resultado, nunca antes.',
      vazio: 'Nenhum lançamento neste mês.',
    })

  const r2 = (v: number) => Math.round(v * 100) / 100

  /** As vendas de um empreendimento — a mesma chave que `developmentResults` usa. */
  const vendasDoEmpreendimento = (d: DevelopmentResult) =>
    vendasDaEmpresa.filter((v) => v.status !== 'cancelada' && (v.cost_center_id ?? '—') === (d.id ?? '—'))

  /** As vendas de um corretor — a mesma regra que `brokerProduction` usa. */
  const vendasDoCorretor = (p: BrokerProduction) =>
    vendas.filter((v) => v.status !== 'cancelada' && v.broker_id === p.contact.id && !v.is_personal)

  const metaDaVenda = (titulo: string | null, data: string) =>
    [titulo, `vendida em ${formatDate(data)}`].filter(Boolean).join(' · ')

  /** A produção de um corretor, aberta nas vendas dele. */
  function abrirCorretor(p: BrokerProduction) {
    abrir({
      rotulo: 'Comissão',
      titulo: `Comissão de ${p.contact.name}`,
      explica:
        'A comissão contratada do corretor nas vendas ativas dele — o que já foi pago mais o que ainda falta.',
      total: p.commissionTotal,
      itens: vendas
        .filter((v) => v.status !== 'cancelada' && v.broker_id === p.contact.id)
        .map((v) => ({
          id: v.id,
          titulo: v.title,
          meta: metaDaVenda(v.client_name, v.sale_date),
          valor: r2(v.brokerPaid + v.brokerToPay),
          para: `/vendas/${v.id}`,
        })),
      nota: 'Comissão de parcela que a construtora ainda não pagou não é dívida hoje: ela só é liberada quando o dinheiro entra.',
      vazio: 'Nenhuma venda ativa para este corretor.',
    })
  }

  /*
   * NENHUM NÚMERO SEM ORIGEM, TAMBÉM AQUI (22/09/2026).
   *
   * Ele pediu que todo número desta tela abra no que o compõe — "por exemplo
   * relatório por empreendimento, quando clica no empreendimento aparece as
   * vendas dele". Os abridores ficam todos juntos, acima do JSX, porque a
   * regra é a mesma em toda tabela: o total é o de cima, a lista é o que o
   * formou, e cada item leva à venda ou ao lançamento de origem.
   */

  const periodoDoze = `nos 12 meses até ${formatMonthYear(mes).toLowerCase()}`
  const chavesDoze = useMemo(() => doze.map(monthKey), [doze])
  const vendasDoPeriodo = useMemo(
    () => vendasDaEmpresa.filter((v) => chavesDoze.includes(v.sale_date.slice(0, 7))),
    [vendasDaEmpresa, chavesDoze],
  )

  /** Vendas viram itens; o valor é o que a tela pediu para somar. */
  const itensDeVendas = (lista: SaleView[], valorDe: (v: SaleView) => number) =>
    lista.map((v) => ({
      id: v.id,
      titulo: v.title,
      meta: metaDaVenda(v.client_name, v.sale_date),
      valor: valorDe(v),
      para: `/vendas/${v.id}`,
    }))

  const abrirVgv = () =>
    abrir({
      rotulo: 'VGV',
      titulo: `VGV ${periodoDoze}`,
      explica:
        'O valor dos imóveis vendidos no período — o tamanho do que a imobiliária colocou na rua. Não é receita dela: a receita é a comissão, que é uma fração disso.',
      total: volume.vgv,
      itens: itensDeVendas(
        vendasDoPeriodo.filter((v) => v.property_value != null),
        (v) => v.property_value ?? 0,
      ),
      nota:
        volume.semValor > 0
          ? `${volume.semValor} ${volume.semValor === 1 ? 'venda ficou' : 'vendas ficaram'} de fora: o valor do imóvel não foi informado, e inventar um VGV seria pior do que não ter.`
          : undefined,
      vazio: 'Nenhuma venda com valor informado no período.',
    })

  /* A nota do VGL diz o que saiu — o número já não é "o VGV sem distrato". */
  const notaDoVgl =
    [
      volume.descontoParceria > 0 ? 'sem a parte do parceiro' : null,
      volume.descontoNota > 0 ? 'sem a nota fiscal' : null,
      volume.distratos > 0
        ? `sem ${volume.distratos === 1 ? 'o distrato' : `os ${volume.distratos} distratos`}`
        : null,
    ]
      .filter(Boolean)
      .join(' e ') || 'nada a descontar: igual ao VGV'

  const abrirVgl = () =>
    abrir(
      composicaoDoVgl({
        volume,
        vendas: vendasDaEmpresa,
        chavesDosMeses: chavesDoze,
        periodo: periodoDoze,
      }),
    )

  const abrirComissaoContratada = () =>
    abrir({
      rotulo: 'Comissão contratada',
      titulo: 'Comissão contratada da carteira',
      explica:
        'A comissão da imobiliária em todas as vendas ativas, recebida e a receber. Em parceria, só a parte dela.',
      total: carteira.comissao,
      itens: itensDeVendas(carteira.ativas, (v) => v.cascade.commission),
      vazio: 'Nenhuma venda ativa.',
    })

  const abrirMargem = () => {
    const linhas: LinhaDemonstrativo[] = [
      { chave: 'bruto', rotulo: 'Comissão contratada', sinal: '+', valor: carteira.comissao },
    ]
    if (carteira.iss > 0)
      linhas.push({ chave: 'iss', rotulo: 'ISS retido pelas construtoras', sinal: '−', valor: carteira.iss })
    if (carteira.simples > 0)
      linhas.push({ chave: 'simples', rotulo: 'Simples Nacional', sinal: '−', valor: carteira.simples })
    if (carteira.corretor > 0)
      linhas.push({ chave: 'corretor', rotulo: 'Comissão dos corretores', sinal: '−', valor: carteira.corretor })
    if (carteira.socio > 0)
      linhas.push({ chave: 'socio', rotulo: 'Distribuição ao sócio', sinal: '−', valor: carteira.socio })
    linhas.push({ chave: 'fica', rotulo: 'Fica para a imobiliária', sinal: '=', valor: carteira.liquido })
    abrir({
      rotulo: 'Fica para a imobiliária',
      titulo: `A margem da carteira · ${formatPercent(carteira.margem, 0)}`,
      explica:
        'De cada real de comissão contratada, quanto sobra depois do imposto, do corretor e da parte do sócio. A estrutura da imobiliária ainda sai daqui.',
      total: carteira.liquido,
      linhas,
      itens: itensDeVendas(carteira.ativas, (v) => v.cascade.net),
      vazio: 'Nenhuma venda ativa.',
    })
  }

  /** Os lançamentos de um grupo do DRE, num mês. */
  const lancamentosDe = (grupos: DreGroup[], quando: Date) =>
    transactions
      .filter((t) => dataDoRegime(t)?.slice(0, 7) === monthKey(quando))
      .filter((t) => grupos.includes(dreGroupOf(t)))
      .sort((a, b) => (dataDoRegime(a) ?? '').localeCompare(dataDoRegime(b) ?? ''))

  const abrirGrupo = (params: {
    rotulo: string
    grupos: DreGroup[]
    quando: Date
    total: number
    explica: string
  }) =>
    abrir({
      rotulo: params.rotulo,
      titulo: `${params.rotulo} · ${formatMonthYear(params.quando)}`,
      explica: params.explica,
      total: params.total,
      itens: compLancamentos(lancamentosDe(params.grupos, params.quando)),
      vazio: 'Nenhum lançamento neste mês.',
    })

  /* As mesmas linhas e os mesmos números da tabela de antes, na mesma ordem. */
  const linhasDre: LinhaDre[] = [
    { id: 'receita', rotulo: 'Receita de comissões', valor: kpis.revenue, grupos: ['revenue'], explica: 'As comissões que a imobiliária faturou no mês, pelo regime escolhido acima.' },
    { id: 'impostos', rotulo: '(−) Impostos sobre o faturamento', valor: -kpis.taxDeductions, grupos: ['tax'], explica: 'Simples e ISS sobre a comissão. Não é despesa da estrutura: é dedução da receita.' },
    { id: 'liquida', rotulo: 'Receita líquida', valor: kpis.netRevenue, total: true, grupos: ['revenue', 'tax'], explica: 'A receita depois do imposto sobre o faturamento.' },
    { id: 'comissoes', rotulo: '(−) Comissões de corretores', valor: -kpis.costOfSale, grupos: ['cost_of_sale'], explica: 'O custo direto da venda: a parte do corretor. Só existe quando há venda.' },
    { id: 'bruto', rotulo: 'Lucro bruto', valor: kpis.grossProfit, total: true, grupos: ['revenue', 'tax', 'cost_of_sale'], explica: 'Receita líquida menos a comissão dos corretores — o que sobra para pagar a estrutura.' },
    { id: 'fixas', rotulo: '(−) Despesas fixas', valor: -kpis.operatingExpense, grupos: ['operating_expense'], explica: 'A estrutura: aluguel, contabilidade, ferramentas, pró-labore. Existe com ou sem venda.' },
    { id: 'variaveis', rotulo: '(−) Despesas variáveis', valor: -(kpis.variableExpense + kpis.otherExpense), grupos: ['variable_expense'], explica: 'Marketing, comercial e o que não se encaixa na estrutura.' },
  ]

  type Mes = (typeof serie)[number]
  const serieVisivel = serie.filter(
    (s) => s.kpis.revenue > 0 || s.kpis.totalExpense > 0 || s.kpis.taxDeductions > 0,
  )
  const despesasDe = (s: Mes) => s.kpis.operatingExpense + s.kpis.variableExpense + s.kpis.otherExpense

  /*
   * Cada célula dos doze meses abre nos lançamentos daquele mês e daquele
   * grupo — não só o resultado, como antes. Mês sem nada continua traço:
   * botão que abre folha vazia é promessa quebrada.
   */
  const celulaDoze = (
    s: Mes,
    rotulo: string,
    valor: number,
    grupos: DreGroup[],
    explica: string,
  ) =>
    valor === 0 ? (
      <Traco />
    ) : (
      <ValorComOrigem
        valor={valor}
        posto="linha"
        estado={valor < 0 ? 'negativo' : undefined}
        rotuloAcessivel={`Ver ${rotulo.toLowerCase()} de ${formatMonthYear(s.mes)}`}
        aoAbrir={() => abrirGrupo({ rotulo, grupos, quando: s.mes, total: valor, explica })}
      />
    )

  const colunasDoze: ColunaTabela<Mes>[] = [
    { id: 'mes', rotulo: 'Mês', celula: (s) => formatMonthShort(s.mes) },
    {
      id: 'receita',
      rotulo: 'Receita',
      numerica: true,
      celula: (s) =>
        celulaDoze(s, 'Receita', s.kpis.revenue, ['revenue'], 'As comissões faturadas no mês.'),
    },
    {
      id: 'impostos',
      rotulo: 'Impostos',
      numerica: true,
      celula: (s) =>
        celulaDoze(s, 'Impostos', -s.kpis.taxDeductions, ['tax'], 'Simples e ISS sobre a comissão do mês.'),
    },
    {
      id: 'comissoes',
      rotulo: 'Comissões',
      numerica: true,
      celula: (s) =>
        celulaDoze(s, 'Comissões', -s.kpis.costOfSale, ['cost_of_sale'], 'A parte dos corretores nas vendas do mês.'),
    },
    {
      id: 'despesas',
      rotulo: 'Despesas',
      numerica: true,
      celula: (s) =>
        celulaDoze(
          s,
          'Despesas',
          -despesasDe(s),
          ['operating_expense', 'variable_expense'],
          'Estrutura e despesa variável do mês. Retirada de sócio não entra.',
        ),
    },
    {
      id: 'resultado',
      rotulo: 'Resultado',
      numerica: true,
      celula: (s) =>
        s.kpis.netProfit < 0 ? (
          <ValorComOrigem
            valor={s.kpis.netProfit}
            posto="linha"
            estado="negativo"
            rotuloAcessivel={`Ver de onde vem o resultado de ${formatMonthYear(s.mes)}`}
            aoAbrir={() => abrirMes(s)}
          />
        ) : (
          <ValorComOrigem
            valor={s.kpis.netProfit}
            posto="linha"
            forte
            rotuloAcessivel={`Ver de onde vem o resultado de ${formatMonthYear(s.mes)}`}
            aoAbrir={() => abrirMes(s)}
          />
        ),
    },
  ]

  return (
    <PageLayout
      subtitulo={
        <>
          Resultado do mês{' '}
          <ValorComOrigem
            valor={kpis.netProfit}
            posto="fato"
            rotuloAcessivel={`Ver de onde vem o resultado de ${formatMonthYear(mes)}`}
            aoAbrir={() => abrirMes({ mes, kpis })}
          />
        </>
      }
      faixa={
        <FiltrosRapidos
          rotuloAcessivel="Regime"
          ativo={regime}
          aoMudar={setRegime}
          filtros={[
            { id: 'caixa', rotulo: 'Caixa', dica: 'Conta no mês em que o dinheiro se moveu.' },
            { id: 'competencia', rotulo: 'Competência', dica: 'Conta no mês da venda, mesmo que o dinheiro entre depois.' },
          ]}
        />
      }
    >
      {/*
       * UM herói: "Resultado do mês", o mesmo número de `computeKpis` que fecha
       * o DRE logo abaixo. Abre nos lançamentos que o formam (a mesma
       * composição que a linha do mês abre em "Doze meses").
       */}
      {kpis.netProfit < 0 ? (
        <Heroi
          variante="ouro"
          estado="negativo"
          rotulo="Resultado do mês"
          valor={kpis.netProfit}
          rotuloAcessivel={`Ver de onde vem o resultado de ${formatMonthYear(mes)}`}
          aoAbrir={() => abrirMes({ mes, kpis })}
          frase={FRASE_HEROI}
        />
      ) : (
        <Heroi
          variante="ouro"
          rotulo="Resultado do mês"
          valor={kpis.netProfit}
          rotuloAcessivel={`Ver de onde vem o resultado de ${formatMonthYear(mes)}`}
          aoAbrir={() => abrirMes({ mes, kpis })}
          frase={FRASE_HEROI}
        />
      )}

      {/*
       * OS DESTAQUES (21/09/2026). Quatro números que resumem o negócio antes
       * de qualquer tabela: o tamanho do que foi vendido (VGV), o que sobrou
       * firme (VGL), a comissão contratada da carteira e a margem — quanto de
       * cada real de comissão fica de fato com a imobiliária.
       */}
      <div className="grid gap-bloco sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="VGV · 12 meses"
          icone={Building2}
          tom="neutro"
          valor={volume.vgv}
          nota={`${volume.vendas} ${volume.vendas === 1 ? 'venda' : 'vendas'} no período${volume.semValor > 0 ? ` · ${volume.semValor} sem valor informado` : ''}`}
          aoClicar={abrirVgv}
        />
        <Kpi
          rotulo="VGL · 12 meses"
          icone={Scale}
          tom="marca"
          valor={volume.vgl}
          nota={notaDoVgl}
          aoClicar={abrirVgl}
        />
        <Kpi
          rotulo="Comissão contratada"
          icone={Banknote}
          tom="info"
          valor={carteira.comissao}
          nota="todas as vendas ativas, recebido e a receber"
          aoClicar={abrirComissaoContratada}
        />
        <Kpi
          rotulo="Margem da imobiliária"
          icone={PieChart}
          tom="sucesso"
          valor={0}
          texto={formatPercent(carteira.margem, 0)}
          nota={`${formatCurrency(carteira.liquido)} sobram depois do imposto e do corretor`}
          aoClicar={abrirMargem}
        />
      </div>

      {/* ------------------------------------------------ previsão de caixa */}
      <Cartao>
        <Cartao.Cabecalho
          titulo="Previsão de caixa"
          icone={TrendingUp}
          meta={`Três meses, partindo de ${formatCurrency(tesouraria.available)} em conta`}
        />
        <Cartao.Corpo>
          <Colunas
            tom={caixa.menorSaldo && caixa.menorSaldo.saldo < 0 ? 'risco' : 'sucesso'}
            itens={caixa.meses.map((m) => ({
              rotulo: formatMonthTiny(m.mes),
              valor: Math.max(m.saldo, 0),
              descricao: `${formatMonthYear(m.mes)}: entra ${formatCurrency(m.entra)}, sai ${formatCurrency(m.sai)}, saldo projetado ${formatCurrency(m.saldo)}`,
              ativo: monthKey(m.mes) === monthKey(mes),
            }))}
            rotuloAcessivel={`Saldo projetado mês a mês nos próximos três meses, partindo de ${formatCurrency(tesouraria.available)}.`}
          />
        </Cartao.Corpo>
        <Tabela
          rotuloAcessivel="Previsão de caixa dos próximos três meses"
          linhas={caixa.meses}
          chave={(m) => monthKey(m.mes)}
          colunas={[
            { id: 'mes', rotulo: 'Mês', celula: (m) => <Nome nome={formatMonthShort(m.mes)} /> },
            {
              id: 'entra',
              rotulo: 'Entra',
              numerica: true,
              celula: (m) => (
                <ValorComOrigem
                  valor={m.entra}
                  posto="linha"
                  rotuloAcessivel={`Ver o que entra em ${formatMonthYear(m.mes)}`}
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Entra',
                      titulo: `O que entra em ${formatMonthYear(m.mes)}`,
                      explica: 'Parcelas de comissão previstas para este mês. O vencido de meses anteriores entra no primeiro mês da janela.',
                      total: m.entra,
                      itens: m.entradas.map((i) => ({
                        id: i.tx.id,
                        titulo: i.label,
                        meta: i.sale?.development ?? i.tx.category,
                        valor: i.amount,
                        para: i.sale ? `/vendas/${i.sale.id}` : undefined,
                      })),
                      vazio: 'Nada previsto para entrar neste mês.',
                    })
                  }
                />
              ),
            },
            {
              id: 'sai',
              rotulo: 'Sai',
              numerica: true,
              celula: (m) => (
                <ValorComOrigem
                  valor={m.sai}
                  posto="linha"
                  rotuloAcessivel={`Ver o que sai em ${formatMonthYear(m.mes)}`}
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Sai',
                      titulo: `O que sai em ${formatMonthYear(m.mes)}`,
                      explica: 'Comissão de corretor, imposto e despesa com vencimento neste mês.',
                      total: m.sai,
                      itens: m.saidas.map((i) => ({
                        id: i.tx.id,
                        titulo: i.label,
                        meta: i.sale?.development ?? i.tx.category,
                        valor: i.amount,
                        para: i.sale ? `/vendas/${i.sale.id}` : undefined,
                      })),
                      vazio: 'Nada previsto para sair neste mês.',
                    })
                  }
                />
              ),
            },
            {
              id: 'saldo',
              rotulo: 'Saldo projetado',
              numerica: true,
              celula: (m) =>
                m.saldo < 0 ? (
                  <Valor valor={m.saldo} posto="linha" estado="negativo" />
                ) : (
                  <Valor valor={m.saldo} posto="linha" forte />
                ),
            },
          ]}
        />
        <Cartao.Rodape>
          <p className="max-w-[72ch]">
            {caixa.menorSaldo && caixa.menorSaldo.saldo < 0 ? (
              <>
                Atenção: a projeção fica negativa em {formatMonthYear(caixa.menorSaldo.mes).toLowerCase()} (
                <Valor valor={caixa.menorSaldo.saldo} posto="fato" estado="negativo" />
                ). É o mês para antecipar recebimento ou adiar saída.
              </>
            ) : (
              <>
                O saldo projetado não fica negativo nos três meses. A conta parte do que existe hoje em conta e usa as
                datas prometidas em A receber e A pagar — se uma construtora atrasar, o mês dela muda.
              </>
            )}
          </p>
        </Cartao.Rodape>
      </Cartao>

      {/* ------------------------------------------------ ponto de equilíbrio */}
      {equilibrio.custoFixo > 0 && (
        <Cartao>
          <Cartao.Cabecalho
            titulo="Ponto de equilíbrio"
            icone={Scale}
            meta={`Estrutura média de ${formatCurrency(equilibrio.custoFixo)} por mês`}
          />
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="Ponto de equilíbrio">
            <Linha
              titulo="Estrutura por mês"
              meta={`média dos ${equilibrio.mesesUsados} ${equilibrio.mesesUsados === 1 ? 'mês' : 'meses'} com despesa lançada — aluguel, contabilidade, ferramentas`}
              valor={
                <ValorComOrigem
                  valor={equilibrio.custoFixo}
                  posto="linha"
                  rotuloAcessivel="Ver os meses que formam a estrutura média"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Estrutura por mês',
                      titulo: 'A estrutura, mês a mês',
                      explica:
                        'Despesa que existe com ou sem venda. O número acima é a média destes meses; imposto e comissão de corretor não entram aqui.',
                      total: equilibrio.custoFixo,
                      itens: equilibrio.mesesDaEstrutura.map((m) => ({
                        id: m.chave,
                        titulo: formatMonthYear(new Date(`${m.chave}-02T00:00:00`)),
                        meta: 'estrutura lançada no mês',
                        valor: m.total,
                      })),
                      nota: 'A lista mostra cada mês inteiro; o número acima é a média deles.',
                      vazio: 'Nenhuma despesa de estrutura lançada nestes meses.',
                    })
                  }
                />
              }
            />
            <Linha
              titulo="Comissão que precisa entrar"
              meta={`com margem de ${formatPercent(equilibrio.margem, 0)}, cada real de estrutura exige ${formatCurrency(equilibrio.margem > 0 ? 1 / equilibrio.margem : 0)} de comissão`}
              valor={<Valor valor={equilibrio.comissaoNecessaria} posto="linha" forte />}
            />
            <Linha
              titulo="Comissão que entrou, na média"
              meta={`média dos últimos ${mesesFechados.length} meses fechados · ${equilibrio.mesesQueCobriram} ${equilibrio.mesesQueCobriram === 1 ? 'mês cobriu' : 'meses cobriram'} a estrutura`}
              valor={
                <ValorComOrigem
                  valor={equilibrio.comissaoMedia}
                  posto="linha"
                  estado={equilibrio.comissaoMedia >= equilibrio.comissaoNecessaria ? 'recebido' : 'vencido'}
                  rotuloAcessivel="Ver os meses que formam a comissão média"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Comissão que entrou, na média',
                      titulo: 'A comissão que entrou, mês a mês',
                      explica:
                        'A comissão bruta que a construtora de fato pagou em cada mês fechado da janela. O número acima é a média deles.',
                      total: equilibrio.comissaoMedia,
                      itens: entradas
                        .filter((e) => mesesFechados.some((m) => monthKey(m) === monthKey(e.mes)))
                        .map((e) => ({
                          id: monthKey(e.mes),
                          titulo: formatMonthYear(e.mes),
                          meta:
                            e.parcelas === 0
                              ? 'nenhuma parcela recebida'
                              : `${e.parcelas} ${e.parcelas === 1 ? 'parcela recebida' : 'parcelas recebidas'}`,
                          valor: e.total,
                        })),
                      nota: 'A lista mostra cada mês inteiro; o número acima é a média deles.',
                      vazio: 'Nenhuma comissão recebida nestes meses.',
                    })
                  }
                />
              }
            />
          </Cartao.Lista>
          <Cartao.Rodape>
            <p className="max-w-[72ch]">
              {equilibrio.comissaoMedia >= equilibrio.comissaoNecessaria ? (
                <>
                  Na média, a comissão que entra cobre a estrutura. Sobra{' '}
                  <Valor valor={equilibrio.comissaoMedia - equilibrio.comissaoNecessaria} posto="fato" /> de folga por
                  mês — é dela que sai reserva, investimento e retirada.
                </>
              ) : (
                <>
                  Na média, falta{' '}
                  <Valor valor={equilibrio.comissaoNecessaria - equilibrio.comissaoMedia} posto="fato" /> de comissão
                  por mês para cobrir a estrutura. Comissão é receita irregular: o que importa é se o ano fecha, mas mês abaixo da
                  linha consome reserva.
                </>
              )}{' '}
              Imposto e comissão de corretor não entram na estrutura — eles só existem quando há venda, e já estão
              descontados na margem.
            </p>
          </Cartao.Rodape>
        </Cartao>
      )}

      {/* ------------------------------------------------ aging da carteira */}
      {carteiraAReceber > 0 && (
        <Cartao>
          <Cartao.Cabecalho
            titulo="Quando a carteira vira dinheiro"
            icone={Hourglass}
            meta={`${formatCurrency(carteiraAReceber)} a receber, por distância`}
          />
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="Aging da carteira">
            {aging
              .filter((f) => f.total > 0)
              .map((f) => (
                <Linha
                  key={f.rotulo}
                  titulo={f.rotulo}
                  meta={
                    <span className="flex flex-col gap-2">
                      <span>
                        {Math.round(f.fatia * 100)}% da carteira · {f.parcelas}{' '}
                        {f.parcelas === 1 ? 'parcela' : 'parcelas'}
                      </span>
                      <Barra
                        animarEntrada={false}
                        valor={f.fatia}
                        tom={f.rotulo === 'Em atraso' ? 'atencao' : f.ate === null ? 'neutro' : 'info'}
                        rotuloAcessivel={`${f.rotulo}: ${Math.round(f.fatia * 100)}% da carteira.`}
                      />
                    </span>
                  }
                  valor={
                    <ValorComOrigem
                      valor={f.total}
                      posto="linha"
                      previsto
                      rotuloAcessivel={`Ver as ${f.parcelas} parcelas de ${f.rotulo.toLowerCase()}`}
                      aoAbrir={() =>
                        abrir({
                          rotulo: f.rotulo,
                          titulo: `Carteira · ${f.rotulo}`,
                          explica:
                            f.rotulo === 'Em atraso'
                              ? 'Parcelas cuja data prometida já passou e a construtora ainda não pagou. Não é dívida da imobiliária: é cobrança dela.'
                              : 'Parcelas de comissão previstas para esta distância. Venda assinada, dinheiro que ainda não existe.',
                          total: f.total,
                          itens: f.itens.map((i) => ({
                            id: i.installmentId,
                            titulo: i.titulo,
                            meta: [i.empreendimento, `prevista para ${formatDate(i.data)}`]
                              .filter(Boolean)
                              .join(' · '),
                            valor: i.valor,
                            para: `/vendas/${i.saleId}`,
                            parcelaId: i.installmentId,
                          })),
                          vazio: 'Nenhuma parcela nesta faixa.',
                        })
                      }
                    />
                  }
                />
              ))}
          </Cartao.Lista>
          <Cartao.Rodape>
            <p className="max-w-[72ch]">
              Carteira longa não é defeito — parcela de 2027 é venda assinada. Mas é caixa que não existe: quem decide
              contratar, comprar ou antecipar precisa saber quanto está perto e quanto está longe.
            </p>
          </Cartao.Rodape>
        </Cartao>
      )}

      <Cartao>
        <Cartao.Cabecalho
          titulo="Como o resultado se forma"
          icone={BarChart3}
          meta={
            regime === 'caixa'
              ? 'Caixa: conta no mês em que o dinheiro se moveu.'
              : 'Competência: conta no mês da venda, mesmo que o dinheiro entre depois.'
          }
        />
        <Tabela
          rotuloAcessivel={`Demonstração do resultado de ${formatMonthYear(mes)}`}
          linhas={linhasDre}
          chave={(l) => l.id}
          colunas={[
            {
              id: 'conta',
              rotulo: 'Conta',
              celula: (l) => <span className={l.total ? 'font-semibold text-t1' : 'text-t2'}>{l.rotulo}</span>,
              total: 'Resultado',
            },
            {
              id: 'mes',
              rotulo: 'No mês',
              numerica: true,
              /* Cada linha do DRE abre nos lançamentos que a formaram. */
              celula: (l) => (
                <ValorComOrigem
                  valor={l.valor}
                  posto="linha"
                  forte={l.total}
                  estado={l.valor < 0 ? 'negativo' : undefined}
                  rotuloAcessivel={`Ver os lançamentos de ${l.rotulo.replace('(−) ', '')} em ${formatMonthYear(mes)}`}
                  aoAbrir={() =>
                    abrirGrupo({
                      rotulo: l.rotulo.replace('(−) ', ''),
                      grupos: l.grupos,
                      quando: mes,
                      total: l.valor,
                      explica: l.explica,
                    })
                  }
                />
              ),
              total:
                kpis.netProfit < 0 ? (
                  <Valor valor={kpis.netProfit} posto="destaque" estado="negativo" />
                ) : (
                  <Valor valor={kpis.netProfit} posto="destaque" />
                ),
            },
          ]}
        />
        {(kpis.revenue > 0 || kpis.profitDistribution > 0) && (
          <Cartao.Rodape>
            <span>
              {kpis.profitDistribution > 0 &&
                `Retiradas do sócio no mês: ${formatCurrency(kpis.profitDistribution)}. Saem depois do resultado — são remuneração do capital, não custo da operação.`}
            </span>
            {kpis.revenue > 0 && <span>margem {formatPercent(kpis.netMargin, 0)}</span>}
          </Cartao.Rodape>
        )}
      </Cartao>
      {/* O saldo em conta continua nesta tela, como cartão normal, abaixo do DRE. */}
      {tesouraria.balances.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho titulo="Saldo em conta" icone={Landmark} />
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="Saldo em conta">
            {tesouraria.balances.map((b) => (
              <Linha
                key={b.account.id}
                titulo={b.account.name}
                meta={ACCOUNT_TYPE_LABEL[b.account.type]}
                valor={
                  <ValorComOrigem
                    valor={b.balance}
                    posto="linha"
                    estado={b.balance < 0 ? 'negativo' : undefined}
                    rotuloAcessivel={`Ver a movimentação de ${b.account.name}`}
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Saldo',
                        titulo: b.account.name,
                        explica:
                          'O que já se moveu nesta conta, do mais recente para o mais antigo. O saldo parte do saldo de abertura e soma tudo isto.',
                        total: b.balance,
                        itens: transactions
                          .filter((t) => t.account_id === b.account.id && t.status === 'settled')
                          .sort((x, y) =>
                            (y.settled_date ?? y.competence_date).localeCompare(x.settled_date ?? x.competence_date),
                          )
                          .slice(0, 60)
                          .map((t) => ({
                            id: t.id,
                            titulo: t.description || t.category,
                            meta: `${frase(t)} · ${t.category}`,
                            valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
                            para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
                          })),
                        nota: 'Os 60 movimentos mais recentes. O saldo acima conta todos, mais o saldo de abertura e as transferências.',
                        vazio: 'Nenhum movimento liquidado nesta conta.',
                      })
                    }
                  />
                }
              />
            ))}
          </Cartao.Lista>
          <Cartao.Rodape>
            <span className="text-texto-titulo font-semibold text-t1">Disponível</span>
            <Valor valor={tesouraria.available} posto="destaque" />
            {tesouraria.unassignedCount > 0 && (
              <span className="basis-full">
                {tesouraria.unassignedCount} lançamento(s) liquidado(s) sem conta, somando{' '}
                <Valor valor={tesouraria.unassigned} posto="fato" />. Ficam fora do saldo das contas de propósito —
                incluir daria um número que não bate com banco nenhum.
              </span>
            )}
          </Cartao.Rodape>
        </Cartao>
      )}

      <Cartao>
        <Cartao.Cabecalho
          titulo="Doze meses"
          icone={CalendarRange}
          extra={
            <Button variant="secundario" size="sm" icone={Download} onClick={exportarDre}>
              CSV
            </Button>
          }
        />
        <Tabela
          rotuloAcessivel="Resultado dos últimos doze meses"
          linhas={serieVisivel}
          chave={(s) => monthKey(s.mes)}
          colunas={colunasDoze}
        />
      </Cartao>
      {porEmpreendimento.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho
            titulo="Por empreendimento"
            icone={Building2}
            meta="Qual produto dá lucro de verdade. Considera todas as vendas, não só o mês."
          />
          <Tabela
            rotuloAcessivel="Resultado por empreendimento"
            linhas={porEmpreendimento}
            chave={(d) => d.id ?? 'sem'}
            colunas={[
              { id: 'nome', rotulo: 'Empreendimento', celula: (d) => <Nome nome={d.name} meta={d.developer} /> },
              {
                id: 'vendas',
                rotulo: 'Vendas',
                numerica: true,
                /* O que ele pediu em 22/09: clicar no empreendimento e ver as vendas dele. */
                celula: (d) => (
                  <NumeroComOrigem
                    texto={String(d.sales)}
                    rotuloAcessivel={`Ver as ${d.sales} vendas de ${d.name}`}
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Comissão',
                        titulo: `As vendas de ${d.name}`,
                        explica:
                          'Todas as vendas ativas deste empreendimento. O valor ao lado de cada uma é a comissão da imobiliária nela.',
                        total: d.commission,
                        itens: itensDeVendas(vendasDoEmpreendimento(d), (v) => v.cascade.commission),
                        vazio: 'Nenhuma venda ativa neste empreendimento.',
                      })
                    }
                  />
                ),
              },
              {
                id: 'vgv',
                rotulo: 'VGV',
                numerica: true,
                celula: (d) =>
                  d.vgv > 0 ? (
                    <ValorComOrigem
                      valor={d.vgv}
                      posto="linha"
                      rotuloAcessivel={`Ver o VGV de ${d.name}, venda por venda`}
                      aoAbrir={() =>
                        abrir({
                          rotulo: 'VGV',
                          titulo: `VGV de ${d.name}`,
                          explica:
                            'O valor dos imóveis vendidos neste empreendimento. Não é receita da imobiliária: dele sai a comissão.',
                          total: d.vgv,
                          itens: itensDeVendas(
                            vendasDoEmpreendimento(d).filter((v) => v.property_value != null),
                            (v) => v.property_value ?? 0,
                          ),
                          nota:
                            d.salesWithoutVgv > 0
                              ? `${d.salesWithoutVgv} ${d.salesWithoutVgv === 1 ? 'venda ficou' : 'vendas ficaram'} de fora: o valor do imóvel não foi informado.`
                              : undefined,
                          vazio: 'Nenhuma venda com valor informado.',
                        })
                      }
                    />
                  ) : (
                    <span className="text-nota text-t4">não informado</span>
                  ),
              },
              {
                id: 'comissao',
                rotulo: 'Comissão',
                numerica: true,
                /* Nenhum número sem origem: abre nas vendas, e cada uma leva à ficha. */
                celula: (d) => (
                  <ValorComOrigem
                    valor={d.commission}
                    posto="linha"
                    rotuloAcessivel={`Ver as vendas que formam a comissão de ${d.name}`}
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Comissão',
                        titulo: `Comissão de ${d.name}`,
                        explica:
                          'A comissão contratada da imobiliária em todas as vendas ativas deste empreendimento, recebida ou não.',
                        total: d.commission,
                        itens: vendasDoEmpreendimento(d).map((v) => ({
                          id: v.id,
                          titulo: v.title,
                          meta: metaDaVenda(v.client_name, v.sale_date),
                          valor: v.cascade.commission,
                          para: `/vendas/${v.id}`,
                        })),
                        vazio: 'Nenhuma venda ativa neste empreendimento.',
                      })
                    }
                  />
                ),
              },
              {
                id: 'limpo',
                rotulo: 'Fica limpo',
                numerica: true,
                celula: (d) => (
                  <ValorComOrigem
                    valor={d.net}
                    posto="linha"
                    forte
                    rotuloAcessivel={`Ver as vendas que formam o que fica limpo em ${d.name}`}
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Fica limpo',
                        titulo: `O que fica limpo em ${d.name}`,
                        explica:
                          'A comissão depois do ISS retido, do Simples, da comissão do corretor e da parte do sócio. É o que sobra para a imobiliária.',
                        total: d.net,
                        itens: vendasDoEmpreendimento(d).map((v) => ({
                          id: v.id,
                          titulo: v.title,
                          meta: metaDaVenda(v.client_name, v.sale_date),
                          valor: v.cascade.net,
                          para: `/vendas/${v.id}`,
                        })),
                        vazio: 'Nenhuma venda ativa neste empreendimento.',
                      })
                    }
                  />
                ),
              },
              {
                id: 'margem',
                rotulo: 'Margem',
                numerica: true,
                celula: (d) => (
                  <NumeroComOrigem
                    texto={formatPercent(d.margin, 0)}
                    rotuloAcessivel={`Ver a conta da margem de ${d.name}`}
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Fica limpo',
                        titulo: `A margem de ${d.name} · ${formatPercent(d.margin, 0)}`,
                        explica:
                          'Quanto de cada real de comissão deste empreendimento sobra depois do imposto, do corretor e da parte do sócio.',
                        total: d.net,
                        linhas: [
                          { chave: 'bruto', rotulo: 'Comissão', sinal: '+', valor: d.commission },
                          ...(d.tax > 0
                            ? [{ chave: 'impostos' as const, rotulo: 'Impostos', sinal: '−' as const, valor: d.tax }]
                            : []),
                          ...(d.brokerCost > 0
                            ? [{ chave: 'corretor' as const, rotulo: 'Corretores', sinal: '−' as const, valor: d.brokerCost }]
                            : []),
                          { chave: 'fica', rotulo: 'Fica para a imobiliária', sinal: '=', valor: d.net },
                        ],
                        itens: itensDeVendas(vendasDoEmpreendimento(d), (v) => v.cascade.net),
                        vazio: 'Nenhuma venda ativa neste empreendimento.',
                      })
                    }
                  />
                ),
              },
            ]}
          />
        </Cartao>
      )}

      {porCorretor.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho titulo="Por corretor" icone={Users} meta="Produção e comissão, todas as vendas." />
          <Tabela
            rotuloAcessivel="Produção e comissão por corretor"
            linhas={porCorretor}
            chave={(p) => p.contact.id}
            colunas={[
              { id: 'nome', rotulo: 'Corretor', celula: (p) => p.contact.name },
              {
                id: 'vendas',
                rotulo: 'Vendas',
                numerica: true,
                celula: (p) => (
                  <NumeroComOrigem
                    texto={String(p.sales)}
                    rotuloAcessivel={`Ver as ${p.sales} vendas de ${p.contact.name}`}
                    aoAbrir={() => abrirCorretor(p)}
                  />
                ),
              },
              {
                id: 'vgv',
                rotulo: 'VGV',
                numerica: true,
                /* O sistema diz em texto quando não sabe — nunca em zero. VGV não é receita: posto fato. */
                celula: (p) =>
                  p.vgv > 0 ? (
                    <ValorComOrigem
                      valor={p.vgv}
                      posto="fato"
                      rotuloAcessivel={`Ver o VGV de ${p.contact.name}, venda por venda`}
                      aoAbrir={() =>
                        abrir({
                          rotulo: 'VGV',
                          titulo: `VGV de ${p.contact.name}`,
                          explica:
                            'O valor dos imóveis que este corretor vendeu. Não é o que ele recebe: a comissão dele é uma fração da comissão da venda.',
                          total: p.vgv,
                          itens: itensDeVendas(
                            vendasDoCorretor(p).filter((v) => v.property_value != null),
                            (v) => v.property_value ?? 0,
                          ),
                          nota:
                            p.salesWithoutVgv > 0
                              ? `${p.salesWithoutVgv} ${p.salesWithoutVgv === 1 ? 'venda ficou' : 'vendas ficaram'} de fora: o valor do imóvel não foi informado.`
                              : undefined,
                          vazio: 'Nenhuma venda com valor informado.',
                        })
                      }
                    />
                  ) : (
                    <span className="text-texto-meta text-t-meta">sem VGV informado</span>
                  ),
              },
              {
                id: 'comissao',
                rotulo: 'Comissão',
                numerica: true,
                celula: (p) => (
                  <ValorComOrigem
                    valor={p.commissionTotal}
                    posto="linha"
                    rotuloAcessivel={`Ver as vendas que formam a comissão de ${p.contact.name}`}
                    aoAbrir={() => abrirCorretor(p)}
                  />
                ),
              },
              {
                id: 'apagar',
                rotulo: 'A pagar',
                numerica: true,
                celula: (p) => (
                  <ValorComOrigem
                    valor={p.released + p.expected}
                    posto="linha"
                    forte
                    rotuloAcessivel={`Ver o que falta pagar a ${p.contact.name}`}
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'A pagar',
                        titulo: `A pagar a ${p.contact.name}`,
                        explica:
                          'A comissão dele que ainda não foi paga: a liberada (a construtora já pagou a imobiliária) mais a prevista.',
                        total: r2(p.released + p.expected),
                        linhas: [
                          { chave: 'bruto', rotulo: 'Comissão contratada dele', sinal: '+', valor: p.commissionTotal },
                          { chave: 'desconto', rotulo: 'Já pago', sinal: '−', valor: p.paid },
                          { chave: 'fica', rotulo: 'Falta pagar', sinal: '=', valor: r2(p.released + p.expected) },
                        ],
                        itens: itensDeVendas(vendasDoCorretor(p), (v) => v.brokerToPay),
                        nota:
                          p.released > 0
                            ? `${formatCurrency(p.released)} já está liberado: a construtora pagou a imobiliária e o repasse pode sair.`
                            : 'Nada liberado ainda: o repasse só sai depois que a construtora paga a imobiliária.',
                        vazio: 'Nenhuma venda ativa para este corretor.',
                      })
                    }
                  />
                ),
              },
            ]}
          />
          {porCorretor.some((p) => p.salesWithoutVgv > 0) && (
            <Cartao.Rodape>
              Vendas sem o valor do imóvel informado ficam fora da coluna de VGV. Elas continuam inteiras na
              comissão — o VGV é que não pode ser inventado.
            </Cartao.Rodape>
          )}
        </Cartao>
      )}
      {porCategoria.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho titulo="Saídas do mês por categoria" icone={Receipt} />
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="Saídas do mês por categoria">
            {porCategoria.map((c) => (
              <Linha
                key={c.nome}
                titulo={c.nome}
                valor={
                  <ValorComOrigem
                    valor={c.valor}
                    posto="linha"
                    chevron="antes"
                    rotuloAcessivel={`Ver os lançamentos de ${c.nome}`}
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Saídas',
                        titulo: `${c.nome} em ${formatMonthYear(mes)}`,
                        explica:
                          'Tudo o que saiu nesta categoria no mês, no regime selecionado. Duas saídas aparecem aqui sem estar no resultado acima: o imposto sobre o faturamento, que no DRE é dedução da receita, e a retirada de sócio, que sai depois do lucro.',
                        total: c.valor,
                        itens: doMes
                          .filter((t) => t.category === c.nome && dreGroupOf(t) !== 'revenue')
                          .sort((a, b) => (dataDoRegime(a) ?? '').localeCompare(dataDoRegime(b) ?? ''))
                          .map((t) => ({
                            id: t.id,
                            titulo: t.description || t.category,
                            meta: frase(t),
                            valor: t.amount,
                            para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
                          })),
                        vazio: 'Nenhuma saída nesta categoria.',
                      })
                    }
                  />
                }
              />
            ))}
          </Cartao.Lista>
        </Cartao>
      )}

      {transactions.length === 0 && (
        <Cartao rotuloAcessivel="Sem dados">
          <Cartao.Corpo>
            <EstadoVazio
              icone={PieChart}
              titulo="Sem dados ainda"
              descricao="Registre uma venda ou uma despesa para os relatórios ganharem conteúdo."
            />
          </Cartao.Corpo>
        </Cartao>
      )}
    </PageLayout>
  )
}

/** Uma linha do DRE: a conta, o valor e se fecha um total. */
interface LinhaDre {
  id: string
  rotulo: string
  valor: number
  total?: boolean
  /** Os grupos do DRE que a linha soma — é neles que ela abre. */
  grupos: DreGroup[]
  explica: string
}

/** Ausência de movimento na coluna. Zero conhecido continua sendo escrito como zero. */
function Traco() {
  return (
    <>
      <span className="sr-only">sem movimento</span>
      <span className="text-t-meta" aria-hidden>
        —
      </span>
    </>
  )
}

/** Rótulo da 1ª coluna com uma meta embaixo. */
function Nome({ nome, meta }: { nome: ReactNode; meta?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col max-md:gap-2">
      <span className="text-texto-titulo text-t1">{nome}</span>
      {meta && <span className="text-texto-meta text-t-meta">{meta}</span>}
    </span>
  )
}
