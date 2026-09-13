import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { ArrowUpCircle } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { BaixarLancamento } from '../BaixarLancamento'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao, SubtotalDuplo } from '@/components/ui/Secao'
import { Lista, Linha, LinhaDeHoje } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { VOCABULARIO, fraseDeTempo, situacaoDeTela, type Situacao } from '@/lib/situacao'
import type { Transaction } from '@/types'
import type { MoneyItem } from '@/lib/sales'

const soma = (l: MoneyItem[]) => Math.round(l.reduce((s, i) => s + i.amount, 0) * 100) / 100

/*
 * A situação de uma linha a pagar.
 *
 * A fonte é `released`, que é o MESMO campo que define o que esta tela chama
 * de devido (src/lib/sales.ts): comissão só é liberada quando a parcela da
 * venda foi recebida; imposto e despesa nascem liberados, porque a obrigação é
 * da própria linha. Assim o chip nunca contradiz o total do topo.
 *
 * O status da parcela não serve aqui, e isso é a parte que engana: ele vira
 * 'recebida' justamente no instante em que a comissão passa a ser devida —
 * exibir "Recebida" numa comissão que ainda não foi paga ao corretor diria o
 * contrário do que está acontecendo.
 *
 * A regra de atraso não é escrita nesta tela: quem aplica é `situacaoDeTela`,
 * e é ela que garante que comissão ainda prevista nunca apareça como vencida.
 * Parcela que a construtora não pagou é espera, não dívida.
 */
function situacaoDaLinha(i: MoneyItem, hoje: string): Situacao {
  return situacaoDeTela(i.released ? 'liberada' : 'prevista', i.date, hoje)
}

/**
 * O que sai, com as comissões liberadas em primeiro lugar.
 *
 * A ordem da tela é a ordem da obrigação: comissão que já venceu porque a
 * imobiliária recebeu vem antes de imposto, e imposto antes de despesa. A
 * comissão ainda prevista aparece separada, porque não é dívida hoje — o
 * corretor só recebe quando a venda receber.
 *
 * A conversão é de APRESENTAÇÃO: os grupos, o que conta como devido e as duas
 * baixas (comissão em lote e lançamento avulso) continuam idênticos. Mudou
 * como a tela fala:
 *
 * 1. O número do topo era uma frase em 13px ("R$ X devido agora"). Agora é o
 *    herói da tela, e ele ABRE nas linhas que o formam — comissão liberada,
 *    imposto e despesa, cada uma com link para a venda de origem.
 *
 * 2. As parcelas de cada corretor eram uma lista em `text-xs` sem ordinal,
 *    sem situação e sem data com verbo. Agora cada corretor é uma linha de
 *    44px com selo, chip e a frase de espera da parcela mais antiga, e o valor
 *    abre nas parcelas que ele tem a receber.
 *
 * 3. O cabeçalho da comissão trazia um total só. Ele virou `SubtotalDuplo`:
 *    "agora · previsto". Somar os dois seria dizer que a imobiliária deve algo
 *    que depende da construtora pagar primeiro — o erro que já estava
 *    documentado no Início.
 *
 * 4. Saíram os cartões com sombra e a moldura âmbar da seção de comissões —
 *    desenhadas com tokens que não existem mais — junto com os chips de 10px
 *    com fundo em alpha.
 */
