import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Handshake } from 'lucide-react'
import { useCorretor, type CorretorParcela, type CorretorVenda } from '../CorretorData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Cascata, LinhaCascata, TotalCascata } from '@/components/ui/Cascata'
import { Trilha, LegendaTrilha } from '@/components/ui/Trilha'
import { EmptyState } from '@/components/ui/EmptyState'
import { VOCABULARIO, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDate, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * MINHAS VENDAS — a carteira do corretor, e o lugar onde um número vira conta.
 *
 * O pedido central do cliente é este: clicar num valor de comissão e ver de QUAL
 * venda ele vem — e, dentro dela, como aquele número foi formado. Por isso a
 * tela aceita `?venda=<id>`: o Início e a folha de composição apontam para cá, e
 * a venda chega ABERTA e destacada, sem procurar numa lista.
 *
 * O HERÓI É O DINHEIRO QUE EXISTE: já recebido + já liberado. Não é o total
 * contratado.
 *
 * A escolha não é de gosto. O total contratado soma parcelas que só viram
 * comissão dele quando a construtora pagar a imobiliária — pôr isso no degrau
 * herói faria a tela prometer o que ninguém pode cumprir, que é exatamente o
 * defeito que o Início do corretor corrigiu. Além disso é o mesmo tipo de número
 * do herói do Início ("A receber agora") e do de Recebimentos: as três telas
 * passam a dizer a mesma coisa, e nenhuma contradiz a outra.
 *
 * O contratado não some. Ele está escrito por extenso no contexto do herói, na
 * trilha de cada venda e na linha "depende da construtora" — sempre com a
 * palavra que diz de quem ele depende, nunca em degrau herói e nunca com cor.
 */

/** Arredonda em centavos — a diferença de R$ 0,04 é o que trava uma conferência. */
const c2 = (n: number) => Math.round(n * 100) / 100

/**
 * A situação da VENDA, derivada das parcelas dela.
 *
 * A ordem não é alfabética nem cronológica: é a ordem do que ele precisa saber
 * primeiro. Atrasada vem antes de tudo (a imobiliária recebeu e não repassou),
 * depois o que está a receber, depois o que ainda espera a construtora. Só
 * quando não sobrou nada pendente a venda inteira é "Recebida".
 */
function resumoDaVenda(situacoes: Situacao[]): Situacao {
  if (situacoes.length === 0) return 'prevista'
  if (situacoes.some((s) => s === 'vencida')) return 'vencida'
  if (situacoes.some((s) => s === 'liberada')) return 'liberada'
  if (situacoes.some((s) => s === 'prevista')) return 'prevista'
  return 'recebida'
}

interface VendaNaTela {
  v: CorretorVenda
  parcelas: { p: CorretorParcela; s: Situacao }[]
  recebido: number
  liberado: number
  previsto: number
  /** Recebido + liberado: o que já é dinheiro dele nesta venda. */
  agora: number
  resumo: Situacao
}

/**
 * Qual parcela já abre a conta quando ele abre a venda.
 *
 * Abrir uma venda tem que MOSTRAR a conta, não oferecer mais um toque para
 * chegar nela — ele está em pé, entre duas visitas, com o polegar. Mas abrir as
 * nove cascatas de uma vez enterraria a resposta no meio da tela. Então abre a
 * que ele veio ver: a atrasada primeiro, depois a que está a receber, depois a
 * próxima que a construtora deve pagar. Se não há nenhuma pendente, a última
 * que caiu — a que ele confere contra o extrato.
 */
function parcelaDeDestaque(c: VendaNaTela | undefined, hoje: string): string | null {
  if (!c || c.parcelas.length === 0) return null
  const alvo =
    c.parcelas.find(({ s }) => s === 'vencida') ??
    c.parcelas.find(({ s }) => s === 'liberada') ??
    c.parcelas.find(({ s, p }) => s === 'prevista' && p.expected_date >= hoje) ??
    c.parcelas.find(({ s }) => s === 'prevista') ??
    c.parcelas[c.parcelas.length - 1]
  return alvo.p.id
}

export function MinhasVendas() {
  const { vendas, parcelas } = useCorretor()
  const { abrir } = useComposicao()
  const [params, setParams] = useSearchParams()
  const vendaDoLink = params.get('venda')
  const [aberta, setAberta] = useState<string | null>(() => vendaDoLink)
  const [parcelaAberta, setParcelaAberta] = useState<string | null>(null)
  const destacada = useRef<HTMLLIElement | null>(null)
  const linkAplicado = useRef<string | null>(null)
  const hoje = toDateOnly(new Date())

  /*
   * As parcelas de cada venda, já traduzidas para a situação de TELA — nunca
   * para o status cru. `situacaoDeTela` é quem separa atraso de espera: parcela
   * que a construtora não pagou nunca vira dívida da imobiliária com ele.
   */
  const carteira = useMemo<VendaNaTela[]>(() => {
    const porVenda = new Map<string, { p: CorretorParcela; s: Situacao }[]>()
    for (const p of parcelas) {
      const item = { p, s: situacaoDeTela(p.status, p.expected_date, hoje) }
      const jaTem = porVenda.get(p.sale_id)
      if (jaTem) jaTem.push(item)
      else porVenda.set(p.sale_id, [item])
    }
    return vendas.map((v) => {
      const suas = [...(porVenda.get(v.id) ?? [])].sort((a, b) => a.p.idx - b.p.idx)
      // Soma sempre o líquido dele (comissão − desconto combinado), que é o
      // mesmo número que aparece na linha de cada parcela logo abaixo. Assim a
      // conta da venda fecha com a lista que a compõe, na tela, a olho.
      const soma = (fn: (s: Situacao) => boolean) =>
        c2(
          suas
            .filter(({ s }) => fn(s))
            .reduce((t, { p }) => t + p.broker_amount - p.broker_adjustment, 0),
        )
      const recebido = soma((s) => s === 'recebida')
      const liberado = soma((s) => s === 'liberada' || s === 'vencida')
      const previsto = soma((s) => s === 'prevista')
      return {
        v,
        parcelas: suas,
        recebido,
        liberado,
        previsto,
        agora: c2(recebido + liberado),
        resumo: resumoDaVenda(suas.map(({ s }) => s)),
      }
    })
  }, [vendas, parcelas, hoje])

  /*
   * Chegou por link (`?venda=`): a venda abre sozinha, já com a conta da
   * parcela que ele veio conferir. Aplicado uma vez por link — se ele abrir
   * outra parcela depois, um recarregamento de dados não desfaz a escolha dele.
   */
  useEffect(() => {
    if (!vendaDoLink) {
      linkAplicado.current = null
      return
    }
    if (linkAplicado.current === vendaDoLink) return
    const c = carteira.find((x) => x.v.id === vendaDoLink)
    if (!c) return
    linkAplicado.current = vendaDoLink
    setAberta(vendaDoLink)
    setParcelaAberta(parcelaDeDestaque(c, hoje))
  }, [vendaDoLink, carteira, hoje])

  /*
   * E rola até ela. Sem `smooth`: movimento neste sistema significa que algo se
   * moveu no mundo, e aqui nada se moveu — a tela só está indo onde ele pediu.
   */
  useEffect(() => {
    if (vendaDoLink && destacada.current) destacada.current.scrollIntoView({ block: 'center' })
  }, [vendaDoLink, aberta])

  const alternarVenda = (id: string) => {
    const fechando = aberta === id
    setAberta(fechando ? null : id)
    setParcelaAberta(fechando ? null : parcelaDeDestaque(carteira.find((c) => c.v.id === id), hoje))
    // Assim que ele toca por conta própria, o destaque do link sai: o realce
    // existe para dizer "é esta que você clicou", não para grudar na tela.
    if (vendaDoLink) setParams({}, { replace: true })
  }

  if (vendas.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Nenhuma venda registrada"
        description="Assim que a imobiliária registrar uma venda sua, ela aparece aqui com o cronograma da comissão e a conta aberta."
      />
    )
  }

  const totalAgora = c2(carteira.reduce((t, c) => t + c.agora, 0))
  const totalPrevisto = c2(carteira.reduce((t, c) => t + c.previsto, 0))
  const comDinheiro = carteira.filter((c) => c.agora > 0)
  const linkPerdido = vendaDoLink != null && !vendas.some((v) => v.id === vendaDoLink)

  return (
    <div className="animate-fade-in">
      <Heroi
        rotulo="Sua comissão nesta carteira"
        contexto={
          <>
            O que já foi pago a você mais o que a imobiliária já recebeu e vai te repassar.{' '}
            {totalPrevisto > 0 ? (
              <>
                Fora desta conta há <Valor valor={totalPrevisto} posto="fato" tinta="text-content-muted" />{' '}
                que dependem da construtora pagar a imobiliária primeiro.
              </>
            ) : (
              'Nenhuma parcela sua está esperando a construtora hoje.'
            )}
          </>
        }
      >
        {totalAgora > 0 ? (
          <ValorComOrigem
            valor={totalAgora}
            posto="heroi"
            rotuloAcessivel="Ver de quais vendas vem a sua comissão"
            aoAbrir={() =>
              abrir({
                rotulo: 'Sua comissão',
                titulo: 'De quais vendas vem',
                explica:
                  'Só o que já é dinheiro: parcelas pagas a você e parcelas que a imobiliária já recebeu.',
                total: totalAgora,
                itens: comDinheiro.map((c) => ({
                  id: c.v.id,
                  titulo: c.v.title,
                  meta: [c.v.client_name, c.v.development].filter(Boolean).join(' · ') || undefined,
                  valor: c.agora,
                  situacao: c.resumo,
                  para: `/minhas-vendas?venda=${c.v.id}`,
                })),
                nota:
                  totalPrevisto > 0
                    ? 'As parcelas previstas ficam fora desta conta. Elas só viram comissão sua quando a construtora pagar a imobiliária.'
                    : undefined,
              })
            }
          />
        ) : (
          <Valor valor={0} posto="heroi" tinta="text-content-muted" />
        )}
      </Heroi>

      {/*
       * O link apontou para uma venda que não está mais na lista (cancelada, ou
       * de outro corretor). Dizer isso em texto é melhor que uma lista que
       * parece normal e não destaca nada.
       */}
      {linkPerdido && (
        <p className="mb-6 border-b border-rule pb-3 text-base text-content-muted">
          A venda que você abriu não está na sua lista. Ela pode ter sido cancelada — se não for isso,
          fale com a imobiliária.
        </p>
      )}

      <Secao
        titulo="Suas vendas"
        acao={
          <span className="text-sm text-content-muted">
            {vendas.length === 1 ? '1 venda' : `${vendas.length} vendas`}
          </span>
        }
      >
        <Lista>
          {carteira.map((c) => {
            const destaque = c.v.id === vendaDoLink
            const abertaAgora = c.v.id === aberta
            return (
              <Fragment key={c.v.id}>
                <Linha
                  className={cn(destaque && 'bg-action-soft')}
                  selo={<Selo situacao={c.resumo} />}
                  titulo={c.v.title}
                  meta={
                    <>
                      {[c.v.client_name, c.v.development, `vendida em ${formatDate(c.v.sale_date)}`]
                        .filter(Boolean)
                        .join(' · ')}
                      {c.previsto > 0 && (
                        <span className="block">
                          e mais <Valor valor={c.previsto} posto="fato" tinta="text-content-muted" />{' '}
                          dependendo da construtora
                        </span>
                      )}
                    </>
                  }
                  situacao={<ChipSituacao situacao={c.resumo} perfil="corretor" />}
                  // Sem tinta tônica: este número mistura o que já caiu com o
                  // que está liberado, e pintá-lo de verde diria que tudo já
                  // entrou. O tamanho é que codifica o posto; a cor, não.
                  valor={<Valor valor={c.agora} posto="linha" />}
                  aoClicar={() => alternarVenda(c.v.id)}
                />

                {abertaAgora && (
                  <li
                    ref={destaque ? destacada : undefined}
                    className={cn('px-1 pb-5 pt-3', destaque && 'bg-action-soft')}
                  >
                    <DadosDaVenda venda={c.v} />

                    <div className="mt-4 space-y-2">
                      <Trilha
                        recebido={c.recebido}
                        liberado={c.liberado}
                        previsto={c.previsto}
                        rotuloAcessivel={`Nesta venda: ${formatCurrency(c.recebido)} recebido, ${formatCurrency(
                          c.liberado,
                        )} liberado a receber e ${formatCurrency(c.previsto)} dependendo da construtora.`}
                      />
                      <LegendaTrilha />
                      {/* A barra é reforço; o número vem escrito ao lado, sempre. */}
                      <dl className="flex flex-wrap gap-x-6 gap-y-2">
                        <NumeroDaTrilha rotulo="recebido" valor={c.recebido} tinta="text-income" />
                        <NumeroDaTrilha rotulo="a receber" valor={c.liberado} />
                        <NumeroDaTrilha
                          rotulo="depende da construtora"
                          valor={c.previsto}
                          tinta="text-content-muted"
                        />
                      </dl>
                    </div>

                    <p className="mb-1 mt-5 border-b border-line pb-1.5 text-xs font-medium uppercase tracking-wide text-content-muted">
                      {c.parcelas.length === 1
                        ? 'a parcela desta venda'
                        : `as ${c.parcelas.length} parcelas desta venda`}
                    </p>
                    <Lista>
                      {c.parcelas.map(({ p, s }) => (
                        <Fragment key={p.id}>
                          <Linha
                            selo={<Selo situacao={s} idx={p.idx} count={p.count} />}
                            titulo={p.count > 1 ? `Parcela ${p.idx} de ${p.count}` : 'Parcela única'}
                            meta={
                              <FraseDeTempo
                                situacao={s}
                                prevista={p.expected_date}
                                liberada={p.received_date}
                                recebida={p.paid_date}
                              />
                            }
                            situacao={<ChipSituacao situacao={s} perfil="corretor" />}
                            valor={
                              <Valor
                                valor={c2(p.broker_amount - p.broker_adjustment)}
                                posto="linha"
                                tinta={VOCABULARIO[s].tinta}
                              />
                            }
                            aoClicar={() =>
                              setParcelaAberta((atual) => (atual === p.id ? null : p.id))
                            }
                          />
                          {parcelaAberta === p.id && (
                            <li className="px-1 pb-4 pt-3">
                              <ContaDaParcela p={p} s={s} />
                            </li>
                          )}
                        </Fragment>
                      ))}
                    </Lista>
                  </li>
                )}
              </Fragment>
            )
          })}
        </Lista>
      </Secao>
    </div>
  )
}

