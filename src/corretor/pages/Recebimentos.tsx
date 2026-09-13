import { Fragment, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, CalendarDays, CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { useCorretor, type CorretorParcela } from '../CorretorData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { ProximaAcao } from '@/components/shared/ProximaAcao'
import { Heroi } from '@/components/ui/Assinatura'
import { Painel, PainelTitulo } from '@/components/ui/Painel'
import { Rotulo } from '@/components/ui/Rotulo'
import { SubtotalDuplo } from '@/components/ui/Secao'
import { Lista, Linha, LinhaDeHoje } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Trilha, LegendaTrilha } from '@/components/ui/Trilha'
import { FiltrosRapidos, type FiltroRapido } from '@/components/ui/FiltrosRapidos'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro, EstadoVazio, EsqueletoLista } from '@/components/ui/Estados'
import { diasEntre, fraseDeTempo, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDate, parseDateOnly, toDateOnly } from '@/lib/format'

/*
 * O CRONOGRAMA — cada recebimento, de qual venda vem, em que situação está.
 *
 * O herói é "A receber agora", e é só o LIBERADO: o que a imobiliária já
 * recebeu e ainda não repassou. É o mesmo número do herói do Início, de
 * propósito — se as duas telas respondessem a mesma pergunta com números
 * diferentes, nenhuma das duas serviria para conferir nada.
 *
 * Previsão não entra nesse número em lugar nenhum. Ela aparece no cronograma,
 * com a palavra e a frase que dizem de quem ela depende, e nos subtotais de mês
 * — sempre na segunda parcela do subtotal, nunca somada à primeira.
 *
 * A tela anterior somava tudo num total único no topo ("16 parcelas ·
 * R$ 24.312,80"), misturando o que é dele com o que é promessa da construtora,
 * e esse total ainda mudava com o filtro. Um número que muda de significado
 * conforme o botão apertado não é um número: é uma impressão.
 *
 * No Souza OS a tela ganha o quadro da casa: cabeçalho com o resumo vivo e os
 * filtros fixos junto dele (no celular, com o polegar, a lista é longa e o
 * filtro não pode ficar lá em cima), o herói dourado, a próxima ação e o
 * cronograma num painel só, agrupado por mês.
 */

/** Arredonda em centavos — a diferença de R$ 0,04 é o que trava uma conferência. */
const c2 = (n: number) => Math.round(n * 100) / 100

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

type Filtro = 'tudo' | 'atrasadas' | 'aReceber' | 'previstas' | 'recebidas'

/*
 * O filtro mora na URL (`?foco=`), e não num estado solto: o Início aponta para
 * cá já filtrado ("2 parcelas a receber" abre só as duas), e recarregar a
 * página não devolve a lista inteira a quem estava olhando as atrasadas.
 */
const FOCO_NA_URL: Record<Exclude<Filtro, 'tudo'>, string> = {
  atrasadas: 'atrasadas',
  aReceber: 'a-receber',
  previstas: 'previstas',
  recebidas: 'recebidas',
}

function filtroDaUrl(valor: string | null): Filtro {
  const achado = (Object.keys(FOCO_NA_URL) as Exclude<Filtro, 'tudo'>[]).find((k) => FOCO_NA_URL[k] === valor)
  return achado ?? 'tudo'
}

/*
 * "A receber" significa exatamente o que significa no chip da parcela: a
 * imobiliária recebeu e deve a ele, atrasada ou não. Previsão não entra nele —
 * ela tem filtro próprio, com a palavra que diz de quem depende.
 */
function passa(filtro: Filtro, s: Situacao): boolean {
  if (filtro === 'atrasadas') return s === 'vencida'
  if (filtro === 'aReceber') return s === 'liberada' || s === 'vencida'
  if (filtro === 'previstas') return s === 'prevista'
  if (filtro === 'recebidas') return s === 'recebida'
  return true
}

/*
 * A cor do VALOR na linha. Só entra com estado real (seção 9), e previsto nunca
 * recebe tônica: é a ausência de cor que diz que ainda não é dinheiro.
 *
 * Mora aqui, e não em VOCABULARIO[s].tinta, porque aquela tabela ainda escreve
 * os nomes de cor da paleta anterior, que vão ser apagados.
 */
