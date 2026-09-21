import { useMemo, useState } from 'react'
import { ArrowUpCircle, HandCoins, Hourglass, Landmark, Receipt } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { BaixarLancamento } from '../BaixarLancamento'
import { useComposicao, type ItemComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { EstadoVazio } from '@/components/ui/Estados'
import { fraseDeTempo, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency } from '@/lib/format'
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
 * 1. Herói ouro "Devido agora" (liberadas + imposto + despesa), com os três
 *    subtotais como apoios; cada um abre no que o compõe.
 * 2. Cartão "Comissão liberada": uma linha por corretor com "Pagar"/"Pagar tudo".
 * 3. Cartões "Imposto" e "Despesas": linha a linha com "Paguei" e o marco de hoje.
 * 4. Cartão "Previsto, depende da construtora": uma linha por corretor que
 *    abre as parcelas dele. Previsão nunca soma no devido.
 */
export function Pagar() {
  const { pagar, hoje } = useAdmin()
  const { abrir } = useComposicao()
  const [comissoes, setComissoes] = useState<ComissaoAPagar[] | null>(null)
  const [avulso, setAvulso] = useState<Transaction | null>(null)

  const grupos = useMemo(() => {
    const liberadas = pagar.filter((i) => i.kind === 'comissao' && i.released)
    const previstas = pagar.filter((i) => i.kind === 'comissao' && !i.released)
    // Imposto de parcela que ainda não entrou é previsão, não dívida (21/09/2026).
    const impostos = pagar.filter((i) => i.kind === 'imposto' && i.released)
    const impostosPrevistos = pagar.filter((i) => i.kind === 'imposto' && !i.released)
    const despesas = pagar.filter((i) => i.kind === 'despesa' || i.kind === 'socio')
    return { liberadas, previstas, impostos, impostosPrevistos, despesas }
  }, [pagar])

  const porCorretor = useMemo(() => porCorretorDe(grupos.liberadas), [grupos.liberadas])
  const previstasPorCorretor = useMemo(() => porCorretorDe(grupos.previstas), [grupos.previstas])

  const devido = useMemo(
    () => [...grupos.liberadas, ...grupos.impostos, ...grupos.despesas],
    [grupos],
  )
  const totalDevido = soma(devido)

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

  const abrirLancamento = (i: MoneyItem) =>
    abrir({ rotulo: i.kind === 'imposto' ? 'Imposto' : 'Despesa', titulo: i.label, total: i.amount, itens: comp([i]) })

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

  return (
    <PageLayout subtitulo={`${formatCurrency(totalDevido)} devido agora`}>
      {/* UM número em degrau herói, e só o que é obrigação de fato: a mesma conta de antes. */}
      <Heroi
        variante="ouro"
        rotulo="Devido agora"
        valor={totalDevido}
        rotuloAcessivel="Ver de onde vem o total devido agora"
        aoAbrir={() =>
          abrir({
            rotulo: 'Devido agora',
            titulo: 'O que é obrigação hoje',
            explica: 'Só o que a imobiliária de fato deve: comissão de parcela já recebida, imposto e despesa lançada.',
            total: totalDevido,
            itens: comp(devido),
            nota: 'Comissão de parcela que a construtora ainda não pagou não entra aqui. Ela aparece abaixo, como previsão.',
            vazio: 'Nada devido agora.',
          })
        }
        frase="Comissão de parcela que a imobiliária já recebeu, imposto e despesa lançada. Comissão que depende da construtora pagar não entra nesta conta."
        apoios={[
          { rotulo: 'Comissão liberada', valor: soma(grupos.liberadas), aoAbrir: abrirLiberadas, rotuloAcessivel: 'Ver de onde vem: Comissão liberada' },
          { rotulo: 'Imposto', valor: soma(grupos.impostos), aoAbrir: abrirImpostos, rotuloAcessivel: 'Ver de onde vem: Imposto a pagar' },
          { rotulo: 'Despesas', valor: soma(grupos.despesas), aoAbrir: abrirDespesas, rotuloAcessivel: 'Ver de onde vem: Despesa a pagar' },
        ]}
      />

      {porCorretor.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho
            titulo="Comissão liberada"
            icone={HandCoins}
            meta="A imobiliária já recebeu a parcela: é do corretor, esperando o repasse."
          />
          <Cartao.Lista
            colunas={{ goteira: true, situacao: true, valor: true, acao: '7rem' }}
            rotuloAcessivel="Comissão liberada por corretor"
          >
            {porCorretor.map(([nome, itens]) => {
              /* A situação do grupo é a pior das parcelas dele. */
              const s: Situacao = itens.some((i) => situacaoDaLinha(i, hoje) === 'vencida') ? 'vencida' : 'liberada'
              const maisAntiga = itens[0]
              return (
                <Linha
                  key={nome}
                  goteira={<Selo situacao={s} />}
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
                    <Button size="sm" variant="secundario" onClick={() => setComissoes(paraPagamento(itens))}>
                      {itens.length > 1 ? 'Pagar tudo' : 'Pagar'}
                    </Button>
                  }
                />
              )
            })}
          </Cartao.Lista>
        </Cartao>
      )}

      {grupos.impostos.length > 0 && (
        <CartaoDeSaida titulo="Imposto" icone={Landmark} explica="A guia mensal do Simples soma tudo que entrou no mês e vence dia 20 do mês seguinte. O ISS é retido pela construtora no pagamento." itens={grupos.impostos} hoje={hoje} onPagar={setAvulso} aoAbrir={abrirLancamento} />
      )}

      {grupos.despesas.length > 0 && (
        <CartaoDeSaida titulo="Despesas" icone={Receipt} explica="Estrutura da imobiliária e retiradas do sócio." itens={grupos.despesas} hoje={hoje} onPagar={setAvulso} aoAbrir={abrirLancamento} />
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
            icone={Hourglass}
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
          <Cartao.Rodape>
            O corretor recebe quando a imobiliária receber, e o imposto só nasce com o dinheiro dentro. Não é dívida
            hoje, e nada daqui entra no número do topo.
          </Cartao.Rodape>
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
  icone,
  explica,
  itens,
  hoje,
  onPagar,
  aoAbrir,
}: {
  titulo: string
  icone: typeof Receipt
  explica: string
  itens: MoneyItem[]
  hoje: string
  onPagar: (t: Transaction) => void
  /** O lançamento abre o que ele é (e a venda de origem, quando houver). */
  aoAbrir: (i: MoneyItem) => void
}) {
  return (
    <Cartao>
      <Cartao.Cabecalho titulo={titulo} icone={icone} meta={explica} />
      <Cartao.Lista colunas={{ goteira: true, situacao: true, valor: true, acao: '7rem' }} rotuloAcessivel={titulo}>
        {itens.flatMap((i, n) => {
          const s = situacaoDaLinha(i, hoje)
          const linha = (
            <Linha
              key={i.tx.id}
              goteira={<Selo situacao={s} />}
              titulo={i.label}
              meta={<FraseDeTempo situacao={s} prevista={i.date} />}
              situacao={<ChipSituacao situacao={s} />}
              valor={<Valor posto="linha" valor={i.amount} estado={estadoDe(s)} />}
              aoClicar={() => aoAbrir(i)}
              acao={
                <Button size="sm" variant="secundario" onClick={() => onPagar(i.tx)}>
                  Paguei
                </Button>
              }
            />
          )
          return n > 0 && itens[n - 1].date < hoje && i.date >= hoje
            ? [<LinhaGrupo key={`hoje-${i.tx.id}`} rotulo="Hoje" hoje />, linha]
            : [linha]
        })}
      </Cartao.Lista>
    </Cartao>
  )
}
