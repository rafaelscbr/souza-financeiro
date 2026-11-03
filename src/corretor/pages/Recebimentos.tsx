import { Fragment, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Clock,
  HandCoins,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useCorretor, type CorretorParcela } from '../CorretorData'
import { ChipDaParcela, FraseDaParcela, ICONE_DA_ETAPA, TOM_DA_ETAPA, fraseDaParcela } from '../EtapaDaParcela'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { ListaDeAcoes, type ItemDeAcao } from '@/components/ui/ListaDeAcoes'
import { GraficoAnoEmBarras } from '@/components/graficos/GraficoAnoEmBarras'
import { IconeTom } from '@/components/ui/IconeTom'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { ParAgoraPrevisto } from '@/components/ui/ParAgoraPrevisto'
import { Selo } from '@/components/ui/Selo'
import { FiltrosRapidos, type FiltroRapido } from '@/components/ui/FiltrosRapidos'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio, EsqueletoLista } from '@/components/ui/Estados'
import { diasEntre, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { ETAPA_DO_CORRETOR, etapaDoCorretor, type EtapaDoCorretor } from '@/lib/etapas'
import { formatCurrency, formatDate, parseDateOnly, toDateOnly } from '@/lib/format'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/*
 * O ANO EM BARRAS (Souza 3.0, 02/11/2026; antes, o calendário de 21/09/2026,
 * pedido do Rafael: "melhorar a visualização de recebimento do corretor").
 *
 * Doze colunas, uma por mês, empilhadas no que já caiu (marinho), no que está
 * liberado (tinta) e no que é previsão (cinza). Mês vazio continua desenhado:
 * buraco no cronograma é informação. Tocar num mês abre as parcelas dele.
 */
function AnoEmBarras({
  ano,
  itens,
  legenda,
  aoAbrirMes,
}: {
  ano: number
  itens: Item[]
  legenda: boolean
  aoAbrirMes: (nome: string, itens: Item[]) => void
}) {
  const meses = MESES_CURTOS.map((rotulo, i) => {
    const chave = `${ano}-${String(i + 1).padStart(2, '0')}`
    const doMes = itens.filter((it) => it.quando.slice(0, 7) === chave)
    const por = (fn: (s: Situacao) => boolean) =>
      c2(doMes.filter(({ s }) => fn(s)).reduce((t, { p }) => t + p.broker_amount - p.broker_adjustment, 0))
    return {
      chave,
      rotulo,
      nome: `${MESES_LONGOS[i]} de ${ano}`,
      itens: doMes,
      recebida: por((s) => s === 'recebida'),
      liberada: por((s) => s === 'liberada' || s === 'vencida'),
      prevista: por((s) => s === 'prevista'),
    }
  })
  const totalDoAno = c2(itens.reduce((t, { p }) => t + p.broker_amount - p.broker_adjustment, 0))

  return (
    <Cartao rotuloAcessivel={`Sua comissão mês a mês em ${ano}`}>
      <Cartao.Cabecalho
        titulo={`Sua comissão em ${ano}`}
        meta={`${formatCurrency(totalDoAno)} no ano, mês a mês`}
        extra={
          legenda ? (
            <span className="flex flex-wrap items-center gap-3 text-t-meta text-texto-meta">
              <LegendaPonto cor="var(--g-entra)" nome="Recebida" />
              <LegendaPonto cor="var(--t2)" nome="Liberada" />
              <LegendaPonto cor="var(--g-sai)" nome="Prevista" />
            </span>
          ) : undefined
        }
      />
      <Cartao.Corpo>
        <GraficoAnoEmBarras meses={meses} aoAbrir={(m) => aoAbrirMes(m.nome, m.itens)} />
      </Cartao.Corpo>
    </Cartao>
  )
}

function LegendaPonto({ cor, nome }: { cor: string; nome: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-ponto" style={{ background: cor }} />
      {nome}
    </span>
  )
}

/*
 * O CRONOGRAMA (9.8): cada recebimento, de qual venda vem, em que situação está.
 *
 * O herói é "A receber agora", e é só o LIBERADO: o que a imobiliária já
 * recebeu e ainda não repassou, o mesmo número do Início. Previsão não entra
 * nele: aparece no cronograma, com a palavra que diz de quem depende, e no
 * lado "previsto" do par de cada mês, nunca somada ao "agora".
 *
 * Os filtros moram na faixa do PageLayout, fora do cabeçalho fixo: rolam com
 * a lista. O filtro muda o cronograma, NUNCA o herói.
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

interface Item {
  p: CorretorParcela
  s: Situacao
  /** A data que põe a parcela na linha do tempo. */
  quando: string
}