/** Um número da trilha, escrito ao lado dela. */
function NumeroDaTrilha({ rotulo, valor, tinta }: { rotulo: string; valor: number; tinta?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-content-muted">{rotulo}</dt>
      <dd className="mt-0.5">
        <Valor valor={valor} posto="fato" tinta={tinta} />
      </dd>
    </div>
  )
}

/**
 * Os dados da venda.
 *
 * "Valor do imóvel não informado" é texto, não R$ 0,00: zero é um fato, e
 * afirmar que um apartamento vale zero é pior que admitir que o campo está
 * vazio. Quando o sistema não sabe, ele escreve que não sabe.
 */
function DadosDaVenda({ venda }: { venda: CorretorVenda }) {
  return (
    <dl className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="min-w-0 text-base text-content-muted">Valor do imóvel</dt>
        <dd className="shrink-0">
          {venda.property_value != null ? (
            <Valor valor={venda.property_value} posto="fato" />
          ) : (
            <span className="text-base text-content-muted">valor do imóvel não informado</span>
          )}
        </dd>
      </div>
      {venda.broker_pct != null && (
        <div className="flex items-baseline justify-between gap-4">
          <dt className="min-w-0 text-base text-content-muted">Sua parte</dt>
          <dd className="shrink-0 text-base font-medium text-content">
            {venda.broker_pct}% da base de cada parcela
          </dd>
        </div>
      )}
      {venda.unit && (
        <div className="flex items-baseline justify-between gap-4">
          <dt className="min-w-0 text-base text-content-muted">Unidade</dt>
          <dd className="shrink-0 text-base font-medium text-content">{venda.unit}</dd>
        </div>
      )}
    </dl>
  )
}

