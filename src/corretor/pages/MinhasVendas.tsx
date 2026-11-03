import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Handshake } from 'lucide-react'
import { useCorretor, type CorretorParcela, type CorretorVenda } from '../CorretorData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { Rotulo } from '@/components/ui/Rotulo'
import { ChipSituacao } from '@/components/ui/Situacao'
import { ChipDaParcela, FraseDaParcela, explicaDaParcela } from '../EtapaDaParcela'
import { PartesDaRegua, Regua } from '@/components/ui/Regua'
import { Demonstrativo } from '@/components/ui/Demonstrativo'
import { SidePanel, useParamPainel } from '@/components/ui/SidePanel'
import { EstadoVazio } from '@/components/ui/Estados'
import { linhasDaParcela } from '@/lib/linhasDaVenda'
import { situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDate, toDateOnly } from '@/lib/format'

/*
 * MINHAS VENDAS (9.8): a carteira do corretor, e o lugar onde um número vira
 * conta. Uma linha por venda; tocar abre a ficha no painel (`?venda=<id>`). O
 * Início e a folha de composição apontam para cá, e a venda chega ABERTA, já
 * com a conta da parcela que ele veio conferir.
 *
 * O primeiro número é o dinheiro que existe (já recebido + já liberado), não o
 * total contratado. O contratado não some: vem ao lado, com a palavra que diz
 * de quem ele depende, nunca com cor.
 */

/** Arredonda em centavos: a diferença de R$ 0,04 é o que trava uma conferência. */
const c2 = (n: number) => Math.round(n * 100) / 100

/**
 * A situação da VENDA, derivada das parcelas dela, na ordem do que ele precisa
 * saber primeiro: atrasada, a receber, prevista; só sem pendência é "Recebida".
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
 * Qual parcela já abre a conta quando ele abre a venda: a atrasada, depois a
 * que está a receber, depois a próxima prevista; sem pendência, a última.
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

/** O valor de uma parcela na cor do estado real; previsto nunca recebe tônica. */
function ValorDaParcela({ valor, s }: { valor: number; s: Situacao }) {
  if (s === 'prevista') return <Valor valor={valor} posto="linha" previsto />
  if (s === 'recebida') return <Valor valor={valor} posto="linha" estado="recebido" />
  if (s === 'vencida') return <Valor valor={valor} posto="linha" estado="vencido" />
  if (s === 'cancelada') return <Valor valor={valor} posto="linha" className="line-through" />
  return <Valor valor={valor} posto="linha" />
}

