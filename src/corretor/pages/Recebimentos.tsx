import { Fragment, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, CalendarDays, CircleCheck, Clock, ListChecks, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useCorretor, type CorretorParcela } from '../CorretorData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { IconeTom } from '@/components/ui/IconeTom'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { ParAgoraPrevisto } from '@/components/ui/ParAgoraPrevisto'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { BarraTrilha, LegendaTrilha } from '@/components/ui/Barra'
import { FiltrosRapidos, type FiltroRapido } from '@/components/ui/FiltrosRapidos'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio, EsqueletoLista } from '@/components/ui/Estados'
import { diasEntre, fraseDeTempo, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDate, parseDateOnly, toDateOnly } from '@/lib/format'

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

/** Um item da próxima ação: só o que os dados observaram. */
interface ItemDaFila {
  id: string
  tom: 'risco' | 'atencao'
  icone: LucideIcon
  titulo: string
  motivo: string
  acao: { rotulo: string; aoClicar: () => void }
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

  /* Filtrar a partir da próxima ação leva o olho junto até o cronograma. Sem `smooth`. */
  const mostrar = (f: Filtro) => {
    setFiltro(f)
    requestAnimationFrame(() => cronograma.current?.scrollIntoView({ block: 'start' }))
  }

  /* A linha de hoje: no primeiro mês com parcela de hoje em diante, só se houver passado antes. */
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

  const fila: ItemDaFila[] = []
  if (atrasadas.length > 0) {
    fila.push({
      id: 'principal',
      tom: 'risco',
      icone: TriangleAlert,
      titulo: atrasadas.length === 1 ? 'Uma comissão atrasada' : `${atrasadas.length} comissões atrasadas`,
      motivo: `A imobiliária já recebeu ${formatCurrency(soma(atrasadas))} da construtora e ainda não repassou${
        esperaMaisAntiga > 0 ? `; a mais antiga espera há ${plural(esperaMaisAntiga, 'dia', 'dias')}` : ''
      }. Vale um lembrete para a imobiliária.`,
      acao: { rotulo: 'Mostrar as atrasadas', aoClicar: () => mostrar('atrasadas') },
    })
    if (!soAtrasadas)
      fila.push({
        id: 'a-receber',
        tom: 'atencao',
        icone: Clock,
        titulo: `${plural(liberadas.length - atrasadas.length, 'outra', 'outras')} a receber`,
        motivo: 'Liberadas pela imobiliária e ainda dentro da data prevista.',
        acao: { rotulo: 'Ver', aoClicar: () => mostrar('aReceber') },
      })
  } else if (liberadas.length > 0) {
    fila.push({
      id: 'principal',
      tom: 'atencao',
      icone: Clock,
      titulo: `${formatCurrency(soma(liberadas))} esperando o repasse`,
      motivo: 'A imobiliária já recebeu estas parcelas da construtora. É dinheiro seu; o próximo passo é o repasse.',
      acao: { rotulo: 'Mostrar o que está a receber', aoClicar: () => mostrar('aReceber') },
    })
  }