const TINTA: Record<Situacao, string | undefined> = {
  prevista: 'text-t3',
  liberada: undefined,
  vencida: 'text-error',
  recebida: 'text-success',
  cancelada: 'text-t4 line-through',
}

interface Item {
  p: CorretorParcela
  s: Situacao
  /** A data que põe a parcela na linha do tempo. */
  quando: string
}

export function Recebimentos() {
  const { parcelas, carregando, erro, recarregar } = useCorretor()
  const { abrir } = useComposicao()
  const [params, setParams] = useSearchParams()
  const filtro = filtroDaUrl(params.get('foco'))
  const cronograma = useRef<HTMLDivElement>(null)
  const hoje = toDateOnly(new Date())

  const setFiltro = useCallback(
    (f: Filtro) => {
      setParams(
        (atual) => {
          const p = new URLSearchParams(atual)
          if (f === 'tudo') p.delete('foco')
          else p.set('foco', FOCO_NA_URL[f])
          return p
        },
        // Trocar de filtro não é navegar: cinco toques nas pílulas não podem
        // virar cinco toques em "voltar".
        { replace: true },
      )
    },
    [setParams],
  )

  /*
   * A parcela recebida se posiciona pela data em que FOI PAGA, não pela data em
   * que se esperava que fosse: ele confere isto contra o extrato do banco, e no
   * extrato o que existe é o dia do crédito.
   */
  const todas = useMemo<Item[]>(
    () =>
      parcelas.map((p) => {
        const s = situacaoDeTela(p.status, p.expected_date, hoje)
        return { p, s, quando: s === 'recebida' ? p.paid_date ?? p.expected_date : p.expected_date }
      }),
    [parcelas, hoje],
  )

  /*
   * O filtro muda o cronograma, NUNCA o herói. "A receber agora" é a resposta da
   * tela e não pode depender de qual botão está apertado.
   */
  const lista = useMemo(() => todas.filter(({ s }) => passa(filtro, s)), [todas, filtro])

  const meses = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of lista) {
      const chave = it.quando.slice(0, 7)
      const ja = m.get(chave)
      if (ja) ja.push(it)
      else m.set(chave, [it])
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([mes, itens]) => ({
        mes,
        itens: [...itens].sort((a, b) => (a.quando === b.quando ? a.p.idx - b.p.idx : a.quando < b.quando ? -1 : 1)),
      }))
  }, [lista])

  const quadro = (conteudo: ReactNode, subtitulo?: ReactNode, faixa?: ReactNode) => (
    <PageLayout icone={CalendarDays} tom="info" titulo="Recebimentos" subtitulo={subtitulo} faixa={faixa}>
      {conteudo}
    </PageLayout>
  )

  /*
   * Os três estados, nesta precedência: carregando, falhou, vazio. A casca já
   * cobre os dois primeiros antes de montar a tela; eles estão aqui também para
   * que uma falha nunca chegue a esta lista dizendo "nenhum recebimento".
   */
  if (carregando) {
    return quadro(
      <div className="space-y-5">
        <Esqueleto className="h-44 rounded-[18px]" />
        <EsqueletoLista linhas={6} />
      </div>,
      'Carregando o cronograma…',
    )
  }
  if (erro) {
    return quadro(
      <Painel>
        <EstadoErro motivo={erro} aoTentarDeNovo={() => void recarregar()} />
      </Painel>,
    )
  }
  if (parcelas.length === 0) {
    return quadro(
      <Painel>
        <EstadoVazio
          icone={CalendarDays}
          titulo="Nenhum recebimento ainda"
          descricao="Quando a imobiliária registrar uma venda sua, o cronograma da comissão aparece aqui, parcela por parcela."
        />
      </Painel>,
      'Nenhuma parcela no cronograma',
    )
  }

  const liberadas = todas.filter(({ s }) => s === 'liberada' || s === 'vencida')
  const atrasadas = todas.filter(({ s }) => s === 'vencida')
  const recebidas = todas.filter(({ s }) => s === 'recebida')
  const previstas = todas.filter(({ s }) => s === 'prevista')

  const soma = (l: Item[]) => c2(l.reduce((t, { p }) => t + p.broker_amount - p.broker_adjustment, 0))

  /** Uma parcela virando item de composição, com a venda de origem. */
  const item = ({ p, s }: Item) => ({
    id: p.id,
    titulo: p.sale_title,
    meta: [
      p.development,
      fraseDeTempo(s, { prevista: p.expected_date, liberada: p.received_date, recebida: p.paid_date }),
    ]
      .filter(Boolean)
      .join(' · '),
    valor: c2(p.broker_amount - p.broker_adjustment),
    situacao: s,
    idx: p.idx,
    count: p.count,
    para: `/minhas-vendas?venda=${p.sale_id}`,
  })

  /*
   * Filtrar a partir da próxima ação leva o olho junto: a lista está abaixo do
   * herói, e uma pílula mudando no cabeçalho não diz sozinha que a lista mudou.
   * Sem `smooth`: a tela só está indo onde ele pediu.
   */
  const mostrar = (f: Filtro) => {
    setFiltro(f)
    requestAnimationFrame(() => cronograma.current?.scrollIntoView({ block: 'start' }))
  }

  /*
   * Onde cai a linha de hoje: no primeiro mês que tem parcela de hoje em diante,
   * e só se houver passado antes dela. Sem passado não há fronteira para marcar.
   */
  const temPassado = lista.some((it) => it.quando < hoje)
  const mesDoMarco = temPassado ? meses.find((g) => g.itens.some((it) => it.quando >= hoje))?.mes : undefined

  const subtitulo = [
    liberadas.length > 0 ? `${formatCurrency(soma(liberadas))} a receber agora` : 'Nada liberado agora',
    atrasadas.length > 0 ? plural(atrasadas.length, 'atrasada', 'atrasadas') : null,
    `${plural(parcelas.length, 'parcela', 'parcelas')} no cronograma`,
  ]
    .filter(Boolean)
    .join(' · ')

  const filtros: FiltroRapido<Filtro>[] = [
    { id: 'tudo', rotulo: 'Tudo', contador: todas.length },
    {
      id: 'atrasadas',
      rotulo: 'Atrasadas',
      icone: TriangleAlert,
      contador: atrasadas.length,
      dica: 'A imobiliária já recebeu e ainda não repassou',
    },
    {
      id: 'aReceber',
      rotulo: 'A receber',
      icone: Clock,
      contador: liberadas.length,
      dica: 'A imobiliária já recebeu; é dinheiro seu esperando o repasse',
    },
    {
      id: 'previstas',
      rotulo: 'Previstas',
      icone: CalendarClock,
      contador: previstas.length,
      dica: 'Dependem da construtora pagar a imobiliária primeiro',
    },
    { id: 'recebidas', rotulo: 'Recebidas', icone: CircleCheck, contador: recebidas.length },
  ]

  /*
   * A próxima ação, só com o que os dados observaram, na ordem da casa: o que
   * está atrasado, depois o que está a receber. Sem nada pendente, a tela diz
   * que está tudo em dia e aponta a próxima parcela prevista — com a palavra
   * que diz de quem ela depende, porque previsão não é promessa.
   */
  const esperaMaisAntiga = atrasadas.reduce(
    (max, { p }) => Math.max(max, diasEntre(p.received_date ?? p.expected_date, hoje)),
    0,
  )
  const proximaPrevista = previstas
    .filter(({ p }) => p.expected_date >= hoje)
    .sort((a, b) => (a.p.expected_date < b.p.expected_date ? -1 : 1))[0]
  const soAtrasadas = atrasadas.length === liberadas.length

  const principal =
    atrasadas.length > 0
      ? {
          tom: 'risco' as const,
          icone: TriangleAlert,
          titulo: atrasadas.length === 1 ? 'Uma comissão atrasada' : `${atrasadas.length} comissões atrasadas`,
          porque: `A imobiliária já recebeu ${formatCurrency(soma(atrasadas))} da construtora e ainda não repassou${
            esperaMaisAntiga > 0
              ? `; a mais antiga espera há ${plural(esperaMaisAntiga, 'dia', 'dias')}`
              : ''
          }. Vale um lembrete para a imobiliária.`,
          acao: { rotulo: 'Mostrar as atrasadas', aoClicar: () => mostrar('atrasadas') },
        }
      : liberadas.length > 0
        ? {
            tom: 'atencao' as const,
            icone: Clock,
            titulo: `${formatCurrency(soma(liberadas))} esperando o repasse`,
            porque:
              'A imobiliária já recebeu estas parcelas da construtora. É dinheiro seu; o próximo passo é o repasse.',
            acao: { rotulo: 'Mostrar o que está a receber', aoClicar: () => mostrar('aReceber') },
          }
        : undefined

  const outras =
    atrasadas.length > 0 && !soAtrasadas
      ? [
          {
            id: 'a-receber',
            rotulo: `${plural(liberadas.length - atrasadas.length, 'outra', 'outras')} a receber`,
            porque: 'Liberadas pela imobiliária e ainda dentro da data prevista.',
            tom: 'atencao' as const,
            aoClicar: () => mostrar('aReceber'),
          },
        ]
      : undefined

  const tudoEmDia = {
    titulo: 'Tudo em dia',
    sugestao: proximaPrevista
      ? `Nada liberado agora. A próxima parcela prevista é de ${proximaPrevista.p.sale_title}, para ${formatDate(
          proximaPrevista.p.expected_date,
        )}, e depende da construtora pagar a imobiliária primeiro.`
      : 'Nenhuma parcela sua está pendente. Quando a imobiliária registrar uma venda nova, o cronograma aparece aqui.',
  }

  const vazioDoFiltro: Record<Filtro, string> = {
    tudo: 'Nenhuma parcela no cronograma.',
    atrasadas:
      'Nenhuma comissão atrasada. Atraso aqui é só o que a imobiliária já recebeu e ainda não repassou.',
    aReceber: 'Nenhuma parcela liberada agora. As previstas continuam em "Previstas".',
    previstas: 'Nenhuma parcela esperando a construtora.',
    recebidas:
      'Você ainda não recebeu nenhuma comissão. Assim que a imobiliária pagar, a parcela aparece aqui com a data.',
  }

  // A regra que a tela não mostra sozinha (princípio 11), só quando há na lista
  // uma parcela que ela explica.
  const precisaDaRegra = lista.some(({ s }) => s === 'prevista' || s === 'vencida')

  return quadro(
    <div className="space-y-5">
      <Heroi
        rotulo="A receber agora"
        contexto={
          liberadas.length > 0 ? (
            <>
              A imobiliária já recebeu estas parcelas. É dinheiro seu, esperando o repasse.{' '}
              {atrasadas.length > 0 &&
                `${atrasadas.length === 1 ? 'Uma delas já passou' : `${atrasadas.length} delas já passaram`} da data prevista — vale um lembrete.`}
            </>
          ) : (
            'Nada liberado no momento. Quando a construtora pagar uma parcela, sua comissão aparece aqui.'
          )
        }
        rodape={
          <>
            <dl className="grid gap-y-1 sm:grid-cols-3 sm:gap-x-6">
              <Apoio rotulo="Atrasada">
                {atrasadas.length > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    {/* Número vermelho só com estado real, e nunca sem ícone junto. */}
                    <TriangleAlert size={14} strokeWidth={1.6} className="shrink-0 text-error" aria-hidden />
                    <ValorComOrigem
                      valor={soma(atrasadas)}
                      tinta="text-error"
                      rotuloAcessivel="Ver quais comissões estão atrasadas"
                      aoAbrir={() =>
                        abrir({
                          rotulo: 'Atrasada',
                          titulo: 'O que a imobiliária recebeu e não repassou',
                          explica:
                            'Atraso aqui é só o que a imobiliária já recebeu da construtora. Parcela que a construtora não pagou é espera, não atraso.',
                          total: soma(atrasadas),
                          itens: atrasadas.map(item),
                        })
                      }
                    />
                  </span>
                ) : (
                  <Valor valor={0} tinta="text-t3" />
                )}
              </Apoio>
              <Apoio rotulo="Já recebida">
                {recebidas.length > 0 ? (
                  <ValorComOrigem
                    valor={soma(recebidas)}
                    className="sm:-ml-2"
                    rotuloAcessivel="Ver quais parcelas você já recebeu"
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Já recebida',
                        titulo: 'O que já caiu para você',
                        total: soma(recebidas),
                        itens: recebidas.map(item),
                      })
                    }
                  />
                ) : (
                  <Valor valor={0} tinta="text-t3" />
                )}
              </Apoio>
              <Apoio rotulo="Prevista">
                {previstas.length > 0 ? (
                  <ValorComOrigem
                    valor={soma(previstas)}
                    tinta="text-t3"
                    className="sm:-ml-2"
                    rotuloAcessivel="Ver quais parcelas estão previstas"
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Prevista',
                        titulo: 'Previsão, não promessa',
                        explica:
                          'Estas parcelas só viram comissão sua quando a construtora pagar a imobiliária. A data pode mudar.',
                        total: soma(previstas),
                        itens: previstas.map(item),
                      })
                    }
                  />
                ) : (
                  <Valor valor={0} tinta="text-t3" />
                )}
              </Apoio>
            </dl>
            <div className="mt-4 space-y-2">
              <Trilha
                recebido={soma(recebidas)}
                liberado={soma(liberadas)}
                previsto={soma(previstas)}
                rotuloAcessivel={`No cronograma: ${formatCurrency(soma(recebidas))} recebido, ${formatCurrency(
                  soma(liberadas),
                )} liberado a receber e ${formatCurrency(soma(previstas))} dependendo da construtora.`}
              />
              <LegendaTrilha />
            </div>
          </>
        }
      >
        {liberadas.length > 0 ? (
          <ValorComOrigem
            valor={soma(liberadas)}
            posto="heroi"
            tinta="text-brand-text"
            contar
            rotuloAcessivel="Ver de quais vendas vem o valor a receber"
            aoAbrir={() =>
              abrir({
                rotulo: 'A receber agora',
                titulo: 'De quais vendas vem',
                explica: 'Parcelas que a imobiliária já recebeu. Sua comissão está liberada para pagamento.',
                total: soma(liberadas),
                itens: liberadas.map(item),
              })
            }
          />
        ) : (
          <Valor valor={0} posto="heroi" tinta="text-t3" />
        )}
      </Heroi>

      <ProximaAcao principal={principal} outras={outras} tudoEmDia={tudoEmDia} />

      {/* scroll-mt: o cabeçalho fixo, com os filtros, não pode cobrir o título do cronograma. */}
      <div ref={cronograma} className="scroll-mt-44">
        <Painel>
          <PainelTitulo
            titulo="Cronograma"
            icone={CalendarDays}
            descricao={filtro === 'tudo' ? 'toda parcela, mês a mês' : filtros.find((f) => f.id === filtro)?.rotulo}
            extra={
              <span className="text-xs text-t4 tabular-nums">{plural(lista.length, 'parcela', 'parcelas')}</span>
            }
          />

          {precisaDaRegra && (
            <div className="px-4 pb-3 sm:px-5">
              <Dica>
                Atrasada é só o que a imobiliária já recebeu e ainda não repassou. Parcela prevista depende da
                construtora pagar primeiro: se ela atrasar, é espera, não dívida.
              </Dica>
            </div>
          )}

          {meses.length === 0 ? (
            <div className="border-t border-line">
              <EstadoVazio
                icone={CalendarDays}
                titulo="Nada com esse filtro"
                descricao={vazioDoFiltro[filtro]}
                acao={
                  <Button variant="secondary" onClick={() => setFiltro('tudo')}>
                    Mostrar tudo
                  </Button>
                }
              />
            </div>
          ) : (
            meses.map((g) => {
              const nome = parseDateOnly(`${g.mes}-01`).toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })
              // "Agora" é só o que já é dinheiro: pago a ele ou liberado. Previsão
              // vai no segundo número; cancelada não entra em nenhum dos dois.
              const existe = g.itens.filter(({ s }) => s === 'recebida' || s === 'liberada' || s === 'vencida')
              const promessa = g.itens.filter(({ s }) => s === 'prevista')
              const corte = g.mes === mesDoMarco ? g.itens.findIndex((it) => it.quando >= hoje) : -1
              return (
                <section key={g.mes} aria-label={nome}>
                  {/*
                   * O rótulo do mês uma vez só, com o contador, e o subtotal
                   * em DOIS números, nunca um: um total único de mês somaria o
                   * que é dele com o que a construtora ainda não pagou — e é
                   * essa soma que fazia uma previsão parecer dinheiro em caixa.
                   */}
                  <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-line bg-s3/20 px-4 py-2.5 sm:px-5">
                    <Rotulo as="h3">
                      {nome}
                      <span aria-hidden className="px-1.5 text-t5">
                        ·
                      </span>
                      {plural(g.itens.length, 'parcela', 'parcelas')}
                    </Rotulo>
                    <SubtotalDuplo
                      agora={<Valor valor={soma(existe)} posto="fato" />}
                      previsto={<Valor valor={soma(promessa)} posto="fato" tinta="text-t3" />}
                    />
                  </header>
                  <Lista>
                    {g.itens.map((it, i) => (
                      <Fragment key={it.p.id}>
                        {i === corte && <LinhaDeHoje />}
                        <ParcelaNoCronograma it={it} />
                      </Fragment>
                    ))}
                  </Lista>
                </section>
              )
            })
          )}
        </Painel>
      </div>
    </div>,
    subtitulo,
    <FiltrosRapidos
      filtros={filtros}
      ativo={filtro}
      aoMudar={setFiltro}
      rotuloAcessivel="O que mostrar no cronograma"
    />,
  )
}

