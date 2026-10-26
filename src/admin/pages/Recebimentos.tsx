import { Fragment, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, CalendarClock, CalendarRange, CircleCheck, Hourglass, Layers } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { ParAgoraPrevisto } from '@/components/ui/ParAgoraPrevisto'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Barra, LegendaBarra } from '@/components/ui/Barra'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { EstadoVazio } from '@/components/ui/Estados'
import { situacaoDeTela, type Situacao } from '@/lib/situacao'
import { fraseDaEtapa } from '@/lib/etapas'
import { formatCurrency, parseDateOnly } from '@/lib/format'
import type { SaleView } from '@/lib/sales'
import type { SaleInstallment } from '@/types'
import { cn } from '@/lib/utils'

/*
 * RECEBIMENTOS DA IMOBILIÁRIA (19/10/2026, pedido do Rafael: "uma tela de
 * recebimentos da imobiliária com a possibilidade de ver somente o que fica
 * da parte da imobiliária e do recebimento geral, por calendário, igual é do
 * corretor").
 *
 * É o calendário do corretor, olhado do lado da empresa. Cada parcela de
 * comissão das vendas da Souza, mês a mês, em duas leituras:
 *
 *   · Geral — a parcela bruta, o que a construtora paga (`amount`);
 *   · Da imobiliária — o que sobra depois de ISS, Simples, corretor e sócio
 *     (`net_amount`, o mesmo "Fica para a imobiliária" da ficha da venda).
 *
 * Nada é recalculado: os dois números estão gravados em cada parcela. Venda
 * de pessoa física fica de fora (não é dinheiro da empresa), e parcela
 * cancelada também.
 *
 * Os três estados, com as palavras do Receber: recebida (verde), em atraso
 * (âmbar — a construtora não pagou, não é dívida de ninguém) e prevista
 * (azul-petróleo). "Vencida" não aparece aqui: a imobiliária não deve nada
 * nesta tela.
 *
 * A parcela recebida se posiciona pela data em que caiu; a pendente, pela
 * data prevista. O herói é o que já entrou — dinheiro que existe — e, como
 * no corretor, não muda com o período nem com o filtro de situação. Muda com
 * a leitura (geral ou da imobiliária), que é a pergunta da tela.
 */

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Arredonda em centavos. */
const c2 = (n: number) => Math.round(n * 100) / 100
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

type Visao = 'geral' | 'imobiliaria'
type Filtro = 'tudo' | 'atraso' | 'previstas' | 'recebidas'

/** O estado da parcela do lado da imobiliária: só três. */
type Estado = 'recebida' | 'atraso' | 'prevista'

interface Item {
  p: SaleInstallment
  venda: SaleView
  estado: Estado
  /** A situação que o selo e o chip desenham. */
  s: Situacao
  /** A data que põe a parcela na linha do tempo. */
  quando: string
}

const LEGENDA = [
  { tom: 'sucesso' as const, rotulo: 'recebido' },
  { tom: 'atencao' as const, rotulo: 'em atraso, a construtora não pagou' },
  { tom: 'info' as const, rotulo: 'previsto' },
]

function passa(filtro: Filtro, e: Estado): boolean {
  if (filtro === 'atraso') return e === 'atraso'
  if (filtro === 'previstas') return e === 'prevista' || e === 'atraso'
  if (filtro === 'recebidas') return e === 'recebida'
  return true
}