export function MinhasVendas() {
  const { vendas, parcelas } = useCorretor()
  const { abrir } = useComposicao()
  const [vendaDoLink, abrirVenda, fecharVenda] = useParamPainel('venda')
  const [parcelaAberta, setParcelaAberta] = useState<string | null>(null)
  const linkAplicado = useRef<string | null>(null)
  const contaRef = useRef<HTMLElement>(null)
  const hoje = toDateOnly(new Date())

  /*
   * As parcelas de cada venda, já traduzidas para a situação de TELA, nunca
   * para o status cru: parcela que a construtora não pagou nunca vira dívida.
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
      // Sempre o líquido dele (comissão − desconto combinado), o mesmo número da linha de cada parcela.
      const soma = (fn: (s: Situacao) => boolean) =>
        c2(suas.filter(({ s }) => fn(s)).reduce((t, { p }) => t + p.broker_amount - p.broker_adjustment, 0))
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
   * Chegou por link (`?venda=`) ou tocou numa venda: a ficha abre já com a
   * conta da parcela de destaque. Aplicado uma vez por venda: um recarregamento
   * de dados não desfaz a parcela que ele escolheu depois.
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
    setParcelaAberta(parcelaDeDestaque(c, hoje))
  }, [vendaDoLink, carteira, hoje])

  if (vendas.length === 0) {
    return (
      <PageLayout>
        <Cartao rotuloAcessivel="Suas vendas">
          <EstadoVazio
            icone={Handshake}
            titulo="Nenhuma venda registrada"
            descricao="Assim que a imobiliária registrar uma venda sua, ela aparece aqui com o cronograma da comissão e a conta aberta."
          />
        </Cartao>
      </PageLayout>
    )
  }

  const totalAgora = c2(carteira.reduce((t, c) => t + c.agora, 0))
  const totalPrevisto = c2(carteira.reduce((t, c) => t + c.previsto, 0))
  const comDinheiro = carteira.filter((c) => c.agora > 0)
  const linkPerdido = vendaDoLink != null && !vendas.some((v) => v.id === vendaDoLink)
  const aberta = carteira.find((c) => c.v.id === vendaDoLink)
  const contagem = vendas.length === 1 ? '1 venda' : `${vendas.length} vendas`

  const escolherParcela = (id: string) => {
    setParcelaAberta((atual) => (atual === id ? null : id))
    // Sem `smooth`: a tela só está indo onde ele pediu.
    requestAnimationFrame(() => contaRef.current?.scrollIntoView({ block: 'nearest' }))
  }

  /** As vendas de uma parte da comissão, viradas itens da composição. */
  const itensPorVenda = (l: VendaNaTela[], valor: (c: VendaNaTela) => number, situacao?: Situacao) =>
    l.map((c) => ({
      id: c.v.id,
      titulo: c.v.title,
      meta:
        [c.v.is_personal ? 'pessoa física' : null, c.v.client_name, c.v.development].filter(Boolean).join(' · ') ||
        undefined,
      valor: valor(c),
      situacao: situacao ?? c.resumo,
      para: `/minhas-vendas?venda=${c.v.id}`,
    }))

  const abrirAgora = () =>
    abrir({
      rotulo: 'Sua comissão',
      titulo: 'De quais vendas vem',
      explica: 'Só o que já é dinheiro: parcelas pagas a você e parcelas que a imobiliária já recebeu.',
      total: totalAgora,
      itens: itensPorVenda(comDinheiro, (c) => c.agora),
      nota:
        totalPrevisto > 0
          ? 'As parcelas previstas ficam fora desta conta. Elas só viram comissão sua quando a construtora pagar a imobiliária.'
          : undefined,
    })

  const abrirPrevisto = () =>
    abrir({
      rotulo: 'Depende da construtora',
      titulo: 'De quais vendas vem a previsão',
      explica: 'Parcelas que só viram comissão sua quando a construtora pagar a imobiliária. A data pode mudar.',
      total: totalPrevisto,
      itens: itensPorVenda(
        carteira.filter((c) => c.previsto > 0),
        (c) => c.previsto,
        'prevista',
      ),
    })

  /*
   * SOUZA 3.0 (02/11/2026): a frase diz quanto da carteira já é dele; a faixa
   * tem esse número como líder; a lista forma par com a régua do que já caiu
   * (recebida em marinho, liberada em tinta, prevista em cinza).
   */
  const totalRecebido = c2(carteira.reduce((t, c) => t + c.recebido, 0))
  const totalLiberado = c2(carteira.reduce((t, c) => t + c.liberado, 0))
  const partes = [
    { nome: 'Já recebida', valor: totalRecebido, cor: 'var(--g-entra)' },
    { nome: 'Liberada, a receber', valor: totalLiberado, cor: 'var(--t2)' },
    { nome: 'Prevista', valor: totalPrevisto, cor: 'var(--g-sai)' },
  ]

  const frase = (
    <>
      <b>
        {totalAgora > 0 ? (
          <>
            <Valor valor={totalAgora} posto="fato" tinta="text-t1" /> já são seus
          </>
        ) : (
          'Nada pago ou liberado ainda'
        )}
      </b>
      {` · ${contagem}`}
      {totalPrevisto > 0 && (
        <>
          {' · '}
          <Valor valor={totalPrevisto} posto="fato" previsto /> dependendo da construtora
        </>
      )}
    </>
  )

  return (
    <PageLayout subtitulo={frase}>
      <FaixaDeMetricas
        rotuloAcessivel="Sua comissão nas suas vendas"
        metricas={[
          {
            rotulo: 'Sua comissão nesta carteira',
            valor: totalAgora,
            lider: true,
            nota: 'já paga a você ou liberada pela imobiliária',
            aoClicar: totalAgora > 0 ? abrirAgora : undefined,
          },
          {
            rotulo: 'Depende da construtora',
            valor: totalPrevisto,
            nota: totalPrevisto > 0 ? 'vira sua quando a construtora pagar' : 'nenhuma parcela esperando',
            aoClicar: totalPrevisto > 0 ? abrirPrevisto : undefined,
          },
          {
            rotulo: 'Vendas',
            valor: 0,
            texto: String(vendas.length),
            nota: `${comDinheiro.length} já com dinheiro seu`,
          },
        ]}
      />

      {/*
       * O link apontou para uma venda que não está mais na lista (cancelada, ou
       * de outro corretor): dizer isso em texto, não uma lista que parece normal.
       */}
      {linkPerdido && (
        <Cartao rotuloAcessivel="Venda não encontrada">
          <Cartao.Corpo>
            <p role="status" className="text-texto-corrido text-t2">
              A venda que você abriu não está na sua lista. Ela pode ter sido cancelada — se não for isso, fale com a
              imobiliária.
            </p>
          </Cartao.Corpo>
        </Cartao>
      )}

      <div className="grid items-start gap-bloco lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao rotuloAcessivel="Suas vendas">
          <Cartao.Cabecalho titulo="Suas vendas" meta={`${contagem} · em cada uma, o que já é seu`} />
          <Cartao.Lista
            rotuloAcessivel="Suas vendas"
            colunas={{ goteira: true, situacao: true, valor: true, fim: true }}
          >
            {carteira.map((c) => (
              <Linha
                key={c.v.id}
                chegada={c.v.id === vendaDoLink}
                goteira={<Selo situacao={c.resumo} />}
                titulo={c.v.title}
                meta={
                  <>
                    {[
                      /* Venda de pessoa física (026): comissão dele, fora do caixa da imobiliária. */
                      c.v.is_personal ? 'pessoa física' : null,
                      c.v.client_name,
                      c.v.development,
                      `vendida em ${formatDate(c.v.sale_date)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {c.previsto > 0 && (
                      <span className="block">
                        e mais <Valor valor={c.previsto} posto="fato" previsto /> dependendo da construtora
                      </span>
                    )}
                  </>
                }
                situacao={<ChipSituacao situacao={c.resumo} perfil="corretor" />}
                // Sem tinta tônica: mistura o que já caiu com o que está liberado.
                valor={<Valor valor={c.agora} posto="linha" />}
                aoClicar={() => abrirVenda(c.v.id)}
              />
            ))}
          </Cartao.Lista>
        </Cartao>

        <Cartao rotuloAcessivel="Quanto já caiu">
          <Cartao.Cabecalho
            titulo="Quanto já caiu"
            meta={`de ${formatCurrency(c2(totalAgora + totalPrevisto))} nas suas vendas`}
          />
          <Cartao.Corpo>
            <Regua
              partes={partes}
              rotuloAcessivel={`Nas suas vendas: ${formatCurrency(totalRecebido)} recebido, ${formatCurrency(totalLiberado)} liberado a receber e ${formatCurrency(totalPrevisto)} dependendo da construtora.`}
            />
          </Cartao.Corpo>
          <PartesDaRegua partes={partes} rotuloAcessivel="As partes da sua comissão" />
        </Cartao>
      </div>

      <SidePanel
        aberto={Boolean(aberta)}
        aoFechar={fecharVenda}
        titulo={aberta?.v.title ?? ''}
        subtitulo={
          aberta
            ? [
                aberta.v.is_personal ? 'pessoa física' : null,
                aberta.v.client_name,
                aberta.v.development,
                `vendida em ${formatDate(aberta.v.sale_date)}`,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        chaveConteudo={aberta?.v.id}
      >
        {aberta && (
          <FichaDaVenda
            c={aberta}
            parcelaAberta={parcelaAberta}
            aoEscolherParcela={escolherParcela}
            contaRef={contaRef}
          />
        )}
      </SidePanel>
    </PageLayout>
  )
}

/**
 * A ficha da venda no painel: dados, a trilha com os três números escritos, a
 * conta da parcela escolhida e as parcelas. A linha "Fica para a imobiliária"
 * não existe aqui: as linhas vêm de linhasDaParcela(perfil corretor).
 */
function FichaDaVenda({
  c,
  parcelaAberta,
  aoEscolherParcela,
  contaRef,
}: {
  c: VendaNaTela
  parcelaAberta: string | null
  aoEscolherParcela: (id: string) => void
  contaRef: RefObject<HTMLElement>
}) {
  const escolhida = c.parcelas.find(({ p }) => p.id === parcelaAberta)
  const nomeDaParcela = (p: CorretorParcela) => (p.count > 1 ? `Parcela ${p.idx} de ${p.count}` : 'Parcela única')
  return (
    <div className="flex flex-col gap-8">
      <DadosDaVenda venda={c.v} />

      <section aria-label="Sua comissão nesta venda" className="flex flex-col gap-3">
        <Rotulo as="h3">Sua comissão nesta venda</Rotulo>
        <Regua
          partes={[
            { nome: 'recebido', valor: c.recebido, cor: 'var(--g-entra)' },
            { nome: 'a receber', valor: c.liberado, cor: 'var(--t2)' },
            {
              nome: 'depende da construtora',
              valor: c.previsto,
              cor: 'var(--g-sai)',
            },
          ]}
          rotuloAcessivel={`Nesta venda: ${formatCurrency(c.recebido)} recebido, ${formatCurrency(
            c.liberado,
          )} liberado a receber e ${formatCurrency(c.previsto)} dependendo da construtora.`}
        />
        {/* A barra é reforço; o número vem escrito embaixo, sempre. */}
        <dl className="grid grid-cols-3 gap-3">
          <NumeroDaTrilha rotulo="recebido" cor="var(--g-entra)">
            <Valor valor={c.recebido} posto="fato" forte />
          </NumeroDaTrilha>
          <NumeroDaTrilha rotulo="a receber" cor="var(--t2)">
            <Valor valor={c.liberado} posto="fato" forte />
          </NumeroDaTrilha>
          <NumeroDaTrilha rotulo="depende da construtora" cor="var(--g-sai)">
            <Valor valor={c.previsto} posto="fato" previsto />
          </NumeroDaTrilha>
        </dl>
      </section>

      {escolhida && (
        <section
          ref={contaRef}
          aria-label={`Conta da ${nomeDaParcela(escolhida.p).toLowerCase()}`}
          className="flex flex-col gap-3"
        >
          <Rotulo as="h3">Conta da {nomeDaParcela(escolhida.p).toLowerCase()}</Rotulo>
          <Demonstrativo
            linhas={linhasDaParcela(escolhida.p, 'corretor', {
              situacaoCorretor: escolhida.s,
            })}
            perfil="corretor"
            rotuloAcessivel={`Conta da ${nomeDaParcela(escolhida.p).toLowerCase()}`}
          />
          <p className="text-texto-meta text-t-meta">{explicaDaParcela(escolhida.p, escolhida.s)}</p>
          {escolhida.p.notes && <p className="text-texto-meta text-t-meta">{escolhida.p.notes}</p>}
        </section>
      )}

      <section aria-label="Parcelas desta venda" className="flex flex-col gap-2">
        <Rotulo as="h3">
          {c.parcelas.length === 1 ? 'a parcela desta venda' : `as ${c.parcelas.length} parcelas desta venda`}
        </Rotulo>
        <Lista
          contexto="sobreposicao"
          rotuloAcessivel="Parcelas desta venda"
          colunas={{ goteira: true, situacao: true, valor: true, fim: true }}
        >
          {c.parcelas.map(({ p, s }) => (
            <Linha
              key={p.id}
              chegada={p.id === parcelaAberta}
              goteira={<Selo situacao={s} idx={p.idx} count={p.count} />}
              titulo={nomeDaParcela(p)}
              meta={<FraseDaParcela p={p} s={s} />}
              situacao={<ChipDaParcela p={p} s={s} />}
              valor={<ValorDaParcela valor={c2(p.broker_amount - p.broker_adjustment)} s={s} />}
              aoClicar={() => aoEscolherParcela(p.id)}
            />
          ))}
        </Lista>
      </section>
    </div>
  )
}

/** Um número da trilha, escrito sob ela. */
function NumeroDaTrilha({ rotulo, cor, children }: { rotulo: string; cor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="flex items-start gap-1.5 text-texto-meta text-t-meta">
        <span aria-hidden className="size-2 shrink-0 translate-y-1 rounded-ponto" style={{ background: cor }} />
        {rotulo}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Os dados da venda. "Valor do imóvel não informado" é texto, não R$ 0,00:
 * quando o sistema não sabe, ele escreve que não sabe.
 */
function DadosDaVenda({ venda }: { venda: CorretorVenda }) {
  return (
    <section aria-label="Dados da venda" className="flex flex-col gap-2">
      <Rotulo as="h3">Dados da venda</Rotulo>
      <dl className="flex flex-col">
        <Dado rotulo="Valor do imóvel">
          {venda.property_value != null ? (
            <Valor valor={venda.property_value} posto="fato" forte />
          ) : (
            <span className="text-t-meta">valor do imóvel não informado</span>
          )}
        </Dado>
        {venda.broker_pct != null && <Dado rotulo="Sua parte">{venda.broker_pct}% da base de cada parcela</Dado>}
        {venda.unit && <Dado rotulo="Unidade">{venda.unit}</Dado>}
      </dl>
    </section>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-fio-linha">
      <dt className="min-w-0 text-texto-corrido text-t2">{rotulo}</dt>
      <dd className="shrink-0 text-right text-texto-corrido font-medium text-t1">{children}</dd>
    </div>
  )
}

/**
 * A ficha antiga vivia em /minhas-vendas/:id. O link continua válido: leva à
 * venda aberta no painel, o mesmo destino do Início e da folha de composição.
 */
export function MinhaVenda() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/minhas-vendas?venda=${id}` : '/minhas-vendas'} replace />
}