/**
 * Um número de apoio do herói. No celular lê como linha de extrato (rótulo à
 * esquerda, valor à direita), porque três colunas de R$ não cabem em 390px sem
 * cortar centavo; do `sm` em diante vira coluna, rótulo sobre o número.
 */
function Apoio({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-toque min-w-0 items-center justify-between gap-3 sm:block sm:min-h-0">
      <Rotulo as="dt">{rotulo}</Rotulo>
      <dd className="sm:mt-1">{children}</dd>
    </div>
  )
}

/**
 * Uma parcela na linha do tempo.
 *
 * Os sinais, todos: o selo com o ORDINAL REAL na goteira (o "3" de 3/9), a
 * palavra no chip — em perfil corretor, porque "Liberada" não existe no
 * vocabulário dele —, a frase com verbo e tempo, e só então a cor. Em preto e
 * branco, no sol, a linha continua legível.
 *
 * O valor pousa na mesma borda direita de todas as outras, no mesmo degrau: é
 * assim que 16 parcelas de R$ 201,61 a R$ 2.692,89 passam a ser comparadas por
 * contagem de dígitos, sem leitura.
 *
 * E toda parcela abre a venda de origem: "R$ 1.240,00 em outubro" sem saber de
 * qual venda vem não serve para conferir nada.
 */
function ParcelaNoCronograma({ it }: { it: Item }) {
  const { p, s } = it
  return (
    <Linha
      selo={<Selo situacao={s} idx={p.idx} count={p.count} />}
      titulo={p.sale_title}
      meta={
        <>
          {p.count > 1 && (
            <>
              parcela {p.idx}/{p.count}
              <span aria-hidden className="px-1.5 text-t5">
                ·
              </span>
            </>
          )}
          <FraseDeTempo
            situacao={s}
            prevista={p.expected_date}
            liberada={p.received_date}
            recebida={p.paid_date}
          />
        </>
      }
      situacao={<ChipSituacao situacao={s} perfil="corretor" />}
      valor={<Valor valor={c2(p.broker_amount - p.broker_adjustment)} posto="linha" tinta={TINTA[s]} />}
      para={`/minhas-vendas?venda=${p.sale_id}`}
    />
  )
}