export function Pagar() {
  const { pagar, hoje } = useAdmin()
  const { abrir } = useComposicao()
  const [comissoes, setComissoes] = useState<ComissaoAPagar[] | null>(null)
  const [avulso, setAvulso] = useState<Transaction | null>(null)

  const grupos = useMemo(() => {
    const liberadas = pagar.filter((i) => i.kind === 'comissao' && i.released)
    const previstas = pagar.filter((i) => i.kind === 'comissao' && !i.released)
    const impostos = pagar.filter((i) => i.kind === 'imposto')
    const despesas = pagar.filter((i) => i.kind === 'despesa' || i.kind === 'socio')
    return { liberadas, previstas, impostos, despesas }
  }, [pagar])

  const porCorretor = useMemo(() => {
    const m = new Map<string, MoneyItem[]>()
    for (const i of grupos.liberadas) {
      const nome = i.sale?.brokerName ?? 'corretor'
      const a = m.get(nome)
      if (a) a.push(i)
      else m.set(nome, [i])
    }
    return [...m.entries()]
  }, [grupos.liberadas])

  // O total vem do grupo (src/lib/sales.ts), não da soma das listas: imposto
  // de parcela futura, despesa que ainda não venceu e retirada do sócio
  // aparecem nas listas, mas não são devido agora.
  const devido = useMemo(() => pagar.filter((i) => i.grupo === 'devido'), [pagar])
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
  const comp = (l: MoneyItem[]) =>
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

  /** Um subtotal que abre no que o compõe. Nenhum número fica sem origem. */
  const subtotal = (l: MoneyItem[], rotulo: string, titulo: string, explica: string, tinta?: string) =>
    l.length === 0 ? (
      <Valor valor={0} posto="fato" tinta="text-content-faint" />
    ) : (
      <ValorComOrigem
        valor={soma(l)}
        posto="fato"
        tinta={tinta}
        rotuloAcessivel={`Ver de onde vem: ${titulo}`}
        aoAbrir={() => abrir({ rotulo, titulo, explica, total: soma(l), itens: comp(l) })}
      />
    )

  if (pagar.length === 0) {
    return (
      <EmptyState
        icon={<ArrowUpCircle className="h-8 w-8" />}
        title="Nada a pagar"
        description="Nenhuma comissão liberada, nenhum imposto e nenhuma despesa em aberto."
      />
    )
  }

  return (
    <div className="animate-fade-in">
      {/*
       * UM número em degrau herói, e ele é só o que é obrigação de fato — a
       * mesma conta que a tela já fazia. A frase de contexto existe para dizer
       * o que ele NÃO é: previsão não entra aqui.
       */}
      <Heroi
        rotulo="Devido agora"
        contexto="Comissão de parcela que a imobiliária já recebeu, imposto e despesa lançada. Comissão que depende da construtora pagar não entra nesta conta."
      >
        <ValorComOrigem
          valor={totalDevido}
          posto="heroi"
          rotuloAcessivel="Ver de onde vem o total devido agora"
          aoAbrir={() =>
            abrir({
              rotulo: 'Devido agora',
              titulo: 'O que é obrigação hoje',
              explica:
                'Só o que a imobiliária de fato deve: comissão de parcela já recebida, imposto e despesa lançada.',
              total: totalDevido,
              itens: comp(devido),
              nota: 'Comissão de parcela que a construtora ainda não pagou não entra aqui. Ela aparece abaixo, como previsão.',
              vazio: 'Nada devido agora.',
            })
          }
        />
      </Heroi>

      {(porCorretor.length > 0 || grupos.previstas.length > 0) && (
        <Secao
          titulo="Comissão do corretor"
          /*
           * Dois números, nunca um. O da esquerda é dívida; o da direita
           * depende de a construtora pagar primeiro. A palavra entre eles é o
           * que impede a soma.
           */
          subtotal={
            <SubtotalDuplo
              agora={subtotal(
                grupos.liberadas,
                'Liberada',
                'Comissão liberada',
                'A imobiliária já recebeu estas parcelas. A comissão do corretor está a pagar.',
              )}
              previsto={subtotal(
                grupos.previstas,
                'Prevista',
                'Comissão ainda prevista',
                'Só vira dívida quando a construtora pagar a parcela. Até lá não é obrigação e não entra em nenhum total de dívida.',
                'text-content-muted',
              )}
            />
          }
        >
          {porCorretor.length > 0 && (
            <Lista>
              {porCorretor.map(([nome, itens]) => {
                /*
                 * Uma linha por corretor. A situação do grupo é a pior das
                 * parcelas dele: basta uma esperando há mais tempo que o
                 * previsto para o grupo inteiro pedir atenção.
                 */
                const s: Situacao = itens.some((i) => situacaoDaLinha(i, hoje) === 'vencida')
                  ? 'vencida'
                  : 'liberada'
                const maisAntiga = itens[0]
                return (
                  <Linha
                    key={nome}
                    selo={<Selo situacao={s} />}
                    titulo={nome}
                    meta={
                      <span className="flex flex-wrap items-baseline gap-x-1.5">
                        <span>
                          {itens.length === 1 ? 'uma parcela ·' : `${itens.length} parcelas · a mais antiga`}
                        </span>
                        <FraseDeTempo
                          situacao={situacaoDaLinha(maisAntiga, hoje)}
                          prevista={maisAntiga.date}
                          liberada={maisAntiga.installment?.received_date}
                        />
                      </span>
                    }
                    situacao={<ChipSituacao situacao={s} />}
                    valor={
                      <ValorComOrigem
                        valor={soma(itens)}
                        tinta={VOCABULARIO[s].tinta}
                        rotuloAcessivel={`Ver de quais vendas vem a comissão de ${nome}`}
                        aoAbrir={() =>
                          abrir({
                            rotulo: nome,
                            titulo: `Comissão liberada de ${nome}`,
                            explica:
                              'Parcelas que a imobiliária já recebeu. É dinheiro do corretor, esperando o repasse.',
                            total: soma(itens),
                            itens: comp(itens),
                          })
                        }
                      />
                    }
                    acao={
                      <Button onClick={() => setComissoes(paraPagamento(itens))}>
                        {itens.length > 1 ? 'Pagar tudo' : 'Pagar'}
                      </Button>
                    }
                  />
                )
              })}
            </Lista>
          )}

          {grupos.previstas.length > 0 && (
            <>
              {/*
               * A previsão fica no mesmo lugar da comissão, porque é da mesma
               * conta — mas em bloco próprio, sem cor tônica e sem botão de
               * pagar: `pay_broker_installments` recusa parcela não recebida,
               * e oferecer o botão seria prometer uma ação que o banco nega.
               */}
              <p className="mb-1 mt-6 border-b border-line pb-1.5 text-xs font-medium uppercase tracking-wide text-content-muted">
                Depende do recebimento
              </p>
              <p className="mb-1 text-sm text-content-faint">
                O corretor recebe quando a imobiliária receber. Não é dívida hoje, e nada daqui entra no
                número do topo.
              </p>
              <Lista>
                {grupos.previstas.map((i, n) => {
                  const s = situacaoDaLinha(i, hoje)
                  return (
                    <Fragment key={i.tx.id}>
                      {n > 0 && grupos.previstas[n - 1].date < hoje && i.date >= hoje && <LinhaDeHoje />}
                      <Linha
                        selo={<Selo situacao={s} idx={i.installment?.idx} count={i.installment?.count} />}
                        titulo={i.label}
                        meta={
                          <span className="flex flex-wrap items-baseline gap-x-1.5">
                            <span>{i.sale?.brokerName ?? 'corretor'} ·</span>
                            <FraseDeTempo situacao={s} prevista={i.date} />
                          </span>
                        }
                        situacao={<ChipSituacao situacao={s} />}
                        valor={<Valor valor={i.amount} posto="linha" tinta={VOCABULARIO[s].tinta} />}
                        para={i.sale ? `/vendas/${i.sale.id}` : undefined}
                      />
                    </Fragment>
                  )
                })}
              </Lista>
            </>
          )}
        </Secao>
      )}

      {grupos.impostos.length > 0 && (
        <GrupoDeSaida
          titulo="Imposto"
          explica="Guia do Simples e ISS retido na fonte."
          subtotal={subtotal(
            grupos.impostos,
            'Imposto',
            'Imposto a pagar',
            'Simples e ISS das parcelas de venda, na conta desta tela.',
          )}
          itens={grupos.impostos}
          hoje={hoje}
          onPagar={setAvulso}
        />
      )}

      {grupos.despesas.length > 0 && (
        <GrupoDeSaida
          titulo="Despesas"
          explica="Estrutura da imobiliária e retiradas do sócio."
          subtotal={subtotal(
            grupos.despesas,
            'Despesas',
            'Despesa a pagar',
            'Despesa lançada e distribuição do sócio ainda em aberto.',
          )}
          itens={grupos.despesas}
          hoje={hoje}
          onPagar={setAvulso}
        />
      )}

      <PagarComissao itens={comissoes} onFechar={() => setComissoes(null)} />
      <BaixarLancamento tx={avulso} onFechar={() => setAvulso(null)} />
    </div>
  )
}

