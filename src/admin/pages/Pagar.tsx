import { useMemo, useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { BaixarLancamento } from '../BaixarLancamento'
import { BaixaNaLinha, useBaixaDeLancamento } from '../BaixaNaLinha'
import { useComposicao, type ItemComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { EstadoVazio } from '@/components/ui/Estados'
import { fraseDeTempo, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDateShort, formatMonthYear } from '@/lib/format'
import type { Transaction } from '@/types'
import type { MoneyItem } from '@/lib/sales'

const soma = (l: MoneyItem[]) => Math.round(l.reduce((s, i) => s + i.amount, 0) * 100) / 100

/*
 * A situação de uma linha a pagar.
 *
 * A fonte é `released`, o MESMO campo que define o que esta tela chama de
 * devido (src/lib/sales.ts): comissão e imposto só são devidos quando a
 * parcela da venda foi recebida; a guia do mês e a despesa nascem devidas.
 * Assim o chip nunca contradiz o total do topo. A regra de atraso é de `situacaoDeTela`, que
 * garante que comissão ainda prevista nunca apareça como vencida.
 */
function situacaoDaLinha(i: MoneyItem, hoje: string): Situacao {
  return situacaoDeTela(i.released ? 'liberada' : 'prevista', i.date, hoje)
}

/**
 * Uma linha da lista de saída. Ou é um lançamento só, ou é um punhado deles
 * que o Rafael paga junto (a fatura do cartão) — e aí a linha mostra o total e
 * abre o detalhe.
 */
interface Saida {
  chave: string
  rotulo: string
  titulo: string
  explica?: string
  /** A data que a linha promete: a mais próxima do grupo. */
  data: string
  itens: MoneyItem[]
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Compra no cartão pessoal do Rafael, que a imobiliária reembolsa. */
const ehCartao = (i: MoneyItem) => /cartão pessoal/i.test(i.tx.description)

/**
 * Junta as compras do cartão pessoal por mês de vencimento — uma fatura, uma
 * linha. Todo o resto continua linha a linha, na mesma ordem em que chegou.
 */
function agruparCartao(itens: MoneyItem[]): Saida[] {
  const saidas: Saida[] = []
  const porMes = new Map<string, Saida>()
  for (const i of itens) {
    if (!ehCartao(i)) {
      saidas.push({ chave: i.tx.id, rotulo: 'Despesa', titulo: i.label, data: i.date, itens: [i] })
      continue
    }
    const mes = i.date.slice(0, 7)
    const existente = porMes.get(mes)
    if (existente) {
      existente.itens.push(i)
      if (i.date < existente.data) existente.data = i.date
      continue
    }
    const nova: Saida = {
      chave: `cartao-${mes}`,
      rotulo: 'Cartão',
      titulo: `Cartão do Rafael — ${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`,
      explica:
        'Compras da imobiliária feitas no cartão pessoal do Rafael. Cada uma continua sendo um lançamento; a fatura é que é paga de uma vez.',
      data: i.date,
      itens: [i],
    }
    porMes.set(mes, nova)
    saidas.push(nova)
  }
  return saidas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
}

/** Agrupa por corretor, na ordem em que cada um aparece. */
function porCorretorDe(itens: MoneyItem[]): [string, MoneyItem[]][] {
  const m = new Map<string, MoneyItem[]>()
  for (const i of itens) {
    const nome = i.sale?.brokerName ?? 'corretor'
    const a = m.get(nome)
    if (a) a.push(i)
    else m.set(nome, [i])
  }
  return [...m.entries()]
}

/** Estado de cor do valor: só a vencida pinta (a palavra vem do chip). */
const estadoDe = (s: Situacao) => (s === 'vencida' ? ('vencido' as const) : undefined)

/**
 * Pagar (9.7). A conversão é só de APRESENTAÇÃO: os grupos, o que conta como
 * devido e as duas baixas (comissão em lote e lançamento avulso) são os de
 * antes. Composição:
 *
 * SOUZA 3.0 (02/11/2026, docs/redesenho-3/GUIA-DE-TELA.md):
 *
 * 1. Frase do título: o devido agora e quanto disso já venceu.
 * 2. Faixa de números: "Devido agora" (liberadas + imposto + despesa) é a
 *    líder; os três subtotais são os apoios. Cada um abre no que o compõe.
 * 3. "Comissão liberada" e "Imposto" formam par: uma linha por corretor com
 *    "Pagar"/"Pagar tudo" (abre o painel do repasse, por causa do brinde) e a
 *    guia com "Paguei" na linha.
 * 4. "Despesas": linha a linha com "Paguei" e o marco de hoje.
 * 5. "Previsto, depende da construtora": uma linha por corretor que abre as
 *    parcelas dele. Previsão nunca soma no devido.
 */
export function Pagar() {
  const { pagar, hoje, installments, vendas, mes } = useAdmin()
  const { abrir } = useComposicao()
  const [comissoes, setComissoes] = useState<ComissaoAPagar[] | null>(null)
  const [avulso, setAvulso] = useState<Transaction[] | null>(null)
  const baixaDeLancamento = useBaixaDeLancamento()

  const grupos = useMemo(() => {
    const liberadas = pagar.filter((i) => i.kind === 'comissao' && i.released)
    const previstas = pagar.filter((i) => i.kind === 'comissao' && !i.released)
    // Imposto de parcela que ainda não entrou é previsão, não dívida (21/09/2026).
    const impostos = pagar.filter((i) => i.kind === 'imposto' && i.released)
    const impostosPrevistos = pagar.filter((i) => i.kind === 'imposto' && !i.released)
    // A gestão do gestor liberada (041) se paga como despesa: uma baixa por linha.
    const despesas = pagar.filter((i) => i.kind === 'despesa' || i.kind === 'socio' || (i.kind === 'gestao' && i.released))
    return { liberadas, previstas, impostos, impostosPrevistos, despesas }
  }, [pagar])

  /*
   * O CARTÃO PESSOAL EM UMA LINHA POR MÊS (21/09/2026).
   *
   * Compra parcelada no cartão do Rafael chega aqui em dez, doze linhas que
   * ele paga numa fatura só. Ele pediu as duas coisas: uma linha para pagar, e
   * o detalhe do que está dentro ao tocar nela. Então o LANÇAMENTO continua
   * sendo um por compra — é dele que sai o controle — e o que muda é só o que
   * a lista mostra.
   */
  const saidasDespesa = useMemo(() => agruparCartao(grupos.despesas), [grupos.despesas])
  const saidasImposto = useMemo(() => agruparCartao(grupos.impostos), [grupos.impostos])

  const porCorretor = useMemo(() => porCorretorDe(grupos.liberadas), [grupos.liberadas])
  const previstasPorCorretor = useMemo(() => porCorretorDe(grupos.previstas), [grupos.previstas])

  const devido = useMemo(
    () => [...grupos.liberadas, ...grupos.impostos, ...grupos.despesas],
    [grupos],
  )
  const totalDevido = soma(devido)
  // A mesma leitura do Início ("Contas a pagar"): do que é devido, o que já passou da data.
  const vencido = devido.filter((i) => i.overdue)

  function paraPagamento(itens: MoneyItem[]): ComissaoAPagar[] {
    return itens
      .filter((i) => i.installment)
      .map((i) => ({
        installmentId: i.installment!.id,
        brokerName: i.sale?.brokerName ?? 'corretor',
        saleTitle: i.sale?.title ?? i.label,
        parcela: `parcela ${i.installment!.idx}/${i.installment!.count}`,
        amount: i.amount,
        dueDate: i.date,
      }))
  }

  /** Transforma uma lista de lançamentos na composição que a folha exibe. */
  const comp = (l: MoneyItem[]): ItemComposicao[] =>
    l.map((i) => {
      const s = situacaoDaLinha(i, hoje)
      return {
        id: i.tx.id,
        titulo: i.label,
        meta: [
          i.sale?.brokerName ?? i.tx.category,
          fraseDeTempo(s, { prevista: i.date, liberada: i.installment?.received_date }, hoje),
        ]
          .filter(Boolean)
          .join(' · '),
        valor: i.amount,
        situacao: s,
        idx: i.installment?.idx,
        count: i.installment?.count,
        para: i.sale ? `/vendas/${i.sale.id}` : undefined,
      }
    })

  /** Abre um subtotal no que o compõe. Nenhum número fica sem origem. */
  const abrirGrupo = (l: MoneyItem[], rotulo: string, titulo: string, explica: string) =>
    abrir({ rotulo, titulo, explica, total: soma(l), itens: comp(l), vazio: 'Nada em aberto aqui.' })

  /*
   * O detalhe de uma saída. Três casos, e nenhum deles inventa número:
   *
   * · grupo (cartão do mês): as compras que estão dentro dele;
   * · guia do Simples: as parcelas recebidas no mês que formaram a guia,
   *   lidas das parcelas gravadas — é a mesma conta que `sincroniza_das` faz
   *   no banco;
   * · o resto: o lançamento, como sempre.
   */
  const abrirSaida = (g: Saida) => {
    if (g.itens.length > 1) {
      return abrir({
        rotulo: g.rotulo,
        titulo: g.titulo,
        explica: g.explica,
        total: soma(g.itens),
        itens: comp(g.itens),
      })
    }
    const i = g.itens[0]
    const guia = parcelasDaGuia(i)
    if (guia) {
      return abrir({
        rotulo: 'Guia do mês',
        titulo: i.label,
        explica:
          'A guia soma o imposto de tudo que entrou no mês. Cada linha abaixo é uma parcela recebida e o que ela levou para a guia.',
        total: i.amount,
        itens: guia,
      })
    }
    return abrir({ rotulo: i.kind === 'imposto' ? 'Imposto' : 'Despesa', titulo: i.label, total: i.amount, itens: comp([i]) })
  }

  /** As parcelas que formaram uma guia do Simples — vazio se não é guia. */
  function parcelasDaGuia(i: MoneyItem): ItemComposicao[] | null {
    if (i.installment || !i.tx.description.startsWith('DAS Simples')) return null
    const mes = i.tx.competence_date.slice(0, 7)
    const porVenda = new Map(vendas.map((v) => [v.id, v]))
    const linhas = installments
      .filter(
        (p) =>
          p.status === 'recebida' &&
          p.simples_amount > 0 &&
          (p.received_date ?? '').slice(0, 7) === mes &&
          !porVenda.get(p.sale_id)?.is_personal,
      )
      .sort((a, b) => ((a.received_date ?? '') < (b.received_date ?? '') ? -1 : 1))
      .map((p) => ({
        id: p.id,
        titulo: porVenda.get(p.sale_id)?.title ?? 'Parcela de comissão',
        meta: `recebida em ${formatDateShort(p.received_date ?? '')} · 6% sobre ${formatCurrency(p.amount - p.iss_amount)}`,
        valor: p.simples_amount,
        idx: p.count > 1 ? p.idx : undefined,
        count: p.count > 1 ? p.count : undefined,
        para: `/vendas/${p.sale_id}`,
      }))
    return linhas.length > 0 ? linhas : null
  }

  const abrirLiberadas = () =>
    abrirGrupo(grupos.liberadas, 'Liberada', 'Comissão liberada', 'A imobiliária já recebeu estas parcelas. A comissão do corretor está a pagar.')
  const abrirPrevistas = () =>
    abrirGrupo(
      grupos.previstas,
      'Prevista',
      'Comissão ainda prevista',
      'Só vira dívida quando a construtora pagar a parcela. Até lá não é obrigação e não entra em nenhum total de dívida.',
    )
  const abrirImpostos = () =>
    abrirGrupo(grupos.impostos, 'Imposto', 'Imposto a pagar', 'A guia do Simples de cada mês, mais o ISS das parcelas já recebidas.')
  const abrirImpostosPrevistos = () =>
    abrirGrupo(
      grupos.impostosPrevistos,
      'Imposto previsto',
      'Imposto ainda previsto',
      'Imposto de parcela que a construtora não pagou. Ele entra na guia do mês em que o dinheiro cair — até lá não é obrigação.',
    )
  const abrirTudoPrevisto = () =>
    abrirGrupo(
      [...grupos.previstas, ...grupos.impostosPrevistos],
      'Previsto',
      'O que depende da construtora pagar',
      'Comissão do corretor e imposto de parcela que a construtora ainda não pagou. Nada disso é obrigação hoje.',
    )
  const abrirDespesas = () =>
    abrirGrupo(grupos.despesas, 'Despesas', 'Despesa a pagar', 'Despesa lançada e distribuição do sócio ainda em aberto.')

  if (pagar.length === 0) {
    return (
      <PageLayout subtitulo="Nada a pagar">
        <Cartao rotuloAcessivel="A pagar">
          <Cartao.Corpo>
            <EstadoVazio
              icone={ArrowUpCircle}
              titulo="Nada a pagar"
              descricao="Nenhuma comissão liberada, nenhum imposto e nenhuma despesa em aberto."
            />
          </Cartao.Corpo>
        </Cartao>
      </PageLayout>
    )
  }

  const frase = (
    <>
      <b>
        <Valor valor={totalDevido} posto="fato" tinta="text-t1" /> devido agora
      </b>
      {vencido.length > 0 ? (
        <>
          {' · '}
          <span className="font-medium text-error-ink">
            <Valor valor={soma(vencido)} posto="fato" tinta="text-error-ink" /> {vencido.length === 1 ? 'vencido' : 'vencidos'}
          </span>
        </>
      ) : (
        devido.length > 0 && ' · nada vencido'
      )}
      {` · ${formatMonthYear(mes).toLowerCase()}`}
    </>
  )

  const abrirDevido = () =>
    abrir({
      rotulo: 'Devido agora',
      titulo: 'O que é obrigação hoje',
      explica: 'Só o que a imobiliária de fato deve: comissão de parcela já recebida, imposto e despesa lançada.',
      total: totalDevido,
      itens: comp(devido),
      nota: 'Comissão de parcela que a construtora ainda não pagou não entra aqui. Ela aparece abaixo, como previsão.',
      vazio: 'Nada devido agora.',
    })

  const qtd = (n: number, um: string, varios: string) => (n === 0 ? 'nada em aberto' : `${n} ${n === 1 ? um : varios}`)

  const cartaoComissao = porCorretor.length > 0 && (
    <Cartao rotuloAcessivel="Comissão liberada">
      <Cartao.Cabecalho
        titulo="Comissão liberada"
        meta="a imobiliária já recebeu; é do corretor, esperando o repasse"
      />
      <Cartao.Lista colunas={{ situacao: true, valor: true, acao: '7rem' }} rotuloAcessivel="Comissão liberada por corretor">
        {porCorretor.map(([nome, itens]) => {
          /* A situação do grupo é a pior das parcelas dele. */
          const s: Situacao = itens.some((i) => situacaoDaLinha(i, hoje) === 'vencida') ? 'vencida' : 'liberada'
          const maisAntiga = itens[0]
          return (
            <Linha
              key={nome}
              titulo={nome}
              meta={
                <>
                  {itens.length === 1 ? 'uma parcela · ' : `${itens.length} parcelas · a mais antiga `}
                  <FraseDeTempo
                    situacao={situacaoDaLinha(maisAntiga, hoje)}
                    prevista={maisAntiga.date}
                    liberada={maisAntiga.installment?.received_date}
                  />
                </>
              }
              situacao={<ChipSituacao situacao={s} />}
              valor={
                <ValorComOrigem
                  posto="linha"
                  valor={soma(itens)}
                  estado={estadoDe(s)}
                  rotuloAcessivel={`Ver de quais vendas vem a comissão de ${nome}`}
                  aoAbrir={() =>
                    abrir({
                      rotulo: nome,
                      titulo: `Comissão liberada de ${nome}`,
                      explica: 'Parcelas que a imobiliária já recebeu. É dinheiro do corretor, esperando o repasse.',
                      total: soma(itens),
                      itens: comp(itens),
                    })
                  }
                />
              }
              acao={
                // O repasse NÃO grava na linha: o brinde exige o painel do corretor.
                <div className="flex justify-end">
                  <Button size="sm" variant="secundario" onClick={() => setComissoes(paraPagamento(itens))}>
                    {itens.length > 1 ? 'Pagar tudo' : 'Pagar'}
                  </Button>
                </div>
              }
            />
          )
        })}
      </Cartao.Lista>
    </Cartao>
  )

  const cartaoImposto = saidasImposto.length > 0 && (
    <CartaoDeSaida
      titulo="Imposto"
      meta="a guia do Simples vence dia 20 do mês seguinte; toque nela para ver as parcelas"
      saidas={saidasImposto}
      hoje={hoje}
      onPagar={setAvulso}
      baixar={baixaDeLancamento}
      aoAbrir={abrirSaida}
    />
  )

  return (
    <PageLayout subtitulo={frase}>
      {/* Só o que é obrigação de fato, a mesma conta de antes; a previsão não entra em nenhum destes números. */}
      <FaixaDeMetricas
        rotuloAcessivel="O que é devido agora"
        metricas={[
          {
            rotulo: 'Devido agora',
            valor: totalDevido,
            lider: true,
            nota:
              devido.length === 0
                ? 'nada devido agora'
                : `${devido.length} ${devido.length === 1 ? 'item' : 'itens'}: comissão liberada, imposto e despesa`,
            aoClicar: abrirDevido,
          },
          {
            rotulo: 'Comissão liberada',
            valor: soma(grupos.liberadas),
            nota: qtd(porCorretor.length, 'corretor', 'corretores'),
            aoClicar: abrirLiberadas,
          },
          {
            rotulo: 'Imposto',
            valor: soma(grupos.impostos),
            nota: qtd(grupos.impostos.length, 'lançamento', 'lançamentos'),
            aoClicar: abrirImpostos,
          },
          {
            rotulo: 'Despesas',
            valor: soma(grupos.despesas),
            nota: qtd(grupos.despesas.length, 'lançamento', 'lançamentos'),
            aoClicar: abrirDespesas,
          },
        ]}
      />

      {cartaoComissao && cartaoImposto ? (
        /* Duas listas curtas formam par; items-start: cada uma com a sua altura. */
        <div className="grid items-start gap-bloco lg:grid-cols-2">
          {cartaoComissao}
          {cartaoImposto}
        </div>
      ) : (
        <>
          {cartaoComissao}
          {cartaoImposto}
        </>
      )}

      {saidasDespesa.length > 0 && (
        <CartaoDeSaida titulo="Despesas" meta="estrutura e retiradas do sócio; o cartão vem numa linha por mês" saidas={saidasDespesa} hoje={hoje} onPagar={setAvulso} baixar={baixaDeLancamento} aoAbrir={abrirSaida} />
      )}

      {(previstasPorCorretor.length > 0 || grupos.impostosPrevistos.length > 0) && (
        /*
         * A previsão fica em cartão próprio, sem botão de pagar:
         * `pay_broker_installments` recusa parcela não recebida. Uma linha por
         * corretor, que abre as parcelas dele (cada uma leva à venda).
         */
        <Cartao>
          <Cartao.Cabecalho
            titulo="Previsto, depende da construtora"
            meta={
              grupos.impostosPrevistos.length > 0
                ? 'comissão e imposto de parcela que ainda não entrou'
                : previstasPorCorretor.length === 1
                  ? 'um corretor'
                  : `${previstasPorCorretor.length} corretores`
            }
            extra={
              <ValorComOrigem
                posto="destaque"
                previsto
                valor={soma([...grupos.previstas, ...grupos.impostosPrevistos])}
                aoAbrir={grupos.impostosPrevistos.length > 0 ? abrirTudoPrevisto : abrirPrevistas}
                rotuloAcessivel="Ver de onde vem: o que ainda depende da construtora"
              />
            }
          />
          <Cartao.Lista
            colunas={{ situacao: true, valor: true, acao: '7rem' }}
            rotuloAcessivel="Comissão prevista por corretor"
          >
            {previstasPorCorretor.map(([nome, itens]) => {
              const primeira = itens[0]
              const s = situacaoDaLinha(primeira, hoje)
              const abrirDoCorretor = () =>
                abrir({
                  rotulo: nome,
                  titulo: `Comissão prevista de ${nome}`,
                  explica: 'Só vira dívida quando a construtora pagar a parcela. Até lá não é obrigação e não entra em nenhum total de dívida.',
                  total: soma(itens),
                  itens: comp(itens),
                })
              return (
                <Linha
                  key={nome}
                  titulo={nome}
                  meta={
                    <>
                      {itens.length === 1 ? 'uma parcela · ' : `${itens.length} parcelas · a primeira `}
                      <FraseDeTempo situacao={s} prevista={primeira.date} />
                    </>
                  }
                  situacao={<ChipSituacao situacao={s} />}
                  valor={<Valor posto="linha" previsto valor={soma(itens)} />}
                  aoClicar={abrirDoCorretor}
                  acao={
                    <Button size="sm" variant="fantasma" onClick={abrirDoCorretor}>
                      {itens.length === 1 ? 'Ver parcela' : 'Ver parcelas'}
                    </Button>
                  }
                />
              )
            })}
            {grupos.impostosPrevistos.length > 0 && (
              <Linha
                titulo="Imposto das parcelas previstas"
                meta={`${grupos.impostosPrevistos.length === 1 ? 'uma parcela' : `${grupos.impostosPrevistos.length} parcelas`} · entra na guia do mês em que o dinheiro cair`}
                situacao={<ChipSituacao situacao="prevista" />}
                valor={<Valor posto="linha" previsto valor={soma(grupos.impostosPrevistos)} />}
                aoClicar={abrirImpostosPrevistos}
                acao={
                  <Button size="sm" variant="fantasma" onClick={abrirImpostosPrevistos}>
                    Ver parcelas
                  </Button>
                }
              />
            )}
          </Cartao.Lista>
          <Cartao.Rodape>Não é dívida hoje: nada daqui entra no devido agora.</Cartao.Rodape>
        </Cartao>
      )}

      <PagarComissao itens={comissoes} onFechar={() => setComissoes(null)} />
      <BaixarLancamento tx={avulso} onFechar={() => setAvulso(null)} />
    </PageLayout>
  )
}

/**
 * Um cartão de saída que não é comissão: imposto e despesa. A linha é o
 * próprio lançamento e a baixa é a avulsa, a mesma de antes. O marco de HOJE
 * separa o que já venceu do que ainda vai vencer.
 */
function CartaoDeSaida({
  titulo,
  meta,
  saidas,
  hoje,
  onPagar,
  baixar,
  aoAbrir,
}: {
  titulo: string
  meta: string
  saidas: Saida[]
  hoje: string
  onPagar: (t: Transaction[]) => void
  /** Souza 3.0: a baixa na linha (Paguei → Confirmar, com Desfazer). */
  baixar: ReturnType<typeof useBaixaDeLancamento>
  /** A linha abre o que ela é: o lançamento, o grupo ou a conta da guia. */
  aoAbrir: (g: Saida) => void
}) {
  return (
    <Cartao>
      <Cartao.Cabecalho titulo={titulo} meta={meta} />
      <Cartao.Lista colunas={{ situacao: true, valor: true, acao: '11rem' }} rotuloAcessivel={titulo}>
        {saidas.flatMap((g, n) => {
          const s = situacaoDaLinha(g.itens[0], hoje)
          const total = Math.round(g.itens.reduce((acc, i) => acc + i.amount, 0) * 100) / 100
          const linha = (
            <Linha
              key={g.chave}
              titulo={g.titulo}
              meta={
                g.itens.length > 1 ? (
                  <>
                    {g.itens.length} compras ·{' '}
                    <FraseDeTempo situacao={s} prevista={g.data} />
                  </>
                ) : (
                  <FraseDeTempo situacao={s} prevista={g.data} />
                )
              }
              situacao={<ChipSituacao situacao={s} />}
              valor={<Valor posto="linha" valor={total} estado={estadoDe(s)} />}
              aoClicar={() => aoAbrir(g)}
              acao={
                <BaixaNaLinha
                  rotulo={g.itens.length > 1 ? 'Paguei tudo' : 'Paguei'}
                  baixar={baixar(g.itens.map((i) => i.tx))}
                  aoDetalhar={() => onPagar(g.itens.map((i) => i.tx))}
                />
              }
            />
          )
          return n > 0 && saidas[n - 1].data < hoje && g.data >= hoje
            ? [<LinhaGrupo key={`hoje-${g.chave}`} rotulo="Hoje" hoje />, linha]
            : [linha]
        })}
      </Cartao.Lista>
    </Cartao>
  )
}