export function Recebimentos() {
  const { vendas, hoje } = useAdmin()
  const { abrir } = useComposicao()
  const [params, setParams] = useSearchParams()

  const visao: Visao = params.get('visao') === 'imobiliaria' ? 'imobiliaria' : 'geral'
  const filtro: Filtro = (['atraso', 'previstas', 'recebidas'] as const).find((f) => f === params.get('foco')) ?? 'tudo'
  const periodo = params.get('ano') ?? 'tudo'

  /* Trocar leitura, filtro ou ano não é navegar: `replace`, para o "voltar" não andar pílula por pílula. */
  const trocar = useCallback(
    (chave: string, valor: string, padrao: string) =>
      setParams(
        (atual) => {
          const p = new URLSearchParams(atual)
          if (valor === padrao) p.delete(chave)
          else p.set(chave, valor)
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const todas = useMemo<Item[]>(() => {
    const itens: Item[] = []
    for (const venda of vendas) {
      if (venda.is_personal || venda.status === 'cancelada') continue
      for (const p of venda.installments) {
        if (p.status === 'cancelada') continue
        const recebida = p.status === 'recebida'
        const estado: Estado = recebida ? 'recebida' : p.expected_date < hoje ? 'atraso' : 'prevista'
        itens.push({
          p,
          venda,
          estado,
          s: situacaoDeTela(p.status, p.expected_date, hoje),
          quando: recebida ? p.received_date ?? p.expected_date : p.expected_date,
        })
      }
    }
    return itens.sort((a, b) => (a.quando === b.quando ? a.p.idx - b.p.idx : a.quando < b.quando ? -1 : 1))
  }, [vendas, hoje])

  /** O valor da parcela na leitura escolhida. */
  const valorDe = useCallback(
    (p: SaleInstallment) => (visao === 'geral' ? p.amount : p.net_amount),
    [visao],
  )
  const soma = (l: Item[]) => c2(l.reduce((t, { p }) => t + valorDe(p), 0))

  const noPeriodo = useMemo(
    () => (periodo === 'tudo' ? todas : todas.filter((it) => it.quando.slice(0, 4) === periodo)),
    [todas, periodo],
  )
  const lista = useMemo(() => noPeriodo.filter((it) => passa(filtro, it.estado)), [noPeriodo, filtro])

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>([Number(hoje.slice(0, 4))])
    for (const it of todas) anos.add(Number(it.quando.slice(0, 4)))
    return [...anos].sort((a, b) => a - b)
  }, [todas, hoje])
  const anosDoCalendario = periodo === 'tudo' ? anosDisponiveis : [Number(periodo)]

  const meses = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of lista) {
      const chave = it.quando.slice(0, 7)
      const ja = m.get(chave)
      if (ja) ja.push(it)
      else m.set(chave, [it])
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [lista])

  const recebidas = todas.filter((it) => it.estado === 'recebida')
  const emAtraso = todas.filter((it) => it.estado === 'atraso')
  const previstas = todas.filter((it) => it.estado === 'prevista')

  const nomeDaVisao = visao === 'geral' ? 'geral, parcela bruta' : 'só a parte da imobiliária'

  /*
   * Cada item da composição traz a OUTRA leitura na meta: olhando o bruto, ele
   * vê quanto fica; olhando o que fica, ele vê de quanto saiu.
   */
  const item = ({ p, venda, s }: Item) => ({
    id: p.id,
    titulo: venda.title,
    meta: [
      visao === 'geral' ? `fica ${formatCurrency(p.net_amount)}` : `de ${formatCurrency(p.amount)} bruto`,
      fraseDaEtapa(p, hoje),
    ]
      .filter(Boolean)
      .join(' · '),
    valor: valorDe(p),
    situacao: s,
    idx: p.idx,
    count: p.count,
    para: `/vendas/${venda.id}`,
    parcelaId: p.id,
  })

  const compor = (rotulo: string, titulo: string, itens: Item[], explica?: string) =>
    abrir({
      rotulo,
      titulo,
      explica: [
        explica,
        visao === 'geral'
          ? 'Valores da parcela bruta, antes de imposto e corretor.'
          : 'Valores do que fica para a imobiliária: parcela menos ISS, Simples, corretor e sócio.',
      ]
        .filter(Boolean)
        .join(' '),
      total: soma(itens),
      itens: itens.map(item),
      vazio: 'Nenhuma parcela aqui.',
    })

  const subtitulo = [
    `${formatCurrency(soma(recebidas))} recebido`,
    emAtraso.length > 0 ? plural(emAtraso.length, 'parcela em atraso', 'parcelas em atraso') : null,
    nomeDaVisao,
  ]
    .filter(Boolean)
    .join(' · ')

  const faixa = (
    <div className="flex min-w-0 flex-col gap-3">
      <FiltrosRapidos<Visao>
        rotuloAcessivel="Qual valor mostrar"
        ativo={visao}
        aoMudar={(v) => trocar('visao', v, 'geral')}
        filtros={[
          { id: 'geral', rotulo: 'Recebimento geral', icone: Layers, dica: 'A parcela bruta, como a construtora paga' },
          {
            id: 'imobiliaria',
            rotulo: 'Parte da imobiliária',
            icone: Building2,
            dica: 'O que fica depois de imposto, corretor e sócio',
          },
        ]}
      />
      <FiltrosRapidos<Filtro>
        rotuloAcessivel="Quais parcelas mostrar"
        ativo={filtro}
        aoMudar={(f) => trocar('foco', f, 'tudo')}
        filtros={[
          { id: 'tudo', rotulo: 'Tudo', contador: noPeriodo.length },
          {
            id: 'recebidas',
            rotulo: 'Recebidas',
            icone: CircleCheck,
            contador: noPeriodo.filter((it) => it.estado === 'recebida').length,
          },
          {
            id: 'previstas',
            rotulo: 'A receber',
            icone: CalendarClock,
            contador: noPeriodo.filter((it) => it.estado !== 'recebida').length,
            dica: 'Tudo o que ainda não entrou, em atraso ou não',
          },
          {
            id: 'atraso',
            rotulo: 'Em atraso',
            icone: Hourglass,
            contador: noPeriodo.filter((it) => it.estado === 'atraso').length,
            dica: 'A data passou e a construtora não pagou',
          },
        ]}
      />
      <FiltrosRapidos
        rotuloAcessivel="Período"
        ativo={periodo}
        aoMudar={(v) => trocar('ano', v, 'tudo')}
        filtros={[
          ...anosDisponiveis.map((a) => ({
            id: String(a),
            rotulo: String(a),
            contador: todas.filter((it) => it.quando.slice(0, 4) === String(a)).length,
          })),
          { id: 'tudo', rotulo: 'Todos os anos', contador: todas.length },
        ]}
      />
    </div>
  )

  if (todas.length === 0) {
    return (
      <PageLayout subtitulo="Nenhuma parcela de comissão" faixa={faixa}>
        <Cartao rotuloAcessivel="Recebimentos">
          <EstadoVazio
            icone={CalendarRange}
            titulo="Nenhum recebimento ainda"
            descricao="Quando uma venda for registrada, as parcelas da comissão aparecem aqui, mês a mês."
          />
        </Cartao>
      </PageLayout>
    )
  }

  const filtrosVazios: Record<Filtro, string> = {
    tudo: 'Nenhuma parcela neste período.',
    recebidas: 'Nenhuma parcela recebida neste período.',
    previstas: 'Nada a receber neste período.',
    atraso: 'Nenhuma parcela em atraso. É o melhor cenário.',
  }

  // O primeiro mês com parcela de hoje em diante ganha o marco de HOJE, se houver passado antes.
  const temPassado = lista.some((it) => it.quando < hoje)
  const mesDoMarco = temPassado ? meses.find(([, itens]) => itens.some((it) => it.quando >= hoje))?.[0] : undefined

  return (
    <PageLayout subtitulo={subtitulo} faixa={faixa}>
      <Heroi
        variante="ouro"
        rotulo={visao === 'geral' ? 'Já recebido · geral' : 'Já recebido · parte da imobiliária'}
        valor={soma(recebidas)}
        contar
        rotuloAcessivel="Ver de quais vendas vem o que já entrou"
        aoAbrir={() => compor('Já recebido', 'O que já entrou', recebidas)}
        frase={
          visao === 'geral'
            ? 'Toda a comissão que a construtora já pagou, parcela bruta, de todas as vendas da imobiliária.'
            : 'O que ficou para a imobiliária do que já entrou: a parcela menos ISS, Simples, corretor e sócio.'
        }
        barra={
          <div className="flex flex-col gap-2">
            <Barra
              rotuloAcessivel={`${formatCurrency(soma(recebidas))} recebido, ${formatCurrency(
                soma(emAtraso),
              )} em atraso e ${formatCurrency(soma(previstas))} previsto.`}
              segmentos={[
                { valor: soma(recebidas), tom: 'sucesso' },
                { valor: soma(emAtraso), tom: 'atencao' },
                { valor: soma(previstas), tom: 'info' },
              ]}
            />
            <LegendaBarra itens={LEGENDA} />
          </div>
        }
        apoios={[
          {
            rotulo: 'Em atraso',
            valor: soma(emAtraso),
            previsto: true,
            rotuloAcessivel: 'Ver as parcelas em atraso',
            aoAbrir: () =>
              compor(
                'Em atraso',
                'A data passou e a construtora não pagou',
                emAtraso,
                'Não é dívida de ninguém: é cobrança. Se souber a data nova, reagende na ficha da venda.',
              ),
          },
          {
            rotulo: 'Previsto',
            valor: soma(previstas),
            previsto: true,
            rotuloAcessivel: 'Ver as parcelas previstas',
            aoAbrir: () =>
              compor('Previsto', 'Previsão, não promessa', previstas, 'Depende da construtora pagar. A data pode mudar.'),
          },
        ]}
      />

      {anosDoCalendario.map((ano) => (
        <CalendarioDoAno
          key={ano}
          ano={ano}
          itens={noPeriodo.filter((it) => it.quando.slice(0, 4) === String(ano))}
          hoje={hoje}
          valorDe={valorDe}
          aoAbrirMes={(nome, itens) =>
            compor(
              nome,
              `Recebimentos de ${nome}`,
              itens,
              'Cada parcela pela data em que caiu, ou pela data prevista se ainda não entrou.',
            )
          }
        />
      ))}

      <Cartao>
        <Cartao.Cabecalho
          titulo="Cronograma"
          icone={CalendarRange}
          meta={`${nomeDaVisao} · ${plural(lista.length, 'parcela', 'parcelas')}`}
        />
        {lista.some((it) => it.estado === 'atraso') && (
          <Cartao.Corpo>
            <Dica>
              Em atraso é parcela com a data passada que a construtora ainda não pagou. Não é dívida da imobiliária: é
              cobrança.
            </Dica>
          </Cartao.Corpo>
        )}
        {meses.length === 0 ? (
          <EstadoVazio
            icone={CalendarRange}
            titulo="Nada com esse filtro"
            descricao={filtrosVazios[filtro]}
            acao={
              <Button variant="secundario" onClick={() => trocar('foco', 'tudo', 'tudo')}>
                Mostrar tudo
              </Button>
            }
          />
        ) : (
          <Cartao.Lista
            rotuloAcessivel="Cronograma, por mês"
            chaveEscada={`${filtro}-${periodo}-${visao}`}
            colunas={{ goteira: true, situacao: true, valor: true, fim: true }}
          >
            {meses.map(([mes, itens]) => {
              const nome = parseDateOnly(`${mes}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              const entrou = itens.filter((it) => it.estado === 'recebida')
              const falta = itens.filter((it) => it.estado !== 'recebida')
              const corte = mes === mesDoMarco ? itens.findIndex((it) => it.quando >= hoje) : -1
              return (
                <Fragment key={mes}>
                  <LinhaGrupo
                    rotulo={nome}
                    contador={plural(itens.length, 'parcela', 'parcelas')}
                    par={
                      <ParAgoraPrevisto
                        agora={{
                          valor: soma(entrou),
                          rotuloAcessivel: `Ver o que entrou em ${nome}`,
                          aoAbrir: () => compor(nome, `Recebido em ${nome}`, entrou),
                        }}
                        previsto={{
                          valor: soma(falta),
                          rotuloAcessivel: `Ver o que está previsto em ${nome}`,
                          aoAbrir: () => compor(nome, `Previsto para ${nome}`, falta),
                        }}
                      />
                    }
                  />
                  {itens.map((it, i) => (
                    <Fragment key={it.p.id}>
                      {i === corte && <LinhaGrupo rotulo="Hoje" hoje />}
                      <Linha
                        goteira={<Selo situacao={it.s} idx={it.p.idx} count={it.p.count} />}
                        titulo={it.venda.title}
                        meta={[
                          it.p.count > 1 ? `parcela ${it.p.idx}/${it.p.count}` : null,
                          visao === 'geral'
                            ? `fica ${formatCurrency(it.p.net_amount)}`
                            : `de ${formatCurrency(it.p.amount)} bruto`,
                          fraseDaEtapa(it.p, hoje),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        situacao={<ChipSituacao situacao={it.s} />}
                        valor={
                          it.estado === 'recebida' ? (
                            <Valor valor={valorDe(it.p)} posto="linha" estado="recebido" />
                          ) : (
                            <Valor valor={valorDe(it.p)} posto="linha" previsto />
                          )
                        }
                        para={`/vendas/${it.venda.id}?parcela=${it.p.id}`}
                      />
                    </Fragment>
                  ))}
                </Fragment>
              )
            })}
          </Cartao.Lista>
        )}
      </Cartao>
    </PageLayout>
  )
}

/*
 * O CALENDÁRIO DO ANO — o mesmo do corretor: doze células, uma por mês, com
 * o total e a trilha dos três estados. Mês vazio continua desenhado, apagado:
 * buraco no caixa é informação. Tocar num mês abre as parcelas dele.
 */
function CalendarioDoAno({
  ano,
  itens,
  hoje,
  valorDe,
  aoAbrirMes,
}: {
  ano: number
  itens: Item[]
  hoje: string
  valorDe: (p: SaleInstallment) => number
  aoAbrirMes: (nome: string, itens: Item[]) => void
}) {
  const mesAtual = hoje.slice(0, 4) === String(ano) ? Number(hoje.slice(5, 7)) - 1 : -1
  const somar = (l: Item[]) => c2(l.reduce((t, { p }) => t + valorDe(p), 0))
  const celulas = MESES_CURTOS.map((nome, i) => {
    const chave = `${ano}-${String(i + 1).padStart(2, '0')}`
    const doMes = itens.filter((it) => it.quando.slice(0, 7) === chave)
    return {
      i,
      nome,
      itens: doMes,
      total: somar(doMes),
      recebido: somar(doMes.filter((it) => it.estado === 'recebida')),
      atraso: somar(doMes.filter((it) => it.estado === 'atraso')),
      previsto: somar(doMes.filter((it) => it.estado === 'prevista')),
    }
  })
  const recebidoNoAno = c2(celulas.reduce((t, c) => t + c.recebido, 0))
  const totalDoAno = c2(celulas.reduce((t, c) => t + c.total, 0))

  return (
    <Cartao>
      <Cartao.Cabecalho
        titulo={`Calendário de ${ano}`}
        icone={CalendarRange}
        meta={`${formatCurrency(recebidoNoAno)} recebido de ${formatCurrency(totalDoAno)} no ano`}
      />
      <Cartao.Corpo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {celulas.map((c) => {
            const vazio = c.itens.length === 0
            const conteudo = (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-label text-rotulo">{c.nome}</span>
                  {c.i === mesAtual && <span className="font-label text-brand-text text-rotulo">hoje</span>}
                </span>
                {vazio ? (
                  <span className="text-nota text-t4">sem parcela</span>
                ) : (
                  <>
                    <Valor valor={c.total} posto="fato" forte />
                    <Barra
                      animarEntrada={false}
                      segmentos={[
                        { valor: c.recebido, tom: 'sucesso' },
                        { valor: c.atraso, tom: 'atencao' },
                        { valor: c.previsto, tom: 'info' },
                      ]}
                      rotuloAcessivel={`${MESES_LONGOS[c.i]}: ${formatCurrency(c.recebido)} recebido, ${formatCurrency(
                        c.atraso,
                      )} em atraso e ${formatCurrency(c.previsto)} previsto.`}
                    />
                    <span className="text-nota text-t-meta">{plural(c.itens.length, 'parcela', 'parcelas')}</span>
                  </>
                )}
              </>
            )
            const classes = cn(
              'flex min-w-0 flex-col gap-2 rounded-caixa border p-4 text-left',
              c.i === mesAtual ? 'border-borda-ouro' : 'border-fio-linha',
              vazio ? 'text-t4' : 'text-t2',
            )
            return vazio ? (
              <span key={c.nome} className={classes}>
                {conteudo}
              </span>
            ) : (
              <button
                key={c.nome}
                type="button"
                onClick={() => aoAbrirMes(`${MESES_LONGOS[c.i]} de ${ano}`, c.itens)}
                className={cn(classes, 'hover:bg-linha-hover')}
              >
                {conteudo}
              </button>
            )
          })}
        </div>
      </Cartao.Corpo>
      <Cartao.Rodape>
        <LegendaBarra itens={LEGENDA} />
      </Cartao.Rodape>
    </Cartao>
  )
}
