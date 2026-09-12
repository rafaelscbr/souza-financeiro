import { Fragment, useMemo, useState } from 'react'
import { ArrowDownCircle } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { ReceberParcela } from '../ReceberParcela'
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
import { Segmented } from '@/components/ui/Segmented'
import { fraseDeTempo, situacaoDeTela } from '@/lib/situacao'
import { formatMonthYear, parseDateOnly, toDateOnly } from '@/lib/format'
import type { MoneyItem, SaleView } from '@/lib/sales'
import type { SaleInstallment, Transaction } from '@/types'

type Janela = 'mes' | 'trinta' | 'vencidas' | 'tudo'

/*
 * A RECEBER — o que ainda entra, por data de vencimento.
 *
 * A conversão é de APRESENTAÇÃO: a janela de filtro, o que entra em cada uma
 * delas e a baixa continuam exatamente como estavam. O que mudou foi como a
 * tela fala, e cada mudança corrige um defeito que estava escrito no arquivo
 * anterior:
 *
 * 1. O total vinha em `text-income` — verde. Neste sistema verde significa uma
 *    coisa só: dinheiro que SE MOVEU. Nenhum valor desta tela se moveu; todos
 *    são promessa de contrato. O verde saiu.
 *
 * 2. O total era um número solto dentro de um cartão, sem origem. Agora ele é
 *    o herói da tela e ABRE nas parcelas que o formam, cada uma com link para
 *    a venda. Era o pedido central: nenhum número sem origem.
 *
 * 3. O selo de vencida vinha em 10px sobre um fundo crítico com alpha —
 *    abaixo do piso de 12px, e com um contraste que ninguém calculou. Saiu
 *    pelo `ChipSituacao`, que declara o par tinta+fundo.
 *
 * 4. A data aparecia sozinha ("30/06/2026"). Data sem verbo não diz estado;
 *    agora é a `FraseDeTempo` — "era prevista para 12/08 · a construtora
 *    atrasou".
 *
 * 5. Não havia subtotal por mês. "Quanto entra em outubro" era conta de
 *    cabeça, e a resposta honesta são DOIS números: o que já venceu e o que
 *    ainda vai vencer. Nunca a soma dos dois.
 *
 * Sobre a cor do vencido: ela desapareceu de propósito. `situacaoDeTela` é
 * quem decide a situação, e parcela que a construtora não pagou continua
 * PREVISTA — atraso, neste sistema, é só o que a imobiliária já recebeu e não
 * repassou. Quem carrega a urgência aqui é a palavra ("a construtora
 * atrasou"), a posição acima do fio de HOJE e o subtotal de vencido do mês.
 */