export function Recebimentos() {
  const { parcelas, carregando, erro, recarregar, anosDisponiveis, setAno } = useCorretor()
  /*
   * O PERÍODO (21/09/2026, pedido do Rafael: "que o corretor veja TUDO que
   * tem para receber, filtrar por período").
   *
   * `tudo` mostra o cronograma inteiro, de qualquer ano — inclusive o que
   * vence lá na frente. Um ano específico recorta. O período muda a lista e
   * o calendário; NUNCA o herói, que continua respondendo "quanto é meu
   * agora", venha de que ano vier.
   */
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
        return {
          p,
          s,
          quando: s === 'recebida' ? (p.paid_date ?? p.expected_date) : p.expected_date,
        }
      }),
    [parcelas, hoje],
  )

  /*
   * O filtro muda o cronograma, NUNCA o herói. "A receber agora" é a resposta da
   * tela e não pode depender de qual botão está apertado.
   */
  /*
   * O PADRÃO É TUDO (22/09/2026): "tá puxando somente o ano de 2026, quero que
   * puxe o máximo que ele tem de recebimento para ele poder ver". Sem `?ano=`
   * na URL, o cronograma mostra todos os anos; um ano só existe quando ele
   * escolhe um. Antes era o contrário, e a parcela de 2027 ficava escondida
   * atrás de um filtro que ninguém sabia que estava ligado.
   */
  const periodo = params.get('ano') ?? 'tudo'
  const noPeriodo = useMemo(
    () => (periodo === 'tudo' ? todas : todas.filter((it) => it.quando.slice(0, 4) === periodo)),
    [todas, periodo],
  )
  const lista = useMemo(() => noPeriodo.filter(({ s }) => passa(filtro, s)), [noPeriodo, filtro])

  const trocarPeriodo = useCallback(
    (v: string) => {
      if (v !== 'tudo') setAno(Number(v))
      setParams(
        (atual) => {
          const p = new URLSearchParams(atual)
          if (v === 'tudo') p.delete('ano')
          else p.set('ano', v)
          return p
        },
        { replace: true },
      )
    },
    [setAno, setParams],
  )

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

  /*
   * Os anos que ganham calendário: os que têm parcela. Ano sem nada não vira
   * um cartão vazio, e o ano corrente aparece mesmo sem parcela — é onde ele
   * está olhando.
   */
  const anosDoCalendario = useMemo(() => {
    if (periodo !== 'tudo') return [Number(periodo)]
    const anos = new Set<number>([new Date().getFullYear()])
    for (const it of todas) anos.add(Number(it.quando.slice(0, 4)))
    return [...anos].sort((a, b) => a - b)
  }, [periodo, todas])

  const quadro = (conteudo: ReactNode, subtitulo?: ReactNode, faixa?: ReactNode) => (
    <PageLayout icone={CalendarDays} titulo="Recebimentos" subtitulo={subtitulo} faixa={faixa}>
      {conteudo}
    </PageLayout>
  )

  /*
   * Os três estados, nesta precedência: carregando, falhou, vazio. Uma falha
   * nunca chega a esta lista dizendo "nenhum recebimento".
   */
  if (carregando) return quadro(<EsqueletoLista linhas={6} />, 'Carregando o cronograma…')
  if (erro) {
    return quadro(
      <Cartao rotuloAcessivel="Cronograma">
        <EstadoErro motivo={erro} aoTentarDeNovo={() => void recarregar()} />
      </Cartao>,
    )
  }
  if (parcelas.length === 0) {
    return quadro(
      <Cartao rotuloAcessivel="Cronograma">
        <EstadoVazio
          icone={CalendarDays}
          titulo="Nenhum recebimento ainda"
          descricao="Quando a imobiliária registrar uma venda sua, o cronograma da comissão aparece aqui, parcela por parcela."
        />
      </Cartao>,
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
    meta: [p.is_personal ? 'pessoa física' : null, p.development, fraseDaParcela(p, s, hoje)]
      .filter(Boolean)
      .join(' · '),
    valor: c2(p.broker_amount - p.broker_adjustment),
    situacao: s,
    idx: p.idx,
    count: p.count,
    para: `/minhas-vendas?venda=${p.sale_id}`,
  })

  /* Filtrar a partir da próxima ação leva o olho junto até o cronograma. Sem `smooth`. */
  const mostrar = (f: Filtro) => {
    setFiltro(f)
    requestAnimationFrame(() => cronograma.current?.scrollIntoView({ block: 'start' }))
  }

  /* A linha de hoje: no primeiro mês com parcela de hoje em diante, só se houver passado antes. */
  const temPassado = lista.some((it) => it.quando < hoje)
  const mesDoMarco = temPassado ? meses.find((g) => g.itens.some((it) => it.quando >= hoje))?.mes : undefined

  /*
   * SOUZA 3.0 (02/11/2026): a frase do título diz o que está liberado para
   * ele; a faixa tem esse número como líder; o ano vira barras de 12 meses e
   * "o que fazer" e "em que pé está" formam a coluna ao lado.
   */
  const subtitulo = (
    <>
      <b>
        {liberadas.length > 0 ? (
          <>
            <Valor valor={soma(liberadas)} posto="fato" tinta="text-t1" /> liberados para você
          </>
        ) : (
          'Nada liberado agora'
        )}
      </b>
      {atrasadas.length > 0 && (
        <>
          {' · '}
          <span className="font-medium text-error-ink">{plural(atrasadas.length, 'atrasada', 'atrasadas')}</span>
        </>
      )}
      {` · ${plural(parcelas.length, 'parcela', 'parcelas')} no cronograma`}
    </>
  )

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
    {
      id: 'recebidas',
      rotulo: 'Recebidas',
      icone: CircleCheck,
      contador: recebidas.length,
    },
  ]

  /*
   * A próxima ação, só com o que os dados observaram: o que está atrasado,
   * depois o que está a receber. Sem nada pendente, "Tudo em dia" aponta a
   * próxima prevista, com a palavra que diz de quem ela depende.
   */
  const esperaMaisAntiga = atrasadas.reduce(
    (max, { p }) => Math.max(max, diasEntre(p.received_date ?? p.expected_date, hoje)),
    0,
  )
  const proximaPrevista = previstas
    .filter(({ p }) => p.expected_date >= hoje)
    .sort((a, b) => (a.p.expected_date < b.p.expected_date ? -1 : 1))[0]
  const soAtrasadas = atrasadas.length === liberadas.length

  const aReceberNoPrazo = liberadas.filter(({ s }) => s === 'liberada')
  const passos: ItemDeAcao[] = []
  if (atrasadas.length > 0) {
    passos.push({
      id: 'principal',
      titulo: atrasadas.length === 1 ? 'Uma comissão atrasada' : `${atrasadas.length} comissões atrasadas`,
      detalhe:
        esperaMaisAntiga > 0
          ? `a mais antiga há ${plural(esperaMaisAntiga, 'dia', 'dias')}`
          : 'a imobiliária recebeu e não repassou',
      valor: soma(atrasadas),
      tom: 'risco',
      acao: { rotulo: 'Ver', aoClicar: () => mostrar('atrasadas') },
    })
    if (!soAtrasadas)
      passos.push({
        id: 'a-receber',
        titulo: `${plural(aReceberNoPrazo.length, 'outra', 'outras')} a receber`,
        detalhe: 'liberadas e dentro da data prevista',
        valor: soma(aReceberNoPrazo),
        acao: { rotulo: 'Ver', aoClicar: () => mostrar('aReceber') },
      })
  } else if (liberadas.length > 0) {
    passos.push({
      id: 'principal',
      titulo: 'Esperando o repasse',
      detalhe: 'a imobiliária já recebeu da construtora',
      valor: soma(liberadas),
      acao: { rotulo: 'Ver', aoClicar: () => mostrar('aReceber') },
    })
  }
  if (proximaPrevista)
    passos.push({
      id: 'proxima',
      titulo: proximaPrevista.p.sale_title,
      detalhe: `próxima prevista · ${formatDate(proximaPrevista.p.expected_date)}`,
      valor: c2(proximaPrevista.p.broker_amount - proximaPrevista.p.broker_adjustment),
      para: `/minhas-vendas?venda=${proximaPrevista.p.sale_id}`,
    })

  const vazioDoFiltro: Record<Filtro, string> = {
    tudo: 'Nenhuma parcela no cronograma.',
    atrasadas: 'Nenhuma comissão atrasada. Atraso aqui é só o que a imobiliária já recebeu e ainda não repassou.',
    aReceber: 'Nenhuma parcela liberada agora. As previstas continuam em "Previstas".',
    previstas: 'Nenhuma parcela esperando a construtora.',
    recebidas:
      'Você ainda não recebeu nenhuma comissão. Assim que a imobiliária pagar, a parcela aparece aqui com a data.',
  }

  // A regra que a tela não mostra sozinha, só quando há na lista uma parcela que ela explica.
  const precisaDaRegra = lista.some(({ s }) => s === 'prevista' || s === 'vencida')

  const compor = (rotulo: string, titulo: string, itens: Item[], explica?: string) =>
    abrir({
      rotulo,
      titulo,
      explica,
      total: soma(itens),
      itens: itens.map(item),
      vazio: 'Nenhuma parcela aqui.',
    })

  const anos = anosDoCalendario.map((a) => (
    <AnoEmBarras
      key={a}
      ano={a}
      legenda={a === anosDoCalendario[0]}
      itens={noPeriodo.filter((it) => it.quando.slice(0, 4) === String(a))}
      aoAbrirMes={(nome, itens) =>
        compor(
          nome,
          `Recebimentos de ${nome}`,
          itens,
          'Cada parcela pela data em que ela cai — ou pela data em que caiu, se já foi paga.',
        )
      }
    />
  ))

  return quadro(
    <>
      <FaixaDeMetricas
        rotuloAcessivel="Seus recebimentos"
        metricas={[
          {
            rotulo: 'Liberada, a receber',
            valor: soma(liberadas),
            lider: true,
            nota:
              liberadas.length === 0
                ? 'quando a construtora pagar, aparece aqui'
                : `${plural(liberadas.length, 'parcela', 'parcelas')} que a imobiliária já recebeu`,
            aoClicar: () =>
              compor(
                'A receber agora',
                'De quais vendas vem',
                liberadas,
                'Parcelas que a imobiliária já recebeu. Sua comissão está liberada para pagamento.',
              ),
          },
          {
            rotulo: 'Atrasada',
            valor: soma(atrasadas),
            estado: atrasadas.length > 0 ? 'vencido' : undefined,
            nota:
              atrasadas.length === 0
                ? 'nada parado no repasse'
                : esperaMaisAntiga > 0
                  ? `a mais antiga espera há ${plural(esperaMaisAntiga, 'dia', 'dias')}`
                  : 'recebida pela imobiliária e não repassada',
            aoClicar: () =>
              compor(
                'Atrasada',
                'O que a imobiliária recebeu e não repassou',
                atrasadas,
                'Atraso aqui é só o que a imobiliária já recebeu da construtora. Parcela que a construtora não pagou é espera, não atraso.',
              ),
          },
          {
            rotulo: 'Já recebida',
            valor: soma(recebidas),
            nota:
              recebidas.length === 0
                ? 'nada pago a você ainda'
                : `${plural(recebidas.length, 'parcela paga', 'parcelas pagas')} a você`,
            aoClicar: () => compor('Já recebida', 'O que já caiu para você', recebidas),
          },
          {
            rotulo: 'Prevista',
            valor: soma(previstas),
            nota: previstas.length === 0 ? 'nenhuma parcela prevista' : 'depende da construtora pagar',
            aoClicar: () =>
              compor(
                'Prevista',
                'Previsão, não promessa',
                previstas,
                'Estas parcelas só viram comissão sua quando a construtora pagar a imobiliária. A data pode mudar.',
              ),
          },
        ]}
      />

      <div className="grid items-start gap-bloco lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/*
         * Com "todos os anos" (o padrão), um gráfico POR ANO, do mais antigo
         * para o mais novo: ele precisa ver 2027 sem trocar filtro nenhum.
         */}
        <div className="flex min-w-0 flex-col gap-bloco">{anos}</div>

        {/* No celular, a próxima ação sobe para logo depois dos números. */}
        <div className="flex min-w-0 flex-col gap-bloco max-lg:contents">
          <div className="flex min-w-0 flex-col max-lg:order-first">
            <Cartao rotuloAcessivel="Próxima ação">
              <Cartao.Cabecalho
                titulo="Próxima ação"
                meta={
                  atrasadas.length > 0
                    ? 'há repasse esperando além do previsto'
                    : liberadas.length > 0
                      ? 'dinheiro seu esperando o repasse'
                      : 'tudo em dia'
                }
              />
              {passos.length === 0 ? (
                <EstadoVazio
                  icone={CircleCheck}
                  titulo="Tudo em dia"
                  descricao="Nenhuma parcela sua está pendente. Quando a imobiliária registrar uma venda nova, o cronograma aparece aqui."
                />
              ) : (
                <ListaDeAcoes rotuloAcessivel="Próxima ação" itens={passos} />
              )}
            </Cartao>
          </div>

          <EmQuePeEsta todas={todas} hoje={hoje} aoAbrir={compor} />
        </div>
      </div>

      {/* A margem de rolagem: o cabeçalho fixo não pode cobrir o título do cronograma. */}
      <div ref={cronograma} style={{ scrollMarginTop: 'calc(var(--altura-cabecalho) + 16px)' }}>
        <Cartao>
          <Cartao.Cabecalho
            titulo="Cronograma"
            meta={`${filtro === 'tudo' ? 'toda parcela, mês a mês' : filtros.find((f) => f.id === filtro)?.rotulo} · ${plural(lista.length, 'parcela', 'parcelas')}`}
          />
          {precisaDaRegra && (
            <Cartao.Corpo>
              <Dica>
                Atrasada é só o que a imobiliária já recebeu e ainda não repassou. Parcela prevista depende da
                construtora pagar primeiro: se ela atrasar, é espera, não dívida.
              </Dica>
            </Cartao.Corpo>
          )}
          {meses.length === 0 ? (
            <EstadoVazio
              icone={CalendarDays}
              titulo="Nada com esse filtro"
              descricao={vazioDoFiltro[filtro]}
              acao={
                <Button variant="secundario" onClick={() => setFiltro('tudo')}>
                  Mostrar tudo
                </Button>
              }
            />
          ) : (
            <Cartao.Lista
              rotuloAcessivel="Cronograma, por mês"
              chaveEscada={filtro}
              colunas={{
                goteira: true,
                situacao: true,
                valor: true,
                fim: true,
              }}
            >
              {meses.map((g) => {
                const nome = parseDateOnly(`${g.mes}-01`).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                })
                // "Agora" é só o que já é dinheiro: pago a ele ou liberado. Previsão vai no outro lado; cancelada em nenhum.
                const existe = g.itens.filter(({ s }) => s === 'recebida' || s === 'liberada' || s === 'vencida')
                const promessa = g.itens.filter(({ s }) => s === 'prevista')
                const corte = g.mes === mesDoMarco ? g.itens.findIndex((it) => it.quando >= hoje) : -1
                return (
                  <Fragment key={g.mes}>
                    <LinhaGrupo
                      rotulo={nome}
                      contador={plural(g.itens.length, 'parcela', 'parcelas')}
                      par={
                        <ParAgoraPrevisto
                          agora={{
                            valor: soma(existe),
                            rotuloAcessivel: `Ver o que já é dinheiro em ${nome}`,
                            aoAbrir: () => compor(nome, `Recebido e a receber em ${nome}`, existe),
                          }}
                          previsto={{
                            valor: soma(promessa),
                            rotuloAcessivel: `Ver o que está previsto em ${nome}`,
                            aoAbrir: () => compor(nome, `Previsto para ${nome}`, promessa),
                          }}
                        />
                      }
                    />
                    {g.itens.map((it, i) => (
                      <Fragment key={it.p.id}>
                        {i === corte && <LinhaGrupo rotulo="Hoje" hoje />}
                        {linhaDaParcela(it)}
                      </Fragment>
                    ))}
                  </Fragment>
                )
              })}
            </Cartao.Lista>
          )}
        </Cartao>
      </div>
    </>,
    subtitulo,
    <div className="flex min-w-0 flex-col gap-3">
      <FiltrosRapidos
        filtros={filtros}
        ativo={filtro}
        aoMudar={setFiltro}
        rotuloAcessivel="O que mostrar no cronograma"
      />
      {/* O período: os anos que existem no cronograma, mais o "Tudo". */}
      <FiltrosRapidos
        rotuloAcessivel="Período do cronograma"
        ativo={periodo}
        aoMudar={trocarPeriodo}
        filtros={[
          ...anosDisponiveis.map((a) => ({
            id: String(a),
            rotulo: String(a),
            contador: todas.filter((it) => it.quando.slice(0, 4) === String(a)).length,
          })),
          {
            id: 'tudo',
            rotulo: 'Todos os anos',
            contador: todas.length,
            dica: 'Tudo o que você tem para receber, de qualquer ano',
          },
        ]}
      />
    </div>,
  )
}

