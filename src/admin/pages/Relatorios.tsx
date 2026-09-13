import { useMemo, useState, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { computeKpis, dreGroupOf, lastNMonths, monthKey } from '@/lib/finance'
import { ACCOUNT_TYPE_LABEL, treasurySummary } from '@/lib/treasury'
import {
  brokerProduction,
  developmentResults,
  type BrokerProduction,
  type DevelopmentResult,
} from '@/lib/sales'
import { formatCurrency, formatDate, formatMonthShort, formatMonthYear, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

type Regime = 'caixa' | 'competencia'

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
 * O que mudou no desenho, e por quê:
 *
 * 1. As seis seções eram seis cartões com `shadow-card`. Essa sombra não
 *    existe mais em tailwind.config.js (sobrou só `pop`, para o que flutua),
 *    então os cartões já estavam apenas fingindo profundidade. Viraram seções
 *    separadas por fio.
 *
 * 2. Os três cabeçalhos de tabela eram `text-[10px]` em `content-faint` —
 *    10px a contraste baixo, num documento que existe para ser CONFERIDO.
 *    Passaram ao piso do sistema, 12px, em `content-muted`.
 *
 * 3. O DRE do mês era uma pilha de <div>. Virou <table> de verdade: é uma
 *    demonstração contábil, tem cabeçalho de coluna e leitor de tela precisa
 *    navegar por ela como tabela. Toda tabela rola dentro do próprio
 *    container, para a PÁGINA nunca rolar na horizontal.
 *
 * 4. Fio estrutural (`border-rule`, 3,54:1) acima de cada total — receita
 *    líquida, lucro bruto, resultado. Fio decorativo (`border-line`, 1,24:1)
 *    entre as linhas comuns. É a regra do §2.6 do sistema visual: o fio que
 *    fecha uma conta não pode ser o mesmo que só separa duas linhas.
 *
 * 5. O saldo em conta era a 2ª de 6 seções desta tela sendo o número mais
 *    decisório do sistema. Ele subiu para o herói do Início. Aqui continua,
 *    no mesmo lugar, mas como seção normal: quem abre Relatórios está
 *    perguntando pelo resultado, não pelo saldo.
 *
 * 6. Todo total por mês, por empreendimento, por corretor e por categoria
 *    abre no que o compõe, e cada item leva à ficha da venda. Antes eram
 *    números terminais: dava para ver que PortoVelas rendeu X e não havia
 *    nenhum caminho de X até as vendas que formaram X.
 */
export function Relatorios() {
  const { transactions, accounts, transfers, mes, vendas, contacts, contatosComAcesso } = useAdmin()
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
  const porEmpreendimento = useMemo(() => developmentResults(vendas), [vendas])
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
    vendas.filter((v) => v.status !== 'cancelada' && (v.cost_center_id ?? '—') === (d.id ?? '—'))

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

  return (
    <div className="animate-fade-in">
      {/*
       * UM herói, e o rótulo é "Resultado do mês" — a palavra é reservada a
       * esta tela. O número sai inteiro de `computeKpis`, a mesma função que
       * monta a tabela logo abaixo: não existe aqui nenhuma soma paralela que
       * possa divergir dela.
       */}
      <Heroi
        rotulo="Resultado do mês"
        contexto="Da comissão saem os impostos sobre o faturamento, depois a comissão dos corretores e por fim a estrutura. O que resta é o resultado — não é saldo em conta, e retirada de sócio não está descontada dele."
      >
        <Valor
          valor={kpis.netProfit}
          posto="heroi"
          tinta={kpis.netProfit < 0 ? 'text-expense' : undefined}
        />
      </Heroi>

      {/*
       * A chave caixa/competência vive AQUI, e não no cabeçalho do app: ela só
       * muda o DRE, e como chave global fazia todas as telas mudarem de
       * sentido sem explicação nenhuma.
       */}
      <div className="-mt-2 pb-2">
        <div className="sm:max-w-[16rem]">
          <Segmented
            ariaLabel="Regime"
            value={regime}
            onChange={setRegime}
            options={[
              { value: 'caixa', label: 'Caixa' },
              { value: 'competencia', label: 'Competência' },
            ]}
          />
        </div>
        <p className="mt-2 text-sm text-content-muted">
          {regime === 'caixa'
            ? 'Caixa: conta no mês em que o dinheiro se moveu.'
            : 'Competência: conta no mês da venda, mesmo que o dinheiro entre depois.'}
        </p>
      </div>

      <Secao titulo="Como o resultado se forma">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem]">
            <caption className="sr-only">
              Demonstração do resultado de {formatMonthYear(mes)}
            </caption>
            <thead>
              <tr className="border-b border-b-line text-xs font-medium uppercase tracking-wide text-content-muted">
                <th scope="col" className="py-2 text-left">
                  Conta
                </th>
                <th scope="col" className="py-2 text-right">
                  No mês
                </th>
              </tr>
            </thead>
            <tbody>
              <LinhaDre rotulo="Receita de comissões" valor={kpis.revenue} />
              <LinhaDre rotulo="(−) Impostos sobre o faturamento" valor={-kpis.taxDeductions} />
              <LinhaDre rotulo="Receita líquida" valor={kpis.netRevenue} total />
              <LinhaDre rotulo="(−) Comissões de corretores" valor={-kpis.costOfSale} />
              <LinhaDre rotulo="Lucro bruto" valor={kpis.grossProfit} total />
              <LinhaDre rotulo="(−) Despesas fixas" valor={-kpis.operatingExpense} />
              <LinhaDre
                rotulo="(−) Despesas variáveis"
                valor={-(kpis.variableExpense + kpis.otherExpense)}
              />
              <LinhaDre rotulo="Resultado" valor={kpis.netProfit} total />
            </tbody>
          </table>
        </div>
        {kpis.revenue > 0 && (
          <p className="mt-2 text-right text-sm text-content-faint">
            margem {formatPercent(kpis.netMargin, 0)}
          </p>
        )}
        {kpis.profitDistribution > 0 && (
          <p className="mt-3 border-t border-rule pt-3 text-sm text-content-muted">
            Retiradas do sócio no mês: {formatCurrency(kpis.profitDistribution)}. Saem depois do
            resultado — são remuneração do capital, não custo da operação.
          </p>
        )}
      </Secao>

      {/*
       * O saldo em conta. Continua sendo o número mais decisório do sistema,
       * mas o herói desta tela é o resultado: aqui ele é seção normal, no
       * degrau de comparação, sem competir com a dobra.
       */}
      {tesouraria.balances.length > 0 && (
        <Secao titulo="Saldo em conta">
          <Lista>
            {tesouraria.balances.map((b) => (
              <Linha
                key={b.account.id}
                titulo={b.account.name}
                meta={ACCOUNT_TYPE_LABEL[b.account.type]}
                valor={
                  <Valor
                    valor={b.balance}
                    posto="linha"
                    tinta={b.balance < 0 ? 'text-expense' : undefined}
                  />
                }
              />
            ))}
          </Lista>
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-rule pt-3">
            <span className="text-base font-semibold text-content">Disponível</span>
            <Valor valor={tesouraria.available} posto="linha" />
          </div>
          {tesouraria.unassignedCount > 0 && (
            <p className="mt-2 text-sm text-content-faint">
              {tesouraria.unassignedCount} lançamento(s) liquidado(s) sem conta, somando{' '}
              {formatCurrency(tesouraria.unassigned)}. Ficam fora do saldo das contas de propósito —
              incluir daria um número que não bate com banco nenhum.
            </p>
          )}
        </Secao>
      )}

      <Secao
        titulo="Doze meses"
        acao={
          <Button variant="secondary" onClick={exportarDre}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        }
      >
        {/*
         * Comparação por COLUNA alinhada à direita, em figura tabular — nunca
         * por barrinha dentro da linha. Uma barra compara por comprimento
         * estimado; a coluna compara por contagem de dígito, que é o que se
         * faz ao conferir contra o extrato.
         */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem]">
            <caption className="sr-only">Resultado dos últimos doze meses</caption>
            <thead>
              <tr className="border-b border-b-line text-xs font-medium uppercase tracking-wide text-content-muted">
                <th scope="col" className="py-2 text-left">
                  Mês
                </th>
                <th scope="col" className="py-2 text-right">
                  Receita
                </th>
                <th scope="col" className="py-2 text-right">
                  Impostos
                </th>
                <th scope="col" className="py-2 text-right">
                  Comissões
                </th>
                <th scope="col" className="py-2 text-right">
                  Despesas
                </th>
                <th scope="col" className="py-2 text-right">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {serie
                .filter((s) => s.kpis.revenue > 0 || s.kpis.totalExpense > 0 || s.kpis.taxDeductions > 0)
                .map((s) => {
                  const despesas =
                    s.kpis.operatingExpense + s.kpis.variableExpense + s.kpis.otherExpense
                  return (
                    <tr key={monthKey(s.mes)} className="border-b border-b-line">
                      <th scope="row" className="py-2.5 pr-3 text-left text-base font-medium text-content">
                        {formatMonthShort(s.mes)}
                      </th>
                      <Cel>
                        <Dinheiro valor={s.kpis.revenue} />
                      </Cel>
                      <Cel>
                        {s.kpis.taxDeductions > 0 ? <Dinheiro valor={-s.kpis.taxDeductions} /> : <Traco />}
                      </Cel>
                      <Cel>
                        {s.kpis.costOfSale > 0 ? <Dinheiro valor={-s.kpis.costOfSale} /> : <Traco />}
                      </Cel>
                      <Cel>{despesas > 0 ? <Dinheiro valor={-despesas} /> : <Traco />}</Cel>
                      <Cel>
                        <ValorComOrigem
                          valor={s.kpis.netProfit}
                          posto="fato"
                          tinta={s.kpis.netProfit < 0 ? 'text-expense' : undefined}
                          rotuloAcessivel={`Ver de onde vem o resultado de ${formatMonthYear(s.mes)}`}
                          aoAbrir={() => abrirMes(s)}
                        />
                      </Cel>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Secao>

      {porEmpreendimento.length > 0 && (
        <Secao titulo="Por empreendimento">
          <p className="mb-1 text-sm text-content-muted">
            Qual produto dá lucro de verdade. Considera todas as vendas, não só o mês.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead>
                <tr className="border-b border-b-line text-xs font-medium uppercase tracking-wide text-content-muted">
                  <th scope="col" className="py-2 text-left">
                    Empreendimento
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Vendas
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Comissão
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Fica limpo
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Margem
                  </th>
                </tr>
              </thead>
              <tbody>
                {porEmpreendimento.map((d) => (
                  <tr key={d.id ?? 'sem'} className="border-b border-b-line">
                    <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                      <span className="text-base font-medium text-content">{d.name}</span>
                      {d.developer && (
                        <span className="block text-sm text-content-faint">{d.developer}</span>
                      )}
                    </th>
                    <Cel className="tnum text-base text-content-muted">{d.sales}</Cel>
                    <Cel>
                      {/*
                       * Nenhum número sem origem: a comissão do empreendimento
                       * abre nas vendas que a formaram, e cada uma leva à ficha.
                       */}
                      <ValorComOrigem
                        valor={d.commission}
                        posto="fato"
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
                    </Cel>
                    <Cel>
                      <ValorComOrigem
                        valor={d.net}
                        posto="fato"
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
                    </Cel>
                    <Cel className="tnum text-base text-content-muted">{formatPercent(d.margin, 0)}</Cel>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}

      {porCorretor.length > 0 && (
        <Secao titulo="Por corretor">
          <p className="mb-1 text-sm text-content-muted">Produção e comissão, todas as vendas.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem]">
              <thead>
                <tr className="border-b border-b-line text-xs font-medium uppercase tracking-wide text-content-muted">
                  <th scope="col" className="py-2 text-left">
                    Corretor
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Vendas
                  </th>
                  <th scope="col" className="py-2 text-right">
                    VGV
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Comissão
                  </th>
                  <th scope="col" className="py-2 text-right">
                    A pagar agora
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Previsto
                  </th>
                </tr>
              </thead>
              <tbody>
                {porCorretor.map((p) => (
                  <tr key={p.contact.id} className="border-b border-b-line">
                    <th
                      scope="row"
                      className="py-2.5 pr-3 text-left text-base font-medium text-content"
                    >
                      {p.contact.name}
                    </th>
                    <Cel className="tnum text-base text-content-muted">{p.sales}</Cel>
                    <Cel>
                      {/* O sistema diz em texto quando não sabe — nunca em zero. */}
                      {p.vgv > 0 ? (
                        <Dinheiro valor={p.vgv} />
                      ) : (
                        <span className="text-sm text-content-faint">sem VGV informado</span>
                      )}
                    </Cel>
                    <Cel>
                      <ValorComOrigem
                        valor={p.commissionTotal}
                        posto="fato"
                        rotuloAcessivel={`Ver as vendas que formam a comissão de ${p.contact.name}`}
                        aoAbrir={() => abrirCorretor(p)}
                      />
                    </Cel>
                    {/* Liberado e previsto em colunas próprias: somados, o previsto virava dívida. */}
                    <Cel>
                      <Dinheiro valor={p.released} className="font-semibold" />
                    </Cel>
                    <Cel>
                      <Dinheiro valor={p.expected} className="text-content-muted" />
                    </Cel>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {porCorretor.some((p) => p.salesWithoutVgv > 0) && (
            <p className="mt-2 text-sm text-content-faint">
              Vendas sem o valor do imóvel informado ficam fora da coluna de VGV. Elas continuam
              inteiras na comissão — o VGV é que não pode ser inventado.
            </p>
          )}
        </Secao>
      )}

      {porCategoria.length > 0 && (
        <Secao titulo="Saídas do mês por categoria">
          <Lista>
            {porCategoria.map((c) => (
              <Linha
                key={c.nome}
                titulo={c.nome}
                valor={
                  <ValorComOrigem
                    valor={c.valor}
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
          </Lista>
        </Secao>
      )}

      {transactions.length === 0 && (
        <EmptyState
          title="Sem dados ainda"
          description="Registre uma venda ou uma despesa para os relatórios ganharem conteúdo."
        />
      )}
    </div>
  )

}

/**
 * Uma linha do DRE.
 *
 * O fio é a única marca de hierarquia: `border-rule` (3,54:1) fecha um total,
 * `border-line` (1,24:1) apenas separa duas linhas comuns. São grupos de
 * borda diferentes de propósito — `border-b-line` e `border-t-rule` não
 * colidem no merge, então uma linha de total carrega os dois fios sem que um
 * apague o outro.
 */
function LinhaDre({ rotulo, valor, total }: { rotulo: string; valor: number; total?: boolean }) {
  return (
    <tr className={cn('border-b border-b-line', total && 'border-t border-t-rule')}>
      <th
        scope="row"
        className={cn(
          'py-2.5 pr-4 text-left text-base',
          total ? 'font-semibold text-content' : 'font-normal text-content-muted',
        )}
      >
        {rotulo}
      </th>
      <td className="py-2.5 text-right">
        <Dinheiro valor={valor} className={total ? 'font-semibold' : undefined} />
      </td>
    </tr>
  )
}

/** Ausência de movimento na coluna. Zero conhecido continua sendo escrito como zero. */
function Traco() {
  return (
    <>
      <span className="sr-only">sem movimento</span>
      <span className="text-base text-content-faint" aria-hidden>
        —
      </span>
    </>
  )
}

/** Célula de dado: sempre à direita, para as colunas se compararem por dígito. */
function Cel({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('py-2.5 pl-4 text-right align-middle', className)}>{children}</td>
}

/**
 * Dinheiro dentro de uma conta — o posto `fato`. Nunca abreviado: a diferença
 * de R$ 0,04 é o que trava um cadastro, e `formatCurrencyCompact` foi apagada
 * justamente para que essa regra não dependa de lembrança.
 */
function Dinheiro({ valor, className }: { valor: number; className?: string }) {
  return (
    <Valor
      valor={valor}
      posto="fato"
      tinta={valor < 0 ? 'text-expense' : undefined}
      className={className}
    />
  )
}
