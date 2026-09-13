import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CalendarX2,
  ChevronRight,
  CircleCheck,
  Clock,
  Handshake,
  List,
  Plus,
  Search,
  SearchX,
  TriangleAlert,
} from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useAcoesAdmin } from '../AcoesAdmin'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Painel, PainelTitulo } from '@/components/ui/Painel'
import { KpiCard, Numero } from '@/components/ui/KpiCard'
import { Rotulo } from '@/components/ui/Rotulo'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Selo } from '@/components/ui/Selo'
import { Trilha } from '@/components/ui/Trilha'
import { TOM } from '@/components/ui/tom'
import { EstadoVazio } from '@/components/ui/Estados'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ProximaAcao } from '@/components/shared/ProximaAcao'
import { brokerStatusOf, type SaleView } from '@/lib/sales'
import { diasEntre, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
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
 * O que mudou é o quadro: cabeçalho com resumo vivo, herói no único bloco
 * dourado, a próxima ação observada nos dados, quatro indicadores que filtram
 * a lista, e a lista da seção 9 com colunas declaradas uma vez.
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
      <PageLayout icone={Handshake} tom="marca" titulo="Vendas" subtitulo="Nenhuma venda registrada" cta={cta}>
        <Painel>
          <EstadoVazio
            icone={Handshake}
            titulo="Nenhuma venda registrada"
            descricao="Registre a primeira e ela aparece aqui com as parcelas, o imposto e a comissão do corretor já organizados."
            acao={
              <Button onClick={registrarVenda}>
                <Plus size={16} strokeWidth={1.6} aria-hidden />
                Registrar venda
              </Button>
            }
          />
        </Painel>
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

  const proximaAcao = montarProximaAcao({
    observado,
    hoje,
    aoPagar: setPagando,
    aoFiltrar: (f) => mudarFiltro(f, true),
  })

  return (
    <PageLayout icone={Handshake} tom="marca" titulo="Vendas" subtitulo={subtitulo} cta={cta}>
      <div className="space-y-6 lg:space-y-8">
        {/*
         * O HERÓI — o único bloco dourado da tela. O número fica em t1, não em
         * ouro: é previsão, e ouro neste sistema é dinheiro. A borda Areia já
         * diz qual é o bloco que decide; pintar uma promessa de dourado a
         * faria parecer caixa.
         */}
        <Painel dourado className="rounded-[18px]">
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
            <div className="min-w-0">
              <Rotulo as="h2">Comissão em carteira</Rotulo>
              <div className="-ml-2 mt-2.5">
                <ValorComOrigem
                  valor={emCarteira}
                  posto="heroi"
                  contar
                  rotuloAcessivel="Ver de quais vendas vem a comissão em carteira"
                  aoAbrir={() =>
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
                          meta: [
                            v.development,
                            v.nextDate
                              ? v.hasOverdue
                                ? `a construtora atrasou a parcela de ${formatDateShort(v.nextDate)}`
                                : `próxima em ${formatDateShort(v.nextDate)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · '),
                          valor: v.toReceive,
                          // Parcela que a construtora não pagou é espera, não atraso:
                          // "prevista" mesmo quando a data já passou.
                          situacao: 'prevista' as const,
                          para: `/vendas/${v.id}`,
                        })),
                      vazio: 'Nenhuma venda com parcela em aberto.',
                    })
                  }
                />
              </div>
              <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-t3">
                Comissão já contratada que ainda não entrou, somando as parcelas previstas de todas as vendas
                ativas. Não é dinheiro em conta, e não muda com o filtro da lista.
              </p>
            </div>

            <div className="flex min-w-0 flex-col justify-end gap-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Apoio rotulo="Já entrou" detalhe="das vendas ativas">
                  <Numero valor={jaEntrouCarteira} tamanho="sm" />
                </Apoio>
                <Apoio rotulo="Contratada" detalhe="comissão das vendas ativas">
                  <Numero valor={contratadaCarteira} tamanho="sm" />
                </Apoio>
                <Apoio
                  rotulo="Próxima parcela"
                  detalhe={
                    observado.proxima
                      ? `${formatCurrency(observado.proxima.p.amount)} · ${observado.proxima.venda.title}`
                      : 'nenhuma prevista'
                  }
                >
                  {observado.proxima ? (
                    <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.02em] text-t1 tabular-nums">
                      {formatDateShort(observado.proxima.p.expected_date)}
                    </span>
                  ) : (
                    <span className="font-heading text-[22px] font-extrabold leading-none text-t4">Sem data</span>
                  )}
                </Apoio>
              </dl>
              <div>
                <Trilha
                  recebido={jaEntrouCarteira}
                  liberado={0}
                  previsto={emCarteira}
                  rotuloAcessivel={`Da comissão contratada das vendas ativas, ${formatCurrency(jaEntrouCarteira)} já entraram e ${formatCurrency(emCarteira)} dependem da construtora.`}
                />
                {/* A legenda da trilha, escrita: quem troca número por cor ensina a cor uma vez. */}
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-t3">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-4 rounded-full', TOM.sucesso.ponto)} aria-hidden />
                    já entrou
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-4 rounded-full', TOM.info.ponto)} aria-hidden />
                    depende da construtora
                  </span>
                </p>
              </div>
            </div>
          </div>
        </Painel>

        <ProximaAcao {...proximaAcao} />

        {/*
         * INDICADORES. Cada card leva à lista já filtrada logo abaixo. O tom
         * colore o ícone (o assunto); o número só ganha cor com estado real, e
         * aqui o único estado real é comissão que a imobiliária recebeu e já
         * devia ter repassado.
         */}
        <section aria-labelledby="indicadores-vendas">
          <Rotulo as="h2" className="mb-3">
            <span id="indicadores-vendas">Indicadores</span>
          </Rotulo>
          <div className="stagger-children grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              rotulo="Em andamento"
              valor={contagem.andamento}
              formato="numero"
              icone={CalendarClock}
              tom="info"
              nota={`${formatCurrency(emCarteira)} a receber`}
              aoClicar={() => mudarFiltro('andamento', true)}
            />
            <KpiCard
              rotulo="Parcela sem baixa"
              valor={contagem.atrasadas}
              formato="numero"
              icone={CalendarX2}
              tom="atencao"
              nota="a data passou e a construtora não pagou; é espera, não dívida"
              aoClicar={() => mudarFiltro('atrasadas', true)}
            />
            <KpiCard
              rotulo="Comissão liberada"
              valor={comissaoLiberada}
              icone={Clock}
              tom="atencao"
              estado={comissaoVencida > 0 ? 'risco' : 'normal'}
              nota={
                comissaoVencida > 0
                  ? `${formatCurrency(comissaoVencida)} esperando o repasse há mais de um dia`
                  : 'a imobiliária recebeu e ainda não repassou'
              }
              aoClicar={() => mudarFiltro('comissao', true)}
            />
            <KpiCard
              rotulo="Concluídas"
              valor={contagem.concluidas}
              formato="numero"
              icone={CircleCheck}
              tom="sucesso"
              nota="comissão recebida por inteiro"
              aoClicar={() => mudarFiltro('concluidas', true)}
            />
          </div>
        </section>

        <div id="lista-vendas" className="scroll-mt-40">
          <Painel>
            <PainelTitulo titulo="Cada venda" icone={List} />

            {/*
             * Dois controles: a situação em pílulas com contador e a busca, que
             * cobre unidade, comprador, empreendimento e corretor num campo só.
             */}
            <div className="flex flex-col gap-3 border-b border-line px-4 pb-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <FiltrosRapidos
                rotuloAcessivel="Situação da venda"
                ativo={filtro}
                aoMudar={(f) => mudarFiltro(f)}
                className="-mx-1 px-1"
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
              <div className="relative w-full lg:w-72">
                <Search
                  size={16}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-t4"
                  aria-hidden
                />
                <Input
                  className="pl-9"
                  type="search"
                  placeholder="Unidade, comprador, empreendimento ou corretor"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  aria-label="Buscar venda"
                />
              </div>
            </div>

            {filtradas.length === 0 ? (
              <EstadoVazio
                icone={SearchX}
                titulo="Nada com esse filtro"
                descricao="Ajuste a busca ou troque a situação."
                acao={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setBusca('')
                      mudarFiltro('todas')
                    }}
                  >
                    Ver todas as vendas
                  </Button>
                }
              />
            ) : (
              <>
                <div aria-hidden className={cn(LINHA, 'border-b border-line bg-s3/20 py-2.5')}>
                  <span className={COL.goteira} />
                  <Rotulo as="span" className={COL.venda}>
                    Venda
                  </Rotulo>
                  <Rotulo as="span" className={COL.situacao}>
                    Situação
                  </Rotulo>
                  <Rotulo as="span" className={COL.entrou}>
                    Já entrou
                  </Rotulo>
                  <Rotulo as="span" className={COL.comissao}>
                    Comissão
                  </Rotulo>
                  <span className={COL.seta} />
                </div>

                <ul className="stagger-children">
                  {grupos.map(([ano, lista]) => (
                    <Fragment key={ano}>
                      {grupos.length > 1 && (
                        <li className="flex items-center justify-between gap-3 border-b border-line bg-s3/20 px-4 py-2 sm:px-5">
                          <Rotulo as="span">Vendidas em {ano}</Rotulo>
                          <span className="text-[11px] text-t4 tabular-nums">
                            {plural(lista.length, 'venda', 'vendas')}
                          </span>
                        </li>
                      )}
                      {lista.map((v) => (
                        <LinhaVenda key={v.id} v={v} vencido={observado.vencidoPorVenda.get(v.id) ?? 0} />
                      ))}
                    </Fragment>
                  ))}
                </ul>

                <div className="flex flex-col gap-2 border-t border-line px-4 py-3 text-xs text-t4 sm:px-5 md:flex-row md:items-center md:justify-between">
                  <p>
                    {filtradas.length === vendas.length
                      ? plural(vendas.length, 'venda registrada', 'vendas registradas')
                      : `${filtradas.length} de ${plural(vendas.length, 'venda', 'vendas')}`}
                    . O valor à direita é a comissão contratada da imobiliária.
                  </p>
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span>já entrou</span>
                    <Valor valor={jaEntrou} posto="fato" />
                    <span className="text-t5" aria-hidden>
                      ·
                    </span>
                    <span>depende da construtora</span>
                    <Valor valor={aReceber} posto="fato" />
                  </p>
                </div>
              </>
            )}
          </Painel>
        </div>
      </div>

      <PagarComissao itens={pagando} onFechar={() => setPagando(null)} />
    </PageLayout>
  )
}

/* ------------------------------------------------------------------------- */
/* A lista                                                                    */
/* ------------------------------------------------------------------------- */

/*
 * Largura de cada coluna declarada UMA vez (seção 9): cabeçalho e linha leem
 * daqui, e por isso sempre alinham. As colunas somem da menos para a mais
 * importante: "já entrou" abaixo de lg, a situação abaixo de sm (lá o chip
 * desce para baixo do texto). A comissão nunca some.
 */
const LINHA = 'flex items-center gap-3 px-4 sm:gap-4 sm:px-5'
const COL = {
  goteira: 'flex w-7 shrink-0 justify-center',
  venda: 'min-w-0 flex-1',
  situacao: 'hidden w-[7.5rem] shrink-0 sm:flex',
  entrou: 'hidden w-[9.5rem] shrink-0 text-right lg:block',
  comissao: 'w-[8.5rem] shrink-0 text-right',
  seta: 'flex w-4 shrink-0 justify-end',
} as const

function LinhaVenda({ v, vencido }: { v: SaleView; vencido: number }) {
  const s = situacaoDaVenda(v)
  const cancelada = s === 'cancelada'
  const pct = v.cascade.commission > 0 ? Math.round(v.progress * 100) : 0

  /*
   * Contexto é texto, não pílula (seção 9): empreendimento, corretor e
   * comprador na segunda linha, separados por "·" em t5. O progresso escrito
   * entra aqui só abaixo de lg, onde a coluna "Já entrou" some.
   */
  const contexto: { texto: string; so?: string }[] = [
    { texto: v.development ?? 'sem empreendimento' },
    ...(v.brokerName ? [{ texto: v.brokerName }] : []),
    ...(v.client_name ? [{ texto: v.client_name }] : []),
  ]
  if (!cancelada) {
    contexto.push(
      v.toReceive === 0
        ? { texto: 'comissão recebida por inteiro', so: 'lg:hidden' }
        : { texto: `recebido ${formatCurrency(v.received)} · falta ${formatCurrency(v.toReceive)}`, so: 'lg:hidden' },
    )
  }

  return (
    <li className="border-b border-line last:border-0">
      <Link
        to={`/vendas/${v.id}`}
        className={cn(LINHA, 'lista-linha group py-3.5 transition-colors duration-150 hover:bg-s3/50')}
      >
        <span className={COL.goteira}>
          <Selo situacao={s} />
        </span>

        <span className={cn(COL.venda, 'flex flex-col gap-0.5')}>
          <span className={cn('truncate text-sm font-medium', cancelada ? 'text-t3 line-through' : 'text-t1')}>
            {v.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-t3">
            {contexto.map((c, i) => (
              <span key={i} className={cn('inline-flex items-center gap-1.5', c.so)}>
                {i > 0 && (
                  <span className="text-t5" aria-hidden>
                    ·
                  </span>
                )}
                {c.texto}
              </span>
            ))}
          </span>

          {/*
           * Os dois sinais que pedem alguém, com ícone e palavra. O atraso da
           * construtora é atenção, não risco; a comissão parada na mão da
           * imobiliária é risco quando já passou do dia em que entrou.
           */}
          {!cancelada && v.hasOverdue && v.nextDate && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-t2">
              <CalendarX2 size={13} strokeWidth={1.6} className="shrink-0 text-warning" aria-hidden />a construtora
              atrasou a parcela de {formatDateShort(v.nextDate)}
            </span>
          )}
          {v.brokerReleased > 0 && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-t2">
              {vencido > 0 ? (
                <TriangleAlert size={13} strokeWidth={1.6} className="shrink-0 text-error" aria-hidden />
              ) : (
                <Clock size={13} strokeWidth={1.6} className="shrink-0 text-warning" aria-hidden />
              )}
              {vencido > 0
                ? `comissão de ${formatCurrency(vencido)} esperando o repasse`
                : `comissão de ${formatCurrency(v.brokerReleased)} liberada, a pagar`}
            </span>
          )}

          <span className="mt-1 sm:hidden">
            <ChipSituacao situacao={s} />
          </span>
        </span>

        <span className={COL.situacao}>
          <ChipSituacao situacao={s} />
        </span>

        <span className={COL.entrou}>
          <Valor valor={v.received} posto="fato" tinta={cancelada ? 'text-t4' : 'text-t2'} />
          <span className="mt-0.5 block text-[11px] text-t4 tabular-nums">
            {cancelada ? 'venda cancelada' : `${pct}% da comissão`}
          </span>
        </span>

        {/*
         * O valor que se compara entre vendas é a comissão contratada. Sem cor
         * tônica: parte deste número ainda não é dinheiro.
         */}
        <span className={COL.comissao}>
          <Valor
            valor={v.cascade.commission}
            posto="linha"
            tinta={cancelada ? 'text-t4 line-through' : undefined}
          />
        </span>

        <span className={COL.seta}>
          <ChevronRight
            size={16}
            strokeWidth={1.6}
            className="text-t5 transition-colors group-hover:text-t3"
            aria-hidden
          />
        </span>
      </Link>
    </li>
  )
}

/** Um número de apoio do herói: rótulo, número e a linha que diz de onde ele sai. */
function Apoio({ rotulo, detalhe, children }: { rotulo: string; detalhe?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Rotulo as="dt">{rotulo}</Rotulo>
      <dd className="mt-2">
        {children}
        {detalhe && <span className="mt-1.5 block truncate text-[11px] text-t4">{detalhe}</span>}
      </dd>
    </div>
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
function montarProximaAcao({
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
}): Parameters<typeof ProximaAcao>[0] {
  const { comissoesVencidas, parcelasSemBaixa, proxima } = observado
  type Principal = NonNullable<Parameters<typeof ProximaAcao>[0]['principal']>
  type Outra = NonNullable<Parameters<typeof ProximaAcao>[0]['outras']>[number]
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
        icone: CalendarX2,
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

  return {
    principal,
    outras,
    tudoEmDia: {
      titulo: 'Tudo em dia',
      sugestao: proxima
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