/**
 * Uma parcela na linha do tempo: selo com o ordinal real, a palavra do
 * corretor no chip ("Liberada" é "A receber"), a frase com verbo e tempo, e só
 * então a cor. Toda parcela abre a venda de origem.
 *
 * Função, não componente: a Lista aceita só Linha pelo nome.
 */
function linhaDaParcela({ p, s }: Item) {
  const valor = c2(p.broker_amount - p.broker_adjustment)
  return (
    <Linha
      goteira={<Selo situacao={s} idx={p.idx} count={p.count} />}
      titulo={p.sale_title}
      meta={
        <>
          {/* Pessoa física vem dito primeiro: é comissão dele que nunca passa pela imobiliária. */}
          {p.is_personal && 'pessoa física · '}
          {p.count > 1 && `parcela ${p.idx}/${p.count} · `}
          <FraseDaParcela p={p} s={s} />
        </>
      }
      situacao={<ChipDaParcela p={p} s={s} />}
      valor={
        s === 'prevista' ? (
          <Valor valor={valor} posto="linha" previsto />
        ) : s === 'recebida' ? (
          <Valor valor={valor} posto="linha" estado="recebido" />
        ) : s === 'vencida' ? (
          <Valor valor={valor} posto="linha" estado="vencido" />
        ) : (
          <Valor valor={valor} posto="linha" className={s === 'cancelada' ? 'line-through' : undefined} />
        )
      }
      para={`/minhas-vendas?venda=${p.sale_id}`}
    />
  )
}