export function Receber() {
  const { receber, mes, hoje } = useAdmin()
  const { abrir } = useComposicao()
  const [janela, setJanela] = useState<Janela>('mes')
  const [parcela, setParcela] = useState<{ venda: SaleView; p: SaleInstallment } | null>(null)
  const [avulso, setAvulso] = useState<Transaction | null>(null)

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
  const limite30 = toDateOnly(new Date(Date.now() + 30 * 86400000))

  const lista = useMemo(
    () =>
      receber.filter((i) => {
        if (janela === 'mes') return i.date.slice(0, 7) === chaveMes || i.overdue
        if (janela === 'trinta') return i.date <= limite30
        if (janela === 'vencidas') return i.overdue
        return true
      }),
    [receber, janela, chaveMes, limite30],
  )

  const soma = (l: MoneyItem[]) => Math.round(l.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const total = soma(lista)
  const vencidas = lista.filter((i) => i.overdue)

  /*
   * A situação sai de `situacaoDeTela` e nunca de uma comparação de data
   * escrita aqui. Como todo lançamento desta tela é receita pendente, a
   * parcela de origem está sempre `prevista` — e é isso que a tela mostra,
   * inclusive depois da data.
   */
  const situacaoDe = (i: MoneyItem) => situacaoDeTela(i.installment?.status ?? 'prevista', i.date, hoje)

  /** Quem está do outro lado da parcela: o cliente e o empreendimento. */
  const quem = (i: MoneyItem) => [i.sale?.client_name, i.sale?.development].filter(Boolean).join(' · ')

  /** Transforma uma lista de lançamentos na composição que a folha exibe. */
  const comp = (l: MoneyItem[]) =>
    l.map((i) => ({
      id: i.tx.id,
      titulo: i.label,
      meta: [quem(i), fraseDeTempo(situacaoDe(i), { prevista: i.date }, hoje)].filter(Boolean).join(' · '),
      valor: i.amount,
      situacao: situacaoDe(i),
      idx: i.installment?.idx,
      count: i.installment?.count,
      para: i.sale ? `/vendas/${i.sale.id}` : undefined,
    }))

  /*
   * Um subtotal que abre no que o compõe — as duas metades do `SubtotalDuplo`
   * usam este mesmo caminho. Subtotal de mês é justamente o número que
   * ninguém confere de cabeça; sem origem ele é só uma afirmação.
   */
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

  /*
   * Agrupar por mês de vencimento. A ordem por data já vem de `receivablesOf`,
   * então basta preservar a ordem de entrada: o Map do JS mantém a ordem de
   * inserção das chaves.
   */
  const meses = useMemo(() => {
    const m = new Map<string, MoneyItem[]>()
    for (const i of lista) {
      const chave = i.date.slice(0, 7)
      const a = m.get(chave)
      if (a) a.push(i)
      else m.set(chave, [i])
    }
    return [...m.entries()]
  }, [lista])

  const nomeDoMes = (chave: string) => formatMonthYear(parseDateOnly(`${chave}-01`))

  const explicacao: Record<Janela, string> = {
    mes: `Parcelas que vencem em ${formatMonthYear(mes).toLowerCase()}, mais tudo o que já venceu e não entrou — o vencido é justamente o que precisa de cobrança.`,
    trinta: 'Tudo o que vence nos próximos 30 dias, incluindo o que já passou da data.',
    vencidas: 'Só o que já passou da data e a construtora não pagou.',
    tudo: 'Toda a comissão contratada que ainda não entrou, somando todos os meses.',
  }

  const contagem =
    `${lista.length === 1 ? '1 parcela' : `${lista.length} parcelas`}` +
    (vencidas.length > 0 ? `, ${vencidas.length} já vencida${vencidas.length > 1 ? 's' : ''}` : '')

  return (
    <div className="animate-fade-in">
      {/*
       * UM número em degrau herói: o que ainda entra na janela escolhida. E a
       * frase de contexto existe para dizer o que ele NÃO é — nada disso está
       * em conta.
       */}
      <Heroi
        rotulo="A receber"
        contexto={`${explicacao[janela]} ${contagem}. É comissão contratada, não dinheiro em conta.`}
      >
        {lista.length > 0 ? (
          <ValorComOrigem
            valor={total}
            posto="heroi"
            rotuloAcessivel="Ver de onde vem o total a receber"
            aoAbrir={() =>
              abrir({
                rotulo: 'A receber',
                titulo: 'De onde vem o que ainda entra',
                explica: explicacao[janela],
                total,
                itens: comp(lista),
                nota:
                  vencidas.length > 0
                    ? 'Parcela vencida quase sempre é a construtora atrasando, não o cliente. Reagende na ficha da venda para a previsão voltar a fazer sentido.'
                    : undefined,
                vazio: 'Nada a receber nesta janela.',
              })
            }
          />
        ) : (
          <Valor valor={0} posto="heroi" tinta="text-content-muted" />
        )}
      </Heroi>

      <Segmented
        ariaLabel="Período"
        value={janela}
        onChange={setJanela}
        options={[
          { value: 'mes', label: 'Este mês' },
          { value: 'trinta', label: '30 dias' },
          { value: 'vencidas', label: 'Vencidas' },
          { value: 'tudo', label: 'Tudo' },
        ]}
      />

      {lista.length === 0 ? (
        <EmptyState
          icon={<ArrowDownCircle className="h-8 w-8" />}
          title="Nada a receber aqui"
          description={
            janela === 'vencidas'
              ? 'Nenhuma parcela vencida. É o melhor cenário.'
              : 'Troque o período para ver o que vem mais adiante.'
          }
        />
      ) : (
        meses.map(([chave, itens]) => {
          const vencidoDoMes = itens.filter((i) => i.overdue)
          const aVencerDoMes = itens.filter((i) => !i.overdue)
          const nome = nomeDoMes(chave).toLowerCase()
          return (
            <Secao
              key={chave}
              titulo={nomeDoMes(chave)}
              /*
               * Nunca um total único: somar o que já venceu com o que ainda
               * vai vencer é misturar cobrança com expectativa. São dois
               * números, com a palavra que os separa.
               */
              subtotal={
                <SubtotalDuplo
                  rotuloAgora="vencido"
                  agora={subtotal(
                    vencidoDoMes,
                    'Vencido',
                    `Vencido de ${nome}`,
                    'Parcelas que já passaram da data e a construtora não pagou. É o que precisa de cobrança.',
                  )}
                  previsto={subtotal(
                    aVencerDoMes,
                    'Previsto',
                    `Previsto para ${nome}`,
                    'Parcelas que ainda não venceram. A data pode mudar — depende da construtora.',
                    'text-content-muted',
                  )}
                />
              }
            >
              <Lista>
                {itens.map((i, n) => {
                  const s = situacaoDe(i)
                  const outros = quem(i)
                  return (
                    <Fragment key={i.tx.id}>
                      {/*
                       * O fio de HOJE: cheio acima, tracejado abaixo. Acima é
                       * o que já devia ter entrado; abaixo é promessa.
                       */}
                      {n > 0 && itens[n - 1].date < hoje && i.date >= hoje && <LinhaDeHoje />}
                      <Linha
                        selo={<Selo situacao={s} idx={i.installment?.idx} count={i.installment?.count} />}
                        titulo={i.label}
                        meta={
                          <span className="flex flex-wrap items-baseline gap-x-1.5">
                            <FraseDeTempo situacao={s} prevista={i.date} />
                            {outros && <span>· {outros}</span>}
                          </span>
                        }
                        situacao={<ChipSituacao situacao={s} />}
                        valor={<Valor valor={i.amount} posto="linha" />}
                        para={i.sale ? `/vendas/${i.sale.id}` : undefined}
                        acao={
                          <Button
                            onClick={() => {
                              if (i.sale && i.installment) setParcela({ venda: i.sale, p: i.installment })
                              else setAvulso(i.tx)
                            }}
                          >
                            Recebi
                          </Button>
                        }
                      />
                    </Fragment>
                  )
                })}
              </Lista>
            </Secao>
          )
        })
      )}

      <ReceberParcela
        venda={parcela?.venda ?? null}
        parcela={parcela?.p ?? null}
        onFechar={() => setParcela(null)}
      />
      <BaixarLancamento tx={avulso} onFechar={() => setAvulso(null)} />
    </div>
  )
}