/**
 * A CONTA DA COMISSÃO DELE, numa parcela.
 *
 * A ordem é a mesma do banco (migração 009, `v_base := i.amount - v_iss -
 * v_simples` e `broker_amount := round(v_base * broker_pct / 100, 2)`), então o
 * que ele lê aqui é recalculável no papel, linha por linha.
 *
 * O que NÃO está aqui é tão importante quanto o que está: o líquido da
 * imobiliária não aparece. Não por uma prop que o esconde — as linhas são
 * compostas uma a uma, e a que ele não pode ver simplesmente não é escrita.
 */
function ContaDaParcela({ p, s }: { p: CorretorParcela; s: Situacao }) {
  const base = c2(p.installment_amount - p.iss_amount - p.simples_amount)
  const fica = c2(p.broker_amount - p.broker_adjustment)
  return (
    <>
      <Cascata densidade="compacta">
        <LinhaCascata
          rotulo="Parcela da comissão"
          valor={p.installment_amount}
          detalhe="o que a construtora paga à imobiliária"
        />
        {p.iss_amount > 0 && <LinhaCascata rotulo="ISS retido na fonte" valor={p.iss_amount} subtracao />}
        {p.simples_amount > 0 && (
          <LinhaCascata rotulo="Imposto (Simples 6%)" valor={p.simples_amount} subtracao />
        )}
        <LinhaCascata rotulo="Base do cálculo" valor={base} detalhe="a parcela depois dos tributos" />
        <LinhaCascata
          rotulo="Sua comissão"
          valor={p.broker_amount}
          detalhe={p.broker_pct != null ? `base × ${p.broker_pct}%` : undefined}
        />
        {p.broker_adjustment > 0 && (
          <LinhaCascata rotulo="Desconto combinado" valor={p.broker_adjustment} subtracao />
        )}
        <TotalCascata
          rotulo="Fica para você"
          valor={fica}
          // Previsto não recebe cor tônica: a ausência de cor é o sinal de que
          // ainda não é dinheiro.
          tinta={s === 'prevista' ? undefined : VOCABULARIO[s].tinta}
          nota={VOCABULARIO[s].explica}
        />
      </Cascata>
      {p.notes && <p className="mt-2 text-sm text-content-faint">{p.notes}</p>}
    </>
  )
}

/**
 * A ficha antiga vivia em /minhas-vendas/:id e desenhava, numa segunda tela, a
 * mesma conta que agora abre dentro da lista. Duas telas para o mesmo número é
 * como elas divergem: a ficha antiga somava "A receber" juntando liberado com
 * previsto — o que a imobiliária já tem com o que ela espera —, e era o único
 * lugar do app do corretor que ainda fazia essa soma.
 *
 * O link continua válido: ele passa a levar à venda aberta e destacada na lista,
 * que é o mesmo destino do Início e da folha de composição. Um número, um lugar.
 */
export function MinhaVenda() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/minhas-vendas?venda=${id}` : '/minhas-vendas'} replace />
}