  const tudoEmDia = {
    titulo: 'Tudo em dia',
    descricao: proximaPrevista
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

  // A regra que a tela não mostra sozinha, só quando há na lista uma parcela que ela explica.
  const precisaDaRegra = lista.some(({ s }) => s === 'prevista' || s === 'vencida')

  const compor = (rotulo: string, titulo: string, itens: Item[], explica?: string) =>
    abrir({ rotulo, titulo, explica, total: soma(itens), itens: itens.map(item), vazio: 'Nenhuma parcela aqui.' })

  return quadro(
    <>
      <Heroi
        variante="ouro"
        rotulo="A receber agora"
        valor={soma(liberadas)}
        contar
        rotuloAcessivel="Ver de quais vendas vem o valor a receber"
        aoAbrir={() =>
          compor(
            'A receber agora',
            'De quais vendas vem',
            liberadas,
            'Parcelas que a imobiliária já recebeu. Sua comissão está liberada para pagamento.',
          )
        }
        frase={
          liberadas.length > 0
            ? `A imobiliária já recebeu estas parcelas. É dinheiro seu, esperando o repasse.${
                atrasadas.length > 0
                  ? ` ${atrasadas.length === 1 ? 'Uma delas já passou' : `${atrasadas.length} delas já passaram`} da data prevista — vale um lembrete.`
                  : ''
              }`
            : 'Nada liberado no momento. Quando a construtora pagar uma parcela, sua comissão aparece aqui.'
        }
        barra={
          <div className="flex flex-col gap-2">
            <BarraTrilha
              recebido={soma(recebidas)}
              liberado={soma(liberadas)}
              previsto={soma(previstas)}
              rotuloAcessivel={`No cronograma: ${formatCurrency(soma(recebidas))} recebido, ${formatCurrency(
                soma(liberadas),
              )} liberado a receber e ${formatCurrency(soma(previstas))} dependendo da construtora.`}
            />
            <LegendaTrilha />
          </div>
        }
        apoios={[
          {
            rotulo: 'Atrasada',
            valor: soma(atrasadas),
            rotuloAcessivel: 'Ver quais comissões estão atrasadas',
            aoAbrir: () =>
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
            rotuloAcessivel: 'Ver quais parcelas você já recebeu',
            aoAbrir: () => compor('Já recebida', 'O que já caiu para você', recebidas),
          },
          {
            rotulo: 'Prevista',
            valor: soma(previstas),
            previsto: true,
            rotuloAcessivel: 'Ver quais parcelas estão previstas',
            aoAbrir: () =>
              compor(
                'Prevista',
                'Previsão, não promessa',
                previstas,
                'Estas parcelas só viram comissão sua quando a construtora pagar a imobiliária. A data pode mudar.',
              ),
          },
        ]}
      />

      <Cartao>
        <Cartao.Cabecalho
          titulo="Próxima ação"
          icone={ListChecks}
          meta={fila.length > 0 ? plural(fila.length, 'pendência', 'pendências') : undefined}
        />
        {fila.length === 0 ? (
          <EstadoVazio icone={CircleCheck} titulo={tudoEmDia.titulo} descricao={tudoEmDia.descricao} />
        ) : (
          <Cartao.Lista rotuloAcessivel="Próxima ação" colunas={{ goteira: true, acao: 'auto' }}>
            {fila.map((f) => (
              <Linha
                key={f.id}
                goteira={<IconeTom icone={f.icone} tom={f.tom} tamanho="sm" />}
                titulo={f.titulo}
                meta={f.motivo}
                acao={
                  <Button variant="secundario" size="sm" className="max-sm:flex-1" onClick={f.acao.aoClicar}>
                    {f.acao.rotulo}
                  </Button>
                }
              />
            ))}
          </Cartao.Lista>
        )}
      </Cartao>

      {/* A margem de rolagem: o cabeçalho fixo não pode cobrir o título do cronograma. */}
      <div ref={cronograma} style={{ scrollMarginTop: 'calc(var(--altura-cabecalho) + 16px)' }}>
        <Cartao>
          <Cartao.Cabecalho
            titulo="Cronograma"
            icone={CalendarDays}
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
              colunas={{ goteira: true, situacao: true, valor: true, fim: true }}
            >
              {meses.map((g) => {
                const nome = parseDateOnly(`${g.mes}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
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
    <FiltrosRapidos filtros={filtros} ativo={filtro} aoMudar={setFiltro} rotuloAcessivel="O que mostrar no cronograma" />,
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
          {p.count > 1 && `parcela ${p.idx}/${p.count} · `}
          <FraseDeTempo situacao={s} prevista={p.expected_date} liberada={p.received_date} recebida={p.paid_date} />
        </>
      }
      situacao={<ChipSituacao situacao={s} perfil="corretor" />}
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
