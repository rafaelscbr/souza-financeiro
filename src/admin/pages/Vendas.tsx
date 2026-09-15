import { Fragment, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Clock, Handshake, HandCoins, Hourglass, List, Plus, Search, SearchX, TriangleAlert } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useAcoesAdmin } from '../AcoesAdmin'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Barra, LegendaBarra } from '@/components/ui/Barra'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Icone } from '@/components/ui/Icone'
import { EstadoVazio } from '@/components/ui/Estados'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { FilaDeAcao, type ItemFila } from '@/components/shared/FilaDeAcao'
import { brokerStatusOf, type SaleView } from '@/lib/sales'
import { diasEntre, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDateShort } from '@/lib/format'
import type { SaleInstallment, TransactionStatus } from '@/types'

/*
 * A CARTEIRA DE VENDAS, no quadro do Souza OS.
 *
 * O que ficou da tela anterior, porque era regra e não desenho:
 *
 * 1. O herói é "Comissão em carteira": a comissão contratada que ainda não
 *    entrou, somando as parcelas previstas de todas as vendas não canceladas.
 *    Ele não segue o filtro de propósito — o filtro muda a lista, não o
 *    tamanho da carteira — e continua abrindo, venda por venda, no que o forma.
 *
 * 2. O subtotal da lista é sempre em duas parcelas: o que já entrou e o que
 *    ainda é promessa da construtora. Somar os dois num número só misturaria o
 *    que a imobiliária tem com o que ela espera.
 *
 * 3. Venda com parcela atrasada pela construtora continua "Prevista". O atraso
 *    é dito com palavra e ícone de atenção, nunca com o vermelho de vencido:
 *    vencido é só o que a imobiliária já recebeu e não repassou.
 *
 * O que mudou é o quadro (planta 9.7): cabeçalho com resumo vivo, filtros com
 * contador na faixa, herói PREVISTO (sem ouro: a carteira é promessa), a fila
 * de ação observada nos dados e a lista com colunas declaradas uma vez. Os
 * quatro indicadores saíram do topo sem levar número nenhum: as contagens
 * moram nos contadores dos filtros e a comissão liberada no cabeçalho da lista.
 *
 * Carregando e falhou são da casca (AdminShell): ela só entrega a tela depois
 * que o banco respondeu, e mostra o erro no lugar dela. Por isso, aqui, uma
 * carteira vazia é vazia de verdade, nunca uma consulta que caiu.
 */

type Filtro = 'andamento' | 'atrasadas' | 'comissao' | 'concluidas' | 'todas'

const FILTROS: Filtro[] = ['andamento', 'atrasadas', 'comissao', 'concluidas', 'todas']

/*
 * O filtro mora na URL (`?situacao=atrasadas`): cada indicador e cada sugestão
 * levam a uma lista já filtrada (seção 10), e o link copiado abre a mesma
 * lista. Valor desconhecido cai no padrão em vez de mostrar uma lista vazia.
 */
function lerFiltro(valor: string | null): Filtro {
  return FILTROS.includes(valor as Filtro) ? (valor as Filtro) : 'andamento'
}