/*
 * EM QUE PÉ ESTÁ (07/10/2026, pedido do Rafael: "deixar mais nítida a
 * situação de cada parcela… o que está aguardando pagamento do cliente, o que
 * já foi emitido a NF").
 *
 * O caminho do dinheiro, na ordem em que ele anda, com quantas parcelas e
 * quanto de comissão estão em cada degrau. Todas as parcelas, de qualquer
 * ano — como o herói, o período não recorta esta resposta. Degrau vazio
 * continua desenhado: o caminho é o mesmo para toda venda.
 */
type Degrau = {
  id: string
  palavra: string
  meta: string
  icone: LucideIcon
  tom: 'info' | 'atencao' | 'sucesso'
  itens: Item[]
  previsto: boolean
}

const META_DA_ETAPA: Record<EtapaDoCorretor, string> = {
  aguardando_cliente: 'o cliente ainda não pagou o que libera a comissão',
  gatilho_atingido: 'a imobiliária emite a nota fiscal',
  nota_emitida: 'no prazo de pagamento da construtora',
  em_atraso: 'a construtora passou do prazo; a imobiliária cobra',
}

function EmQuePeEsta({
  todas,
  hoje,
  aoAbrir,
}: {
  todas: Item[]
  hoje: string
  aoAbrir: (rotulo: string, titulo: string, itens: Item[], explica?: string) => void
}) {
  const previstas = todas.filter(({ s }) => s === 'prevista')
  const daEtapa = (e: EtapaDoCorretor) => previstas.filter(({ p }) => etapaDoCorretor(p, hoje) === e)

  const etapa = (e: EtapaDoCorretor): Degrau => ({
    id: e,
    palavra: ETAPA_DO_CORRETOR[e].palavra,
    meta: META_DA_ETAPA[e],
    icone: ICONE_DA_ETAPA[e],
    tom: TOM_DA_ETAPA[e] as Degrau['tom'],
    itens: daEtapa(e),
    previsto: true,
  })

  const emAtraso = etapa('em_atraso')
  const degraus: Degrau[] = [
    etapa('aguardando_cliente'),
    etapa('gatilho_atingido'),
    etapa('nota_emitida'),
    // "Em atraso" só aparece quando existe: é exceção, não degrau do caminho.
    ...(emAtraso.itens.length > 0 ? [emAtraso] : []),
    {
      id: 'a-receber',
      palavra: 'A receber',
      meta: 'a construtora pagou a imobiliária; falta o seu repasse',
      icone: HandCoins,
      tom: 'atencao',
      itens: todas.filter(({ s }) => s === 'liberada' || s === 'vencida'),
      previsto: false,
    },
    {
      id: 'recebida',
      palavra: 'Recebida',
      meta: 'já caiu para você',
      icone: CircleCheck,
      tom: 'sucesso',
      itens: todas.filter(({ s }) => s === 'recebida'),
      previsto: false,
    },
  ]

  const soma = (l: Item[]) => c2(l.reduce((t, { p }) => t + p.broker_amount - p.broker_adjustment, 0))
  const explica: Record<string, string | undefined> = {
    ...Object.fromEntries(
      (Object.keys(ETAPA_DO_CORRETOR) as EtapaDoCorretor[]).map((e) => [e, ETAPA_DO_CORRETOR[e].explica]),
    ),
    'a-receber': 'A imobiliária já recebeu estas parcelas da construtora. É dinheiro seu, esperando o repasse.',
  }

  return (
    <Cartao>
      <Cartao.Cabecalho titulo="Em que pé está" meta="do pagamento do cliente até a sua conta" />
      <Cartao.Lista rotuloAcessivel="Em que pé está cada parcela" colunas={{ goteira: true, valor: true, fim: true }}>
        {degraus.map((d) => {
          const vazio = d.itens.length === 0
          return (
            <Linha
              key={d.id}
              goteira={<IconeTom icone={d.icone} tom={vazio ? 'neutro' : d.tom} tamanho="sm" />}
              titulo={d.palavra}
              meta={`${vazio ? 'nenhuma parcela agora' : plural(d.itens.length, 'parcela', 'parcelas')} · ${d.meta}`}
              valor={
                vazio ? undefined : d.previsto ? (
                  <Valor valor={soma(d.itens)} posto="linha" previsto />
                ) : d.id === 'recebida' ? (
                  <Valor valor={soma(d.itens)} posto="linha" estado="recebido" />
                ) : (
                  <Valor valor={soma(d.itens)} posto="linha" />
                )
              }
              aoClicar={vazio ? undefined : () => aoAbrir(d.palavra, d.palavra, d.itens, explica[d.id])}
            />
          )
        })}
      </Cartao.Lista>
    </Cartao>
  )
}
