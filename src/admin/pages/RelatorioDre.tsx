import { useMemo, useState } from 'react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { PartesDaRegua, Regua } from '@/components/ui/Regua'
import { ContaDoRelatorio, ExportarRelatorio, FiltrosDePeriodo, variacaoEmPalavras } from '../RelatorioPecas'
import { dreGroupOf } from '@/lib/finance'
import {
  competenciaNoDre,
  contaDoDre,
  lancamentoDevido,
  montarDre,
  noPeriodo,
  periodosDoDre,
  type LinhaDoDre,
  type PeriodoDre,
  type TipoPeriodo,
} from '@/lib/dre'
import { formatCurrency, formatDate, toDateOnly } from '@/lib/format'
import type { Transaction } from '@/types'

/*
 * DRE — a demonstração do resultado da imobiliária (22/10/2026).
 *
 * Sempre por competência: mostra quanto a empresa GANHOU no período, com a
 * comissão contada quando fica devida (gatilho e nota), não quando o
 * dinheiro cai. O dinheiro que de fato entrou e saiu é o outro relatório, o
 * Fluxo de caixa. Os dois juntos dizem se a imobiliária dá lucro e se tem
 * caixa — decisão do Rafael em 22/10/2026.
 *
 * Feita para ler de cima para baixo sem saber contabilidade: a frase do
 * título e a faixa dizem quanto sobrou (Souza 3.0: o lucro líquido é o
 * número líder), a conta abaixo mostra como se chegou nele, linha por linha,
 * em palavras simples, e ao lado ficam o previsto e a comparação.
 *
 * Só entra a comissão já DEVIDA (nota, gatilho ou dinheiro — decisão C6 de
 * 23/10/2026, CPC 47). A parcela que ainda espera o gatilho é previsão: fica
 * num cartão à parte e nunca soma no lucro.
 *
 * Os números vêm inteiros de `montarDre` (lib/dre.ts), que só abre o que
 * `computeKpis` já somou. Esta tela não soma nada por fora. Todo valor abre
 * nos lançamentos que o formam, e o lançamento de venda leva à venda.
 */

/** A frase curta embaixo de cada linha principal: o que ela é, sem jargão. */
const EM_PALAVRAS: Record<string, string> = {
  bruta: 'Tudo o que a imobiliária faturou',
  impostos: 'Simples Nacional e ISS sobre a comissão',
  liquida: 'O que fica depois dos impostos',
  corretores: 'A parte de cada corretor nas vendas',
  bruto: 'O que sobra das vendas para pagar a estrutura',
  despesas: 'Marketing, brindes, sistemas e estrutura',
  liquido: 'O resultado da imobiliária. Não é saldo em conta',
  distribuicao: 'O que o sócio retirou',
  retido: 'O que fica na imobiliária depois das retiradas',
}