export function Vendas() {
  const { vendas, transactions, hoje } = useAdmin()
  const { registrarVenda } = useAcoesAdmin()
  const { abrir } = useComposicao()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtro = lerFiltro(params.get('situacao'))
  const [busca, setBusca] = useState('')
  const [pagando, setPagando] = useState<ComissaoAPagar[] | null>(null)

  const statusPorTx = useMemo(
    () => new Map<string, TransactionStatus>(transactions.map((t) => [t.id, t.status])),
    [transactions],
  )

  /** Venda cancelada não é carteira: o que sobrou dela já foi cancelado no banco. */
  const ativas = useMemo(() => vendas.filter((v) => v.status !== 'cancelada'), [vendas])

  /*
   * O número herói. `toReceive` é a soma das parcelas ainda previstas, gravada
   * parcela a parcela pela migração 009 — esta tela não recalcula comissão
   * nenhuma, só soma o que já está gravado.
   */
  const emCarteira = useMemo(() => soma(ativas.map((v) => v.toReceive)), [ativas])
  const jaEntrouCarteira = useMemo(() => soma(ativas.map((v) => v.received)), [ativas])
  const contratadaCarteira = useMemo(() => soma(ativas.map((v) => v.cascade.commission)), [ativas])

  /*
   * O que a carteira observou hoje, parcela a parcela. Só leitura do que já
   * está gravado, com as duas regras de situação da casa:
   *
   * - A comissão do corretor usa a data em que a imobiliária RECEBEU: é dali
   *   que ela está com o dinheiro dele. É o único lugar onde nasce "vencida".
   * - A parcela prevista com data passada é a construtora atrasando. É espera,
   *   e aparece como "sem baixa", nunca como dívida.
   */
  const observado = useMemo(() => {
    const comissoesVencidas: { venda: SaleView; p: SaleInstallment; desde: string }[] = []
    const parcelasSemBaixa: { venda: SaleView; p: SaleInstallment }[] = []
    let proxima: { venda: SaleView; p: SaleInstallment } | null = null
    const vencidoPorVenda = new Map<string, number>()

    for (const venda of vendas) {
      for (const p of venda.installments) {
        if (p.broker_amount > 0) {
          const st = brokerStatusOf(p, statusPorTx)
          const desde = p.received_date ?? p.expected_date
          if (situacaoDeTela(st, desde, hoje) === 'vencida') {
            comissoesVencidas.push({ venda, p, desde })
            vencidoPorVenda.set(venda.id, soma([vencidoPorVenda.get(venda.id) ?? 0, p.broker_amount]))
          }
        }
        if (venda.status === 'cancelada' || p.status !== 'prevista') continue
        if (p.expected_date < hoje) parcelasSemBaixa.push({ venda, p })
        else if (!proxima || p.expected_date < proxima.p.expected_date) proxima = { venda, p }
      }
    }
    comissoesVencidas.sort((a, b) => (a.desde < b.desde ? -1 : 1))
    parcelasSemBaixa.sort((a, b) => (a.p.expected_date < b.p.expected_date ? -1 : 1))
    return { comissoesVencidas, parcelasSemBaixa, proxima, vencidoPorVenda }
  }, [vendas, statusPorTx, hoje])

  /*
   * Contagens de cada filtro, na mesma regra que o filtro aplica: o contador
   * da pílula e o número de linhas embaixo dela nunca podem discordar.
   */
  const passa = useMemo(
    () =>
      ({
        andamento: (v: SaleView) => v.status === 'ativa',
        atrasadas: (v: SaleView) => v.status !== 'cancelada' && v.hasOverdue,
        comissao: (v: SaleView) => v.brokerReleased > 0,
        concluidas: (v: SaleView) => v.status === 'concluida',
        todas: () => true,
      }) satisfies Record<Filtro, (v: SaleView) => boolean>,
    [],
  )
  const contagem = useMemo(() => {
    const c = {} as Record<Filtro, number>
    for (const f of FILTROS) c[f] = vendas.filter(passa[f]).length
    return c
  }, [vendas, passa])

  const comissaoLiberada = useMemo(() => soma(vendas.map((v) => v.brokerReleased)), [vendas])
  const comissaoVencida = useMemo(
    () => soma(observado.comissoesVencidas.map((c) => c.p.broker_amount)),
    [observado],
  )

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return vendas.filter((v) => {
      if (!passa[filtro](v)) return false
      if (
        q &&
        !`${v.title} ${v.client_name ?? ''} ${v.development ?? ''} ${v.brokerName ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
  }, [vendas, busca, filtro, passa])

  /*
   * O subtotal do grupo, nas duas parcelas que o sistema exige. As duas
   * metades somam a comissão contratada da lista, porque `received` e
   * `toReceive` são as duas partes da mesma comissão.
   */
  const jaEntrou = useMemo(() => soma(filtradas.map((v) => v.received)), [filtradas])
  const aReceber = useMemo(() => soma(filtradas.map((v) => v.toReceive)), [filtradas])

  /*
   * Agrupada por ano da venda quando a carteira atravessa mais de um ano: a
   * lista já vem da mais nova para a mais antiga, e o rótulo do ano com o
   * contador poupa ler a data de cada linha para saber onde se está.
   */
  const grupos = useMemo(() => {
    const porAno = new Map<string, SaleView[]>()
    for (const v of filtradas) {
      const ano = v.sale_date.slice(0, 4)
      const g = porAno.get(ano)
      if (g) g.push(v)
      else porAno.set(ano, [v])
    }
    return [...porAno.entries()]
  }, [filtradas])

  function mudarFiltro(f: Filtro, rolar = false) {
    setParams(
      (atual) => {
        const p = new URLSearchParams(atual)
        if (f === 'andamento') p.delete('situacao')
        else p.set('situacao', f)
        return p
      },
      { replace: true },
    )
    if (rolar) {
      const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      document.getElementById('lista-vendas')?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' })
    }
  }

  const cta = { rotulo: 'Registrar venda', rotuloCurto: 'Venda', aoClicar: registrarVenda }

  if (vendas.length === 0) {
    return (
      <PageLayout icone={Handshake} titulo="Vendas" subtitulo="Nenhuma venda registrada" cta={cta}>
        <Cartao rotuloAcessivel="Vendas">
          <Cartao.Corpo>
            <EstadoVazio
              icone={Handshake}
              titulo="Nenhuma venda registrada"
              descricao="Registre a primeira e ela aparece aqui com as parcelas, o imposto e a comissão do corretor já organizados."
              acao={
                <Button onClick={registrarVenda} icone={Plus}>
                  Registrar venda
                </Button>
              }
            />
          </Cartao.Corpo>
        </Cartao>
      </PageLayout>
    )
  }

  const nSemBaixa = new Set(observado.parcelasSemBaixa.map((x) => x.venda.id)).size
  const subtitulo = [
    `${plural(contagem.andamento, 'venda em andamento', 'vendas em andamento')}`,
    `${formatCurrency(emCarteira)} em carteira`,
    nSemBaixa > 0 ? `${nSemBaixa} com parcela sem baixa` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const fila = montarFila({
    observado,
    hoje,
    aoPagar: setPagando,
    aoFiltrar: (f) => mudarFiltro(f, true),
  })

  /* A frase de cada venda na composição: empreendimento e a data que importa. */
  const metaDaVenda = (v: SaleView) =>
    [
      v.development,
      v.nextDate
        ? v.hasOverdue
          ? `a construtora atrasou a parcela de ${formatDateShort(v.nextDate)}`
          : `próxima em ${formatDateShort(v.nextDate)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

  const abrirCarteira = () =>
    abrir({
      rotulo: 'Em carteira',
      titulo: 'De quais vendas vem',
      explica:
        'O que cada venda ainda tem para receber. A data de cada parcela depende da construtora pagar — por isso nada aqui é dívida de ninguém hoje.',
      total: emCarteira,
      itens: ativas
        .filter((v) => v.toReceive > 0)
        .map((v) => ({
          id: v.id,
          titulo: v.title,
          meta: metaDaVenda(v),
          valor: v.toReceive,
          // Parcela que a construtora não pagou é espera, não atraso:
          // "prevista" mesmo quando a data já passou.
          situacao: 'prevista' as const,
          para: `/vendas/${v.id}`,
        })),
      vazio: 'Nenhuma venda com parcela em aberto.',
    })

  /* Os apoios abrem venda por venda: a soma das linhas é o próprio apoio. */
  const abrirJaEntrou = () =>
    abrir({
      rotulo: 'Já entrou',
      titulo: 'De quais vendas já entrou',
      explica: 'A comissão que a construtora já pagou, venda por venda, nas vendas ativas.',
      total: jaEntrouCarteira,
      itens: ativas
        .filter((v) => v.received > 0)
        .map((v) => ({ id: v.id, titulo: v.title, meta: v.development ?? undefined, valor: v.received, situacao: 'recebida' as const, para: `/vendas/${v.id}` })),
      vazio: 'Nenhuma comissão entrou ainda nas vendas ativas.',
    })

  const abrirContratada = () =>
    abrir({
      rotulo: 'Contratada',
      titulo: 'A comissão de cada venda ativa',
      explica: 'A comissão contratada da imobiliária em cada venda ativa: o que já entrou mais o que ainda depende da construtora.',
      total: contratadaCarteira,
      itens: ativas.map((v) => ({ id: v.id, titulo: v.title, meta: metaDaVenda(v), valor: v.cascade.commission, para: `/vendas/${v.id}` })),
      vazio: 'Nenhuma venda ativa.',
    })

  const proxima = observado.proxima

  /* O par do rodapé abre as vendas da lista filtrada que o compõem. */
  const abrirJaEntrouLista = () =>
    abrir({
      rotulo: 'Já entrou',
      titulo: 'Já entrou, nas vendas da lista',
      explica: 'A comissão que já entrou em cada venda que a lista mostra agora, com o filtro e a busca aplicados.',
      total: jaEntrou,
      itens: filtradas
        .filter((v) => v.received > 0)
        .map((v) => ({ id: v.id, titulo: v.title, meta: v.development ?? undefined, valor: v.received, situacao: 'recebida' as const, para: `/vendas/${v.id}` })),
      vazio: 'Nenhuma comissão entrou nas vendas da lista.',
    })

  const abrirAReceberLista = () =>
    abrir({
      rotulo: 'Depende da construtora',
      titulo: 'Ainda a receber, nas vendas da lista',
      explica: 'O que cada venda da lista ainda tem para receber. A data depende da construtora pagar.',
      total: aReceber,
      itens: filtradas
        .filter((v) => v.toReceive > 0)
        .map((v) => ({ id: v.id, titulo: v.title, meta: metaDaVenda(v), valor: v.toReceive, situacao: 'prevista' as const, para: `/vendas/${v.id}` })),
      vazio: 'Nenhuma venda da lista com parcela em aberto.',
    })

  const faixa = (
    <FiltrosRapidos
      rotuloAcessivel="Situação da venda"
      ativo={filtro}
      aoMudar={(f) => mudarFiltro(f)}
      filtros={[
        { id: 'andamento', rotulo: 'Em andamento', contador: contagem.andamento },
        {
          id: 'atrasadas',
          rotulo: 'Parcela sem baixa',
          contador: contagem.atrasadas,
          dica: 'Parcela prevista com a data passada. A construtora atrasou; não é dívida.',
        },
        {
          id: 'comissao',
          rotulo: 'Comissão liberada',
          contador: contagem.comissao,
          dica: 'A imobiliária já recebeu a parcela e ainda não pagou o corretor.',
        },
        { id: 'concluidas', rotulo: 'Concluídas', contador: contagem.concluidas },
        { id: 'todas', rotulo: 'Todas', contador: contagem.todas, dica: 'Inclui as canceladas, riscadas.' },
      ]}
    />
  )

  return (
    <PageLayout icone={Handshake} titulo="Vendas" subtitulo={subtitulo} cta={cta} faixa={faixa}>
      {/*
       * O HERÓI é previsto: a carteira é promessa da construtora, então nada
       * de ouro. O que já entrou e a comissão contratada vão para os apoios.
       */}
      <Heroi
        variante="previsto"
        rotulo="Comissão em carteira · prevista"
        valor={emCarteira}
        contar
        aoAbrir={abrirCarteira}
        rotuloAcessivel="Ver de quais vendas vem a comissão em carteira"
        frase={`Comissão já contratada que ainda não entrou, somando as parcelas previstas de todas as vendas ativas. Não é dinheiro em conta, e não muda com o filtro da lista. ${
          proxima ? `A próxima parcela prevista é de ${proxima.venda.title}.` : 'Próxima parcela: nenhuma prevista.'
        }`}
        barra={
          <div className="flex flex-col gap-2">
            <Barra
              rotuloAcessivel={`Da comissão contratada das vendas ativas, ${formatCurrency(jaEntrouCarteira)} já entraram e ${formatCurrency(emCarteira)} dependem da construtora.`}
              segmentos={[
                { valor: jaEntrouCarteira, tom: 'sucesso' },
                { valor: emCarteira, tom: 'info' },
              ]}
            />
            <LegendaBarra
              itens={[
                { tom: 'sucesso', rotulo: 'já entrou' },
                { tom: 'info', rotulo: 'depende da construtora' },
              ]}
            />
          </div>
        }
        apoios={[
          { rotulo: 'Já entrou', valor: jaEntrouCarteira, aoAbrir: abrirJaEntrou, rotuloAcessivel: 'Ver de quais vendas ativas já entrou comissão' },
          { rotulo: 'Contratada', valor: contratadaCarteira, aoAbrir: abrirContratada, rotuloAcessivel: 'Ver a comissão contratada de cada venda ativa' },
          ...(proxima
            ? [
                {
                  rotulo: `Próxima parcela · ${formatDateShort(proxima.p.expected_date)}`,
                  valor: proxima.p.amount,
                  previsto: true,
                  aoAbrir: () => navigate(`/vendas/${proxima.venda.id}?parcela=${proxima.p.id}`),
                  rotuloAcessivel: `Abrir a próxima parcela prevista, de ${proxima.venda.title}`,
                },
              ]
            : []),
        ]}
      />

      <FilaDeAcao itens={fila.itens} vazio={fila.vazio} />

      <Cartao rotuloAcessivel="Cada venda">
        <Cartao.Cabecalho
          id="lista-vendas"
          titulo="Cada venda"
          icone={List}
          meta={
            <span className="meta items-center">
              {/* O que era o indicador "Comissão liberada": o número e o clique que filtra. */}
              <span className="inline-flex items-center gap-1">
                comissão liberada
                <ValorComOrigem
                  valor={comissaoLiberada}
                  posto="fato"
                  forte
                  estado={comissaoVencida > 0 ? 'vencido' : undefined}
                  aoAbrir={() => mudarFiltro('comissao', true)}
                  rotuloAcessivel="Filtrar as vendas com comissão liberada"
                />
              </span>
              <span>
                {comissaoVencida > 0
                  ? `${formatCurrency(comissaoVencida)} esperando o repasse há mais de um dia`
                  : 'a imobiliária recebeu e ainda não repassou'}
              </span>
            </span>
          }
          extra={
            <div className="relative w-full sm:w-72">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-t-meta">
                <Icone icone={Search} tamanho={16} />
              </span>
              <Input
                className="pl-10"
                type="search"
                placeholder="Buscar venda"
                title="Unidade, comprador, empreendimento ou corretor"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar venda"
              />
            </div>
          }
        />

        {filtradas.length === 0 ? (
          <Cartao.Corpo>
            <EstadoVazio
              icone={SearchX}
              titulo="Nada com esse filtro"
              descricao="Ajuste a busca ou troque a situação."
              acao={
                <Button
                  variant="secundario"
                  onClick={() => {
                    setBusca('')
                    mudarFiltro('todas')
                  }}
                >
                  Ver todas as vendas
                </Button>
              }
            />
          </Cartao.Corpo>
        ) : (
          <Cartao.Lista
            rotuloAcessivel="Cada venda"
            chaveEscada={filtro}
            colunas={{ situacao: true, valor: '11rem', fim: true }}
          >
            {grupos.map(([ano, lista]) => (
              <Fragment key={ano}>
                {grupos.length > 1 && (
                  <LinhaGrupo rotulo={`Vendidas em ${ano}`} contador={plural(lista.length, 'venda', 'vendas')} />
                )}
                {lista.map((v) => (
                  linhaVenda(v, observado.vencidoPorVenda.get(v.id) ?? 0)
                ))}
              </Fragment>
            ))}
          </Cartao.Lista>
        )}

        {filtradas.length > 0 && (
          <Cartao.Rodape>
            <p>
              {filtradas.length === vendas.length
                ? plural(vendas.length, 'venda registrada', 'vendas registradas')
                : `${filtradas.length} de ${plural(vendas.length, 'venda', 'vendas')}`}
              . O valor à direita é a comissão contratada da imobiliária.
            </p>
            {/* O par da lista, com as palavras de sempre: nunca um total único. */}
            <span data-par-agora-previsto className="max-w-full grow-0 basis-[30rem] text-t-meta">
              <span data-par-linha>
                <span data-lado>
                  <span className="font-label text-texto-meta">já entrou</span>
                  <ValorComOrigem
                    valor={jaEntrou}
                    posto="fato"
                    forte
                    aoAbrir={abrirJaEntrouLista}
                    rotuloAcessivel="Ver de quais vendas da lista já entrou comissão"
                  />
                </span>
                <span data-lado>
                  <span className="font-label text-texto-meta">depende da construtora</span>
                  <ValorComOrigem
                    valor={aReceber}
                    posto="fato"
                    previsto
                    aoAbrir={abrirAReceberLista}
                    rotuloAcessivel="Ver de quais vendas da lista a comissão depende da construtora"
                  />
                </span>
              </span>
            </span>
          </Cartao.Rodape>
        )}
      </Cartao>

      <PagarComissao itens={pagando} onFechar={() => setPagando(null)} />
    </PageLayout>
  )
}

/* ------------------------------------------------------------------------- */
/* A lista                                                                    */
/* ------------------------------------------------------------------------- */

/*
 * Uma venda, uma Linha (7.2): título, contexto
 * em texto na meta, chip, a comissão contratada na coluna de valor e o que já
 * entrou logo abaixo dela. A linha inteira leva à ficha da venda.
 */
function linhaVenda(v: SaleView, vencido: number) {
  const s = situacaoDaVenda(v)
  const cancelada = s === 'cancelada'
  const pct = v.cascade.commission > 0 ? Math.round(v.progress * 100) : 0

  const contexto = [v.development ?? 'sem empreendimento', v.brokerName, v.client_name].filter(Boolean) as string[]
  if (!cancelada) {
    contexto.push(v.toReceive === 0 ? 'comissão recebida por inteiro' : `falta ${formatCurrency(v.toReceive)}`)
  }

  /*
   * Os dois sinais que pedem alguém, com ícone e palavra. O atraso da
   * construtora é atenção, não risco; a comissão parada na mão da
   * imobiliária é risco quando já passou do dia em que entrou.
   */
  const sinais: { icone: typeof Clock; cor: string; texto: string }[] = []
  if (!cancelada && v.hasOverdue && v.nextDate) {
    sinais.push({ icone: Hourglass, cor: 'text-warning', texto: `a construtora atrasou a parcela de ${formatDateShort(v.nextDate)}` })
  }
  if (v.brokerReleased > 0) {
    sinais.push(
      vencido > 0
        ? { icone: TriangleAlert, cor: 'text-error', texto: `comissão de ${formatCurrency(vencido)} esperando o repasse` }
        : { icone: Clock, cor: 'text-warning', texto: `comissão de ${formatCurrency(v.brokerReleased)} liberada, a pagar` },
    )
  }

  return (
    <Linha
      key={v.id}
      titulo={<span className={cancelada ? 'text-t3 line-through' : undefined}>{v.title}</span>}
      meta={
        <span className="flex flex-col gap-2">
          <span className="meta">
            {contexto.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </span>
          {sinais.map((x) => (
            <span key={x.texto} className="flex items-start gap-2 text-t2">
              <Icone icone={x.icone} tamanho={12} className={`${x.cor} h-5`} />
              {x.texto}
            </span>
          ))}
        </span>
      }
      situacao={<ChipSituacao situacao={s} />}
      valor={<Valor valor={v.cascade.commission} posto="linha" tinta={cancelada ? 'text-t4 line-through' : undefined} />}
      metaValor={cancelada ? 'venda cancelada' : `já entrou ${formatCurrency(v.received)} · ${pct}%`}
      para={`/vendas/${v.id}`}
    />
  )
}

/* ------------------------------------------------------------------------- */
/* A próxima ação                                                             */
/* ------------------------------------------------------------------------- */

type Observado = {
  comissoesVencidas: { venda: SaleView; p: SaleInstallment; desde: string }[]
  parcelasSemBaixa: { venda: SaleView; p: SaleInstallment }[]
  proxima: { venda: SaleView; p: SaleInstallment } | null
}

/*
 * Só sugere o que a carteira observou (seção 10), na ordem da casa:
 *
 * 1. Comissão vencida — a imobiliária recebeu e não repassou. É a única dívida
 *    real desta tela, e o botão já abre o pagamento das parcelas do corretor
 *    que espera há mais tempo.
 * 2. Parcela sem baixa — a data passou e nada foi registrado. Pode ser a
 *    construtora atrasando (espera) ou dinheiro que caiu e ninguém baixou. O
 *    botão abre a parcela na ficha, onde estão "Recebi" e "Reagendar".
 *
 * Sem nenhuma das duas, "Tudo em dia" com a próxima parcela prevista.
 */
function montarFila({
  observado,
  hoje,
  aoPagar,
  aoFiltrar,
}: {
  observado: Observado
  /** O "hoje" do AdminData, em data local: toISOString() viraria o dia às 21h. */
  hoje: string
  aoPagar: (itens: ComissaoAPagar[]) => void
  aoFiltrar: (f: Filtro) => void
}): { itens: ItemFila[]; vazio: { titulo: string; descricao: string } } {
  const { comissoesVencidas, parcelasSemBaixa, proxima } = observado
  type Principal = Omit<ItemFila, 'id' | 'motivo'> & { porque: string }
  type Outra = { id: string; rotulo: string; porque: string; tom: 'risco' | 'atencao'; aoClicar: () => void }
  const outras: Outra[] = []
  let principal: Principal | undefined

  if (comissoesVencidas.length > 0) {
    const maisAntiga = comissoesVencidas[0]
    const nome = maisAntiga.venda.brokerName ?? 'corretor'
    const doCorretor = comissoesVencidas.filter((c) => (c.venda.brokerName ?? 'corretor') === nome)
    const total = soma(doCorretor.map((c) => c.p.broker_amount))
    const dias = Math.max(0, diasEntre(maisAntiga.desde, hoje))
    principal = {
      tom: 'risco',
      icone: TriangleAlert,
      titulo: `Pagar ${formatCurrency(total)} de comissão a ${nome}`,
      porque: `A imobiliária já recebeu ${plural(doCorretor.length, 'parcela', 'parcelas')} e não repassou a parte do corretor. A mais antiga, de ${maisAntiga.venda.title}, entrou em ${formatDateShort(maisAntiga.desde)} e está há ${plural(dias, 'dia', 'dias')} esperando.`,
      acao: {
        rotulo: 'Pagar comissão',
        aoClicar: () =>
          aoPagar(
            doCorretor.map((c) => ({
              installmentId: c.p.id,
              brokerName: nome,
              saleTitle: c.venda.title,
              parcela: `parcela ${c.p.idx}/${c.p.count}`,
              amount: c.p.broker_amount,
              dueDate: c.desde,
            })),
          ),
      },
    }
    const outrosCorretores = comissoesVencidas.length - doCorretor.length
    if (outrosCorretores > 0) {
      outras.push({
        id: 'comissao',
        rotulo: `Mais ${plural(outrosCorretores, 'comissão vencida', 'comissões vencidas')}`,
        porque: 'Parcelas de outros corretores que a imobiliária recebeu e ainda não repassou.',
        tom: 'risco',
        aoClicar: () => aoFiltrar('comissao'),
      })
    }
  }

  if (parcelasSemBaixa.length > 0) {
    const { venda, p } = parcelasSemBaixa[0]
    const dias = Math.max(0, diasEntre(p.expected_date, hoje))
    const ordinal = p.count > 1 ? `a parcela ${p.idx} de ${p.count}` : 'a parcela única'
    if (!principal) {
      principal = {
        tom: 'atencao',
        icone: Hourglass,
        titulo: `Conferir ${ordinal} de ${venda.title}`,
        porque: `Era prevista para ${formatDateShort(p.expected_date)} e está sem baixa há ${plural(dias, 'dia', 'dias')}. Se a construtora já pagou, registre o recebimento; se atrasou, reagende. Não é dívida de ninguém.`,
        acao: { rotulo: 'Abrir a parcela', para: `/vendas/${venda.id}?parcela=${p.id}` },
      }
      if (parcelasSemBaixa.length > 1) {
        outras.push({
          id: 'sem-baixa',
          rotulo: `Mais ${plural(parcelasSemBaixa.length - 1, 'parcela sem baixa', 'parcelas sem baixa')}`,
          porque: 'Parcelas previstas com a data passada. A construtora atrasou ou o recebimento não foi registrado.',
          tom: 'atencao',
          aoClicar: () => aoFiltrar('atrasadas'),
        })
      }
    } else {
      outras.push({
        id: 'sem-baixa',
        rotulo: plural(parcelasSemBaixa.length, 'parcela sem baixa', 'parcelas sem baixa'),
        porque: 'Parcelas previstas com a data passada. A construtora atrasou ou o recebimento não foi registrado.',
        tom: 'atencao',
        aoClicar: () => aoFiltrar('atrasadas'),
      })
    }
  }

  /*
   * A fila na ordem de sempre: a principal primeiro, as outras depois. Cada
   * outra leva à lista já filtrada ("Ver"), com o ícone do seu assunto.
   */
  const itens: ItemFila[] = []
  if (principal) {
    const { porque, ...resto } = principal
    itens.push({ id: 'principal', motivo: porque, ...resto })
  }
  for (const o of outras) {
    itens.push({
      id: o.id,
      icone: o.id === 'comissao' ? HandCoins : Hourglass,
      tom: o.tom,
      titulo: o.rotulo,
      motivo: o.porque,
      acao: { rotulo: 'Ver', aoClicar: o.aoClicar },
    })
  }

  return {
    itens,
    vazio: {
      titulo: 'Tudo em dia',
      descricao: proxima
        ? `Nenhuma comissão parada e nenhuma parcela sem baixa. A próxima prevista é de ${proxima.venda.title}: ${formatCurrency(proxima.p.amount)} em ${formatDateShort(proxima.p.expected_date)}.`
        : 'Nenhuma comissão parada e nenhuma parcela em aberto na carteira.',
    },
  }
}

/* ------------------------------------------------------------------------- */
/* Regras de leitura                                                          */
/* ------------------------------------------------------------------------- */

const soma = (l: number[]) => Math.round(l.reduce((s, v) => s + v, 0) * 100) / 100

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/**
 * A situação de uma VENDA — que não é a situação de uma parcela.
 *
 * Aqui mora a regra de negócio mais importante do sistema, na forma do que
 * esta função NÃO devolve: `hasOverdue` (parcela prevista com data passada)
 * nunca vira "Vencida". Vencido é só o que a imobiliária já recebeu e não
 * pagou; quando a construtora atrasa, a venda continua "Prevista" e o atraso é
 * dito com todas as letras na linha. O selo vermelho que uma tela antiga punha
 * nesse caso inventava uma dívida que não existe.
 */
function situacaoDaVenda(v: SaleView): Situacao {
  if (v.status === 'cancelada') return 'cancelada'
  if (v.status === 'concluida') return 'recebida'
  return 'prevista'
}