/**
 * Um grupo de saída que não é comissão: imposto e despesa.
 *
 * Aqui a linha é o próprio lançamento — não há parcela de corretor por trás —
 * então o selo vai sem ordinal e a baixa é a avulsa, a mesma de antes.
 */
function GrupoDeSaida({
  titulo,
  explica,
  subtotal,
  itens,
  hoje,
  onPagar,
}: {
  titulo: string
  explica: string
  subtotal: ReactNode
  itens: MoneyItem[]
  hoje: string
  onPagar: (t: Transaction) => void
}) {
  return (
    <Secao titulo={titulo} subtotal={subtotal}>
      <p className="mb-1 text-sm text-content-faint">{explica}</p>
      <Lista>
        {itens.map((i, n) => {
          const s = situacaoDaLinha(i, hoje)
          return (
            <Fragment key={i.tx.id}>
              {/* O fio de HOJE: acima o que já venceu, abaixo o que ainda vai vencer. */}
              {n > 0 && itens[n - 1].date < hoje && i.date >= hoje && <LinhaDeHoje />}
              <Linha
                selo={<Selo situacao={s} idx={i.installment?.idx} count={i.installment?.count} />}
                titulo={i.label}
                meta={<FraseDeTempo situacao={s} prevista={i.date} />}
                situacao={<ChipSituacao situacao={s} />}
                valor={<Valor valor={i.amount} posto="linha" tinta={VOCABULARIO[s].tinta} />}
                acao={
                  <Button variant="secondary" onClick={() => onPagar(i.tx)}>
                    Paguei
                  </Button>
                }
              />
            </Fragment>
          )
        })}
      </Lista>
    </Secao>
  )
}