export function RelatorioDre() {
  const { transactions, installments, mes } = useAdmin()
  const { abrir } = useComposicao()
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')

  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const dataDoRegime = (t: Transaction): string => competenciaNoDre(t, parcelas)

  const periodos = useMemo(() => periodosDoDre(mes, tipo), [mes, tipo])
  const doMes = (p: PeriodoDre) => transactions.filter((t) => noPeriodo(dataDoRegime(t).slice(0, 7), p))
  /** O realizado: só o que já é devido. */
  const doPeriodo = (p: PeriodoDre) => doMes(p).filter((t) => lancamentoDevido(t, parcelas))
  /** A previsão: parcelas do período que ainda esperam gatilho ou nota. */
  const previstoDe = (p: PeriodoDre) => doMes(p).filter((t) => !lancamentoDevido(t, parcelas))

  const { atual, anterior, temPrevisto, previsto, previstos } = useMemo(
    () => {
      const txs = doPeriodo(periodos.atual)
      const hoje = toDateOnly(new Date())
      const prev = previstoDe(periodos.atual)
      return {
        // Conta folha zerada não ocupa linha; total nunca some.
        atual: montarDre(txs).filter((l) => l.tipo !== 'conta' || l.valor !== 0),
        anterior: new Map(montarDre(doPeriodo(periodos.anterior)).map((l) => [l.id, l.valor])),
        // Despesa lançada para depois de hoje ainda não aconteceu.
        temPrevisto: txs.some((t) => t.status !== 'settled' && dataDoRegime(t) > hoje),
        previsto: montarDre(prev),
        previstos: prev,
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, parcelas, periodos],
  )
  const valorDe = (id: string) => atual.find((l) => l.id === id)?.valor ?? 0
  const linhaDe = (id: string) => atual.find((l) => l.id === id)!

  const bruta = valorDe('bruta')
  const liquido = valorDe('liquido')
  const saiu = -(valorDe('impostos') + valorDe('corretores') + valorDe('despesas'))
  const distribuicao = -valorDe('distribuicao')

  const previstoDe_ = (id: string) => previsto.find((l) => l.id === id)?.valor ?? 0
  const previstoBruta = previstoDe_('bruta')
  const previstoBruto = previstoDe_('bruto')

  /* ------------------------------------------------------------ abrir */

  const frase = (t: Transaction) => {
    if (t.status === 'settled') {
      const d = t.settled_date ?? t.competence_date
      return `${dreGroupOf(t) === 'revenue' ? 'recebido' : 'pago'} em ${formatDate(d)}`
    }
    return `previsto para ${formatDate(t.due_date ?? t.competence_date)}`
  }

  /** A linha aberta nos lançamentos do período; receita positiva, o resto negativo, como na conta. */
  const abrirLinha = (l: LinhaDoDre, p: PeriodoDre, total: number, deOnde = doPeriodo) => {
    const nome = l.rotulo.replace('(−) ', '')
    abrir({
      rotulo: nome,
      titulo: `${nome} · ${p.rotulo}`,
      explica: l.explica,
      total,
      itens: deOnde(p)
        .filter((t) => l.contas.includes(contaDoDre(t)))
        .sort((a, b) => dataDoRegime(a).localeCompare(dataDoRegime(b)))
        .map((t) => ({
          id: t.id,
          titulo: t.description || t.category,
          meta: `${frase(t)} · ${t.category}`,
          valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
          para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
        })),
      vazio: 'Nenhum lançamento neste período.',
    })
  }

  /** O que saiu (impostos + corretores + despesas) como uma linha só, para o apoio do herói. */
  const linhaSaiu: LinhaDoDre = {
    id: 'saiu',
    rotulo: 'Saiu',
    tipo: 'grupo',
    valor: -saiu,
    contas: ['impostos', 'corretores', 'gestao', 'comerciais', 'administrativas', 'pessoal'],
    explica: 'Impostos sobre o faturamento, comissão dos corretores e despesas da imobiliária no período.',
  }

  /** O que a previsão deixa para a imobiliária: receita − impostos − corretores − gestão. */
  const linhaPrevistaCusto: LinhaDoDre = {
    id: 'previsto-custo',
    rotulo: 'Impostos, corretores e gestão',
    tipo: 'grupo',
    valor: previstoBruto - previstoBruta,
    contas: ['impostos', 'corretores', 'gestao'],
    explica: 'O que vai sair de cada parcela prevista quando ela ficar devida.',
  }

  /* ------------------------------------------------------------ texto */

  const sobraDe100 = bruta > 0 ? Math.max(0, (liquido / bruta) * 100) : null
  const rotuloLider = `Lucro líquido · ${periodos.atual.rotulo}${temPrevisto ? ' · inclui o previsto' : ''}`

  /* De cada real faturado: o que ficou (marinho, o dado principal) e para onde foi o resto. */
  const partes = [
    { nome: 'Lucro líquido', valor: Math.max(0, liquido), cor: 'var(--g-entra)' },
    { nome: 'Corretores e gestão', valor: -valorDe('corretores'), cor: 'var(--t2)' },
    { nome: 'Despesas operacionais', valor: -valorDe('despesas'), cor: 'var(--t4)' },
    { nome: 'Impostos', valor: -valorDe('impostos'), cor: 'var(--g-sai)' },
  ]

  const fraseDoTitulo = (
    <>
      <b>
        <Valor valor={liquido} posto="fato" tinta={liquido < 0 ? 'text-error-ink' : 'text-t1'} /> de lucro líquido
      </b>{' '}
      em {periodos.atual.rotulo}
      {sobraDe100 != null ? (
        <>
          {' · '}de cada R$ 100,00 faturados, sobraram <Valor valor={sobraDe100} posto="fato" tinta="text-t1" />
        </>
      ) : (
        ' · nenhuma comissão ficou devida neste período'
      )}
    </>
  )

  /* --------------------------------------------------- comparação */

  const comparar = [
    { id: 'bruta', rotulo: 'Faturamento', custo: false },
    { id: 'liquido', rotulo: 'Lucro líquido', custo: false },
    { id: 'despesas', rotulo: 'Despesas da imobiliária', custo: true },
  ]

  return (
    <PageLayout
      subtitulo={fraseDoTitulo}
      faixa={<FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />}
      acoes={
        <ExportarRelatorio
          nome={`DRE ${periodos.atual.rotulo}`}
          planilha={() => ({
            cabecalho: ['DRE', periodos.atual.rotulo, '% da receita', periodos.anterior.rotulo],
            linhas: [
              ...atual.map((l) => [
                l.tipo === 'conta' ? `   ${l.rotulo}` : l.rotulo,
                l.valor,
                bruta ? Math.round((l.valor / bruta) * 10000) / 100 : null,
                anterior.get(l.id) ?? 0,
              ]),
              ...(previstos.length > 0
                ? [
                    [],
                    ['Previsto, ainda não devido (fora do resultado)'],
                    ['Comissão prevista', previstoBruta],
                    ['Impostos, corretores e gestão', previstoBruto - previstoBruta],
                    ['Fica para a imobiliária', previstoBruto],
                  ]
                : []),
            ],
          })}
        />
      }
    >
      {/*
       * Período com parcela que ainda não ficou devida inclui previsão: o
       * rótulo do líder diz "inclui o previsto" (regra de 13/09). O líder é
       * tinta, nunca ouro.
       */}
      <FaixaDeMetricas
        rotuloAcessivel={`DRE de ${periodos.atual.rotulo}`}
        metricas={[
          {
            rotulo: rotuloLider,
            valor: liquido,
            lider: true,
            estado: liquido < 0 ? 'negativo' : undefined,
            nota: `${periodos.anterior.rotulo}: ${variacaoEmPalavras(liquido, anterior.get('liquido') ?? 0)}`,
            aoClicar: () => abrirLinha(linhaDe('liquido'), periodos.atual, liquido),
          },
          {
            rotulo: 'Entrou',
            valor: bruta,
            nota: 'faturamento devido',
            aoClicar: bruta !== 0 ? () => abrirLinha(linhaDe('bruta'), periodos.atual, bruta) : undefined,
          },
          {
            rotulo: 'Saiu',
            valor: -saiu,
            nota: 'impostos, corretores e despesas',
            aoClicar: saiu !== 0 ? () => abrirLinha(linhaSaiu, periodos.atual, -saiu) : undefined,
          },
          {
            rotulo: 'Retirado pelo sócio',
            valor: -distribuicao,
            nota: 'fora do lucro',
            aoClicar: distribuicao !== 0 ? () => abrirLinha(linhaDe('distribuicao'), periodos.atual, -distribuicao) : undefined,
          },
        ]}
      />

      <div className="grid items-start gap-bloco xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao>
          <Cartao.Cabecalho
            titulo="Como chegamos nesse número"
            meta="a comissão conta quando fica devida (gatilho e nota), não quando o dinheiro cai"
          />
          <ContaDoRelatorio
            linhas={atual}
            base={bruta}
            emPalavras={EM_PALAVRAS}
            aoAbrir={(l) => abrirLinha(l, periodos.atual, l.valor)}
            rotuloAcessivel={`DRE de ${periodos.atual.rotulo}`}
            rotuloAtual={periodos.atual.rotulo}
            comparar={{ rotulo: periodos.anterior.rotulo, valores: anterior }}
          />
        </Cartao>

        <div className="grid items-start gap-bloco md:max-xl:grid-cols-2">
          {bruta > 0 && (
            <Cartao>
              <Cartao.Cabecalho
                titulo="Para onde foi o faturamento"
                meta={
                  <>
                    os <Valor valor={bruta} posto="fato" /> de {periodos.atual.rotulo}
                  </>
                }
              />
              <Cartao.Corpo>
                <Regua
                  partes={partes}
                  rotuloAcessivel={`Do faturamento de ${formatCurrency(bruta)}: ${partes.map((p) => `${p.nome.toLowerCase()} ${formatCurrency(p.valor)}`).join(', ')}.`}
                />
              </Cartao.Corpo>
              <PartesDaRegua partes={partes} rotuloAcessivel="As partes do faturamento" />
            </Cartao>
          )}

          <Cartao>
            <Cartao.Cabecalho titulo={`Comparado com ${periodos.anterior.rotulo}`} meta="o mesmo período, um antes" />
            <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Comparação com o período anterior">
              {comparar.map((c) => {
                const agora = valorDe(c.id)
                const antes = anterior.get(c.id) ?? 0
                return (
                  <Linha
                    key={c.id}
                    titulo={c.rotulo}
                    meta={`${periodos.anterior.rotulo}: ${formatCurrency(antes)} · ${variacaoEmPalavras(agora, antes, c.custo)}`}
                    valor={<Valor valor={agora} posto="linha" estado={agora < 0 ? 'negativo' : undefined} />}
                    aoClicar={() => abrirLinha(linhaDe(c.id), periodos.anterior, antes)}
                  />
                )
              })}
            </Cartao.Lista>
          </Cartao>

          {previstos.length > 0 && (
            <Cartao>
              <Cartao.Cabecalho titulo="Previsto, ainda não devido" meta="espera o gatilho ou a nota; não entra no lucro" />
              <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Previsto, ainda não devido">
                <Linha
                  titulo="Comissão prevista"
                  meta="a parte da imobiliária nas parcelas"
                  valor={<Valor valor={previstoBruta} posto="linha" previsto />}
                  aoClicar={() => abrirLinha({ ...previsto.find((l) => l.id === 'bruta')!, rotulo: 'Comissão prevista' }, periodos.atual, previstoBruta, previstoDe)}
                />
                <Linha
                  titulo="Impostos, corretores e gestão"
                  meta="o que sai delas quando ficarem devidas"
                  valor={<Valor valor={previstoBruto - previstoBruta} posto="linha" previsto />}
                  aoClicar={() => abrirLinha(linhaPrevistaCusto, periodos.atual, previstoBruto - previstoBruta, previstoDe)}
                />
                <Linha
                  titulo="Fica para a imobiliária"
                  meta="antes das despesas"
                  valor={<Valor valor={previstoBruto} posto="linha" previsto />}
                  aoClicar={() => abrirLinha({ ...previsto.find((l) => l.id === 'bruto')!, rotulo: 'Fica para a imobiliária' }, periodos.atual, previstoBruto, previstoDe)}
                />
              </Cartao.Lista>
            </Cartao>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
