import { useMemo, useState } from 'react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Dica } from '@/components/ui/Dica'
import { ContaDoRelatorio, ExportarRelatorio, FiltrosDePeriodo, GraficoDozeMeses, variacaoEmPalavras } from '../RelatorioPecas'
import { CartaoPrevisaoDeCaixa } from '../CartaoPrevisaoDeCaixa'
import { dreGroupOf } from '@/lib/finance'
import { periodosDoDre, type PeriodoDre, type TipoPeriodo } from '@/lib/dre'
import { montarFluxoDeCaixa, type LinhaDoCaixa } from '@/lib/fluxoDeCaixa'
import { formatCurrency, formatDate, formatMonthTiny, formatMonthYear } from '@/lib/format'
import { evolucaoMensal } from '@/lib/painel'
import { Legenda } from '@/components/graficos/Graficos'
import type { Transaction } from '@/types'

/*
 * FLUXO DE CAIXA — o dinheiro de verdade (22/10/2026).
 *
 * O par do DRE: lá, quanto a imobiliária ganhou; aqui, quanto dinheiro
 * entrou e saiu das contas dela, e com quanto ela começou e terminou. Os
 * números vêm de `montarFluxoDeCaixa` (lib/fluxoDeCaixa.ts), que fecha com o
 * saldo do banco por construção. Todo valor abre no que o forma.
 *
 * Souza 3.0 (02/11/2026): a frase do título diz com quanto o período
 * terminou; a faixa traz o saldo no fim (líder), o que entrou, o que saiu e o
 * que a operação gerou. Embaixo, os 12 meses (o gráfico que saiu do Início)
 * e a conta do período, com a comparação e o caixa previsto ao lado.
 */
const r2 = (v: number) => Math.round(v * 100) / 100

const EM_PALAVRAS: Record<string, string> = {
  'saldo-inicial': 'O dinheiro em conta na véspera do período',
  recebimentos: 'O dinheiro que entrou nas contas',
  pagamentos: 'O dinheiro que saiu para tocar o negócio',
  gerado: 'O caixa que o próprio negócio produziu',
  retiradas: 'O que o sócio tirou da empresa',
  transferencias: 'Fatura do cartão e outras contas',
  abertura: 'Conta que começou no sistema neste período',
  variacao: 'Quanto o dinheiro em conta subiu ou desceu',
  'saldo-final': 'O dinheiro em conta no último dia do período',
}

