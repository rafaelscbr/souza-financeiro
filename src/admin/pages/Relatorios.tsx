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
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
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
} from '@/lib/sales'
import { agingDaCarteira, pontoDeEquilibrio, previsaoDeCaixa } from '@/lib/cfo'
import { formatCurrency, formatDate, formatMonthShort, formatMonthTiny, formatMonthYear, formatPercent } from '@/lib/format'
import type { Transaction } from '@/types'

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

  /** A economia da carteira: quanto de cada real de comissão sobra de fato. */
  const carteira = useMemo(() => {
    const ativas = vendasDaEmpresa.filter((v) => v.status !== 'cancelada')
    const comissao = cent(ativas.reduce((s, v) => s + v.cascade.commission, 0))
    const liquido = cent(ativas.reduce((s, v) => s + v.cascade.net, 0))
    return { comissao, liquido, margem: comissao > 0 ? liquido / comissao : 0 }
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

  /* As mesmas linhas e os mesmos números da tabela de antes, na mesma ordem. */
  const linhasDre: LinhaDre[] = [
    { id: 'receita', rotulo: 'Receita de comissões', valor: kpis.revenue },
    { id: 'impostos', rotulo: '(−) Impostos sobre o faturamento', valor: -kpis.taxDeductions },
    { id: 'liquida', rotulo: 'Receita líquida', valor: kpis.netRevenue, total: true },
    { id: 'comissoes', rotulo: '(−) Comissões de corretores', valor: -kpis.costOfSale },
    { id: 'bruto', rotulo: 'Lucro bruto', valor: kpis.grossProfit, total: true },
    { id: 'fixas', rotulo: '(−) Despesas fixas', valor: -kpis.operatingExpense },
    { id: 'variaveis', rotulo: '(−) Despesas variáveis', valor: -(kpis.variableExpense + kpis.otherExpense) },
  ]

  type Mes = (typeof serie)[number]
  const serieVisivel = serie.filter(
    (s) => s.kpis.revenue > 0 || s.kpis.totalExpense > 0 || s.kpis.taxDeductions > 0,
  )
  const despesasDe = (s: Mes) => s.kpis.operatingExpense + s.kpis.variableExpense + s.kpis.otherExpense

  const colunasDoze: ColunaTabela<Mes>[] = [
    { id: 'mes', rotulo: 'Mês', celula: (s) => formatMonthShort(s.mes) },
    { id: 'receita', rotulo: 'Receita', numerica: true, celula: (s) => <Dinheiro valor={s.kpis.revenue} /> },
    {
      id: 'impostos',
      rotulo: 'Impostos',
      numerica: true,
      celula: (s) => (s.kpis.taxDeductions > 0 ? <Dinheiro valor={-s.kpis.taxDeductions} /> : <Traco />),
    },
    {
      id: 'comissoes',
      rotulo: 'Comissões',
      numerica: true,
      celula: (s) => (s.kpis.costOfSale > 0 ? <Dinheiro valor={-s.kpis.costOfSale} /> : <Traco />),
    },
    {
      id: 'despesas',
      rotulo: 'Despesas',
      numerica: true,
      celula: (s) => (despesasDe(s) > 0 ? <Dinheiro valor={-despesasDe(s)} /> : <Traco />),
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
          para="/vendas"
        />
        <Kpi
          rotulo="VGL · 12 meses"
          icone={Scale}
          tom="marca"
          valor={volume.vgl}
          nota={
            volume.distratos === 0
              ? 'nenhum distrato no período'
              : `sem os ${volume.distratos === 1 ? 'distrato' : `${volume.distratos} distratos`}`
          }
          para="/vendas"
        />
        <Kpi
          rotulo="Comissão contratada"
          icone={Banknote}
          tom="info"
          valor={carteira.comissao}
          nota="todas as vendas ativas, recebido e a receber"
          para="/vendas"
        />
        <Kpi
          rotulo="Margem da imobiliária"
          icone={PieChart}
          tom="sucesso"
          valor={0}
          texto={formatPercent(carteira.margem, 0)}
          nota={`${formatCurrency(carteira.liquido)} sobram depois do imposto e do corretor`}
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
              valor={<Valor valor={equilibrio.custoFixo} posto="linha" />}
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
                equilibrio.comissaoMedia >= equilibrio.comissaoNecessaria ? (
                  <Valor valor={equilibrio.comissaoMedia} posto="linha" estado="recebido" />
                ) : (
                  <Valor valor={equilibrio.comissaoMedia} posto="linha" estado="vencido" />
                )
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
                  valor={<Valor valor={f.total} posto="linha" previsto />}
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
              celula: (l) => <Dinheiro valor={l.valor} forte={l.total} />,
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
                valor={<Dinheiro valor={b.balance} />}
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
              { id: 'vendas', rotulo: 'Vendas', numerica: true, celula: (d) => <span className="num">{d.sales}</span> },
              {
                id: 'vgv',
                rotulo: 'VGV',
                numerica: true,
                celula: (d) =>
                  d.vgv > 0 ? (
                    <Valor valor={d.vgv} posto="linha" />
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
                celula: (d) => <span className="num">{formatPercent(d.margin, 0)}</span>,
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
              { id: 'vendas', rotulo: 'Vendas', numerica: true, celula: (p) => <span className="num">{p.sales}</span> },
              {
                id: 'vgv',
                rotulo: 'VGV',
                numerica: true,
                /* O sistema diz em texto quando não sabe — nunca em zero. VGV não é receita: posto fato. */
                celula: (p) =>
                  p.vgv > 0 ? (
                    <Valor valor={p.vgv} posto="fato" />
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
                celula: (p) => <Valor valor={p.released + p.expected} posto="linha" forte />,
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

/** Dinheiro numa célula: nunca abreviado; só o negativo real pinta. */
function Dinheiro({ valor, forte }: { valor: number; forte?: boolean }) {
  return valor < 0 ? <Valor valor={valor} posto="linha" estado="negativo" /> : <Valor valor={valor} posto="linha" forte={forte} />
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