export function RelatorioCaixa() {
  const { transactions, accounts, transfers, installments, mes } = useAdmin()
  const parcelasPorId = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  /* Souza 2.0: a série de 12 meses pela data do dinheiro, para ver o caixa no tempo. */
  const serie = useMemo(() => evolucaoMensal(transactions, parcelasPorId, mes), [transactions, parcelasPorId, mes])
  const abrirMesDaSerie = (i: number) => {
    const e = serie[i]
    abrir({
      rotulo: 'Caixa do mês',
      titulo: formatMonthYear(new Date(`${e.mes}-01T12:00:00`)),
      explica: 'O que entrou e saiu no mês, pela data da baixa. Retirada do sócio fica de fora.',
      total: e.caixa.resultado,
      itens: [...e.caixa.entradas, ...e.caixa.saidas].map((t) => ({
        id: t.id,
        titulo: t.description || t.category,
        meta: `${t.category} · ${formatDate(t.settled_date ?? t.competence_date)}`,
        valor: t.kind === 'income' ? t.amount : -t.amount,
        para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
      })),
      vazio: 'Nada entrou nem saiu neste mês.',
    })
  }
  const { abrir } = useComposicao()
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')

  const periodos = useMemo(() => periodosDoDre(mes, tipo), [mes, tipo])
  const fluxoDe = (p: PeriodoDre) => montarFluxoDeCaixa({ accounts, transactions, transfers, periodo: p })
  const atual = useMemo(() => fluxoDe(periodos.atual), [accounts, transactions, transfers, periodos]) // eslint-disable-line react-hooks/exhaustive-deps
  const anterior = useMemo(() => fluxoDe(periodos.anterior), [accounts, transactions, transfers, periodos]) // eslint-disable-line react-hooks/exhaustive-deps

  const valorDe = (id: string, f = atual) => f.linhas.find((l) => l.id === id)?.valor ?? 0
  const linhaDe = (id: string, f = atual) => f.linhas.find((l) => l.id === id)!

  // Conta zerada e linha que não se aplica (abertura, transferência) não ocupam lugar.
  const linhas = atual.linhas.filter(
    (l) => !(l.valor === 0 && (l.tipo === 'conta' || l.id === 'abertura' || l.id === 'transferencias')),
  )

  /* ------------------------------------------------------------ abrir */

  const frase = (t: Transaction) =>
    `${dreGroupOf(t) === 'revenue' ? 'recebido' : 'pago'} em ${formatDate(t.settled_date ?? t.competence_date)}`
  const itens = (txs: Transaction[]) =>
    [...txs]
      .sort((a, b) => (a.settled_date ?? a.competence_date).localeCompare(b.settled_date ?? b.competence_date))
      .map((t) => ({
        id: t.id,
        titulo: t.description || t.category,
        meta: `${frase(t)} · ${t.category}`,
        valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
        para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
      }))

  const abrirLinha = (l: LinhaDoCaixa, p: PeriodoDre) => {
    const nome = l.rotulo.replace(/^\([−+±]\) /, '')
    abrir({
      rotulo: nome,
      titulo: `${nome} · ${p.rotulo}`,
      explica: l.explica,
      total: l.valor,
      itens: l.saldos
        ? l.saldos.map((s) => ({ id: s.conta.id, titulo: s.conta.name, meta: 'saldo da conta', valor: s.saldo }))
        : itens(l.lancamentos),
      vazio: l.saldos ? 'Nenhuma conta de dinheiro neste período.' : 'Nenhum movimento neste período.',
    })
  }

  const entradasFora = atual.foraDoSaldo.filter((t) => dreGroupOf(t) === 'revenue')
  const saidasFora = atual.foraDoSaldo.filter((t) => dreGroupOf(t) !== 'revenue')
  const somar = (txs: Transaction[]) => Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100
  const abrirFora = (titulo: string, txs: Transaction[], sinal: 1 | -1) =>
    abrir({
      rotulo: titulo,
      titulo: `${titulo} · ${periodos.atual.rotulo}`,
      explica:
        'Movimento liquidado que não passou por uma conta de dinheiro da imobiliária no sistema: recebido direto na conta pessoal, pago do bolso do sócio ou anterior à abertura da conta.',
      total: sinal * somar(txs),
      itens: itens(txs),
      vazio: 'Nada fora das contas neste período.',
    })

  /* ------------------------------------------------------------ texto */

  const inicial = valorDe('saldo-inicial')
  const final = valorDe('saldo-final')
  const entrou = valorDe('recebimentos')
  const saiu = valorDe('pagamentos') + valorDe('retiradas')
  const gerado = valorDe('gerado')

  const comecaDepois = atual.contasDesde !== null && atual.contasDesde > `${periodos.atual.de}-01`

  const comparar = [
    { id: 'recebimentos', rotulo: 'Recebimentos', custo: false },
    { id: 'gerado', rotulo: 'Caixa gerado pela operação', custo: false },
    { id: 'saldo-final', rotulo: 'Saldo no fim', custo: false },
  ]

  const linhaSaiu: LinhaDoCaixa = {
    ...linhaDe('pagamentos'),
    rotulo: 'Saiu',
    valor: saiu,
    explica: 'Pagamentos da operação e retiradas do sócio.',
    lancamentos: [...linhaDe('pagamentos').lancamentos, ...linhaDe('retiradas').lancamentos],
  }

  /* --------------------------------------------------------- 12 meses */

  const doze = serie.reduce((s, e) => ({ entra: s.entra + e.caixa.entra, sai: s.sai + e.caixa.sai }), { entra: 0, sai: 0 })
  const geradoDoze = r2(doze.entra - doze.sai)

  /* ------------------------------------------------------------ frase */

  const fraseDoTitulo = (
    <>
      <b>
        <Valor valor={final} posto="fato" tinta={final < 0 ? 'text-error-ink' : 'text-t1'} /> em conta
      </b>{' '}
      no fim de {periodos.atual.rotulo} · {gerado >= 0 ? 'a operação gerou caixa' : 'a operação gastou mais do que recebeu'}
    </>
  )

  return (
    <PageLayout
      subtitulo={fraseDoTitulo}
      faixa={<FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />}
      acoes={
        <ExportarRelatorio
          nome={`Fluxo de caixa ${periodos.atual.rotulo}`}
          planilha={() => ({
            cabecalho: ['Fluxo de caixa', periodos.atual.rotulo, periodos.anterior.rotulo],
            linhas: linhas.map((l) => [l.tipo === 'conta' ? `   ${l.rotulo}` : l.rotulo, l.valor, valorDe(l.id, anterior)]),
          })}
        />
      }
    >
      <FaixaDeMetricas
        rotuloAcessivel={`Fluxo de caixa de ${periodos.atual.rotulo}`}
        metricas={[
          {
            rotulo: `Saldo no fim · ${periodos.atual.rotulo}`,
            valor: final,
            lider: true,
            estado: final < 0 ? 'negativo' : undefined,
            nota: (
              <>
                começou com <Valor valor={inicial} posto="fato" />
              </>
            ),
            aoClicar: () => abrirLinha(linhaDe('saldo-final'), periodos.atual),
          },
          {
            rotulo: 'Entrou',
            valor: entrou,
            nota: 'recebimentos nas contas',
            aoClicar: entrou !== 0 ? () => abrirLinha(linhaDe('recebimentos'), periodos.atual) : undefined,
          },
          {
            rotulo: 'Saiu',
            valor: saiu,
            nota: 'pagamentos e retiradas',
            aoClicar: saiu !== 0 ? () => abrirLinha(linhaSaiu, periodos.atual) : undefined,
          },
          {
            rotulo: 'Gerado pela operação',
            valor: gerado,
            estado: gerado < 0 ? 'negativo' : undefined,
            nota: `${periodos.anterior.rotulo}: ${variacaoEmPalavras(gerado, valorDe('gerado', anterior))}`,
            aoClicar: gerado !== 0 ? () => abrirLinha(linhaDe('gerado'), periodos.atual) : undefined,
          },
        ]}
      />

      <Cartao>
        <Cartao.Cabecalho
          titulo="Os últimos 12 meses"
          meta={
            <>
              Pela data do dinheiro, sem a retirada do sócio:{' '}
              <Valor valor={geradoDoze} posto="fato" forte estado={geradoDoze < 0 ? 'negativo' : undefined} />{' '}
              {geradoDoze < 0 ? 'a menos no caixa' : 'a mais no caixa'}
            </>
          }
          extra={
            <Legenda
              itens={[
                { nome: 'Entrou', cor: 'var(--g-entra)' },
                { nome: 'Saiu', cor: 'var(--g-sai)' },
                { nome: 'Sobrou', cor: 'var(--g-resultado)', linha: true },
              ]}
            />
          }
        />
        <Cartao.Corpo>
          <GraficoDozeMeses
            aoClicar={abrirMesDaSerie}
            rotuloAcessivel="O que entrou, saiu e sobrou em cada um dos últimos 12 meses. Toque num mês para ver os lançamentos."
            meses={serie.map((e) => {
              const d = new Date(`${e.mes}-01T12:00:00`)
              return {
                chave: e.mes,
                rotulo: formatMonthTiny(d),
                titulo: formatMonthYear(d),
                entra: e.caixa.entra,
                sai: e.caixa.sai,
                resultado: e.caixa.resultado,
              }
            })}
          />
        </Cartao.Corpo>
      </Cartao>

      {comecaDepois && atual.contasDesde && (
        <Dica tom="info">
          O saldo das contas da imobiliária começa no sistema em {formatDate(atual.contasDesde)}. O que se moveu
          antes disso aparece em "Fora das contas da imobiliária".
        </Dica>
      )}

      <div className="grid items-start gap-bloco xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao>
          <Cartao.Cabecalho titulo="Como o dinheiro se moveu" meta="dinheiro de verdade, nas contas da imobiliária" />
          <ContaDoRelatorio
            linhas={linhas}
            emPalavras={EM_PALAVRAS}
            aoAbrir={(l) => abrirLinha(l, periodos.atual)}
            rotuloAcessivel={`Fluxo de caixa de ${periodos.atual.rotulo}`}
            rotuloAtual={periodos.atual.rotulo}
            comparar={{ rotulo: periodos.anterior.rotulo, valores: new Map(anterior.linhas.map((l) => [l.id, l.valor])) }}
          />
        </Cartao>
        {/*
         * O PREVISTO (Fase 4, 23/10/2026): o realizado está à esquerda; aqui,
         * o caixa daqui para frente, a partir do saldo de hoje. O gráfico da
         * mesma conta mora no Início; aqui ela vem mês a mês, ao lado.
         */}
        <CartaoPrevisaoDeCaixa />
      </div>

      <div className="grid items-start gap-bloco lg:grid-cols-2">
        <Cartao>
          <Cartao.Cabecalho titulo={`Comparado com ${periodos.anterior.rotulo}`} meta="o mesmo período, um antes" />
          <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Comparação com o período anterior">
            {comparar.map((c) => {
              const agora = valorDe(c.id)
              const antes = valorDe(c.id, anterior)
              return (
                <Linha
                  key={c.id}
                  titulo={c.rotulo}
                  meta={`${periodos.anterior.rotulo}: ${formatCurrency(antes)} · ${variacaoEmPalavras(agora, antes, c.custo)}`}
                  valor={<Valor valor={agora} posto="linha" estado={agora < 0 ? 'negativo' : undefined} />}
                  aoClicar={() => abrirLinha(linhaDe(c.id, anterior), periodos.anterior)}
                />
              )
            })}
          </Cartao.Lista>
        </Cartao>
        {atual.foraDoSaldo.length > 0 && (
          <Cartao>
            <Cartao.Cabecalho titulo="Fora das contas da imobiliária" meta="liquidado sem passar por uma conta dela; não entra no saldo" />
            <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Movimentos fora das contas">
              {entradasFora.length > 0 && (
                <Linha
                  titulo="Entradas"
                  meta={`${entradasFora.length} ${entradasFora.length === 1 ? 'lançamento' : 'lançamentos'}`}
                  valor={<Valor valor={somar(entradasFora)} posto="linha" />}
                  aoClicar={() => abrirFora('Entradas fora das contas', entradasFora, 1)}
                />
              )}
              {saidasFora.length > 0 && (
                <Linha
                  titulo="Saídas"
                  meta={`${saidasFora.length} ${saidasFora.length === 1 ? 'lançamento' : 'lançamentos'}`}
                  valor={<Valor valor={-somar(saidasFora)} posto="linha" estado="negativo" />}
                  aoClicar={() => abrirFora('Saídas fora das contas', saidasFora, -1)}
                />
              )}
            </Cartao.Lista>
          </Cartao>
        )}
      </div>
    </PageLayout>
  )
}
