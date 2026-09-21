import { Fragment, useMemo, useState } from 'react'
import { ArrowDownCircle, ListOrdered } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { ReceberParcela } from '../ReceberParcela'
import { BaixarLancamento } from '../BaixarLancamento'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { EstadoVazio } from '@/components/ui/Estados'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { fraseDeTempo, situacaoDeTela } from '@/lib/situacao'
import { fraseDaEtapa } from '@/lib/etapas'
import { formatMonthYear, parseDateOnly, toDateOnly } from '@/lib/format'
import type { MoneyItem, SaleView } from '@/lib/sales'
import type { SaleInstallment, Transaction } from '@/types'

type Janela = 'mes' | 'trinta' | 'vencidas' | 'tudo'

/*
 * A RECEBER — o que ainda entra, por data de vencimento (planta 9.5).
 *
 * Só apresentação: a janela, o que entra em cada uma, os subtotais e a baixa
 * são os mesmos de antes. O herói é `previsto` (nada aqui se moveu) e mostra o
 * total da janela escolhida, como sempre mostrou. Carregando e erro são da
 * casca (AdminShell); o vazio fica dentro do cartão da lista.
 *
 * A situação sai de `situacaoDeTela`: parcela que a construtora não pagou
 * continua PREVISTA. A urgência vem da frase ("a construtora atrasou"), do
 * marco de HOJE e do subtotal de vencido do mês.
 */
export function Receber() {
  const { receber, mes, hoje } = useAdmin()
  const { abrir } = useComposicao()
  const [janela, setJanela] = useState<Janela>('mes')
  const [parcela, setParcela] = useState<{ venda: SaleView; p: SaleInstallment } | null>(null)
  const [avulso, setAvulso] = useState<Transaction | null>(null)

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
  const limite30 = toDateOnly(new Date(Date.now() + 30 * 86400000))

  const filtrar = (j: Janela) =>
    receber.filter((i) => {
      if (j === 'mes') return i.date.slice(0, 7) === chaveMes || i.overdue
      if (j === 'trinta') return i.date <= limite30
      if (j === 'vencidas') return i.overdue
      return true
    })

  const lista = useMemo(() => filtrar(janela), [receber, janela, chaveMes, limite30])

  const soma = (l: MoneyItem[]) => Math.round(l.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const total = soma(lista)
  const vencidas = lista.filter((i) => i.overdue)

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

  /** Agrupar por mês de vencimento, preservando a ordem de `receivablesOf`. */
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

  /*
   * Subtotal do mês que abre no que o compõe. O zero também abre (folha vazia
   * com a frase), porque todo número da tela tem um gatilho.
   */
  const subtotal = (l: MoneyItem[], rotulo: string, titulo: string, explica: string, previsto?: boolean) => {
    const abrirSubtotal = () =>
      abrir({ rotulo, titulo, explica, total: soma(l), itens: comp(l), vazio: 'Nenhuma parcela neste mês.' })
    return previsto || l.length === 0 ? (
      <ValorComOrigem
        valor={soma(l)}
        posto="fato"
        previsto
        rotuloAcessivel={`Ver de onde vem: ${titulo}`}
        aoAbrir={abrirSubtotal}
      />
    ) : (
      <ValorComOrigem
        valor={soma(l)}
        posto="fato"
        forte
        rotuloAcessivel={`Ver de onde vem: ${titulo}`}
        aoAbrir={abrirSubtotal}
      />
    )
  }

  /*
   * O par do grupo: "vencido R$ … · previsto R$ …". Nunca um total único —
   * somar cobrança com expectativa. Usa a forma do par (7.3.4), com as
   * palavras desta tela e os dois lados sempre visíveis, zero incluído.
   */
  const parDoMes = (itens: MoneyItem[], nome: string) => {
    const vencidos = itens.filter((i) => i.overdue)
    const previstos = itens.filter((i) => !i.overdue)
    return (
      <span data-par-agora-previsto className="text-t-meta">
        <span data-par-linha>
          {vencidos.length > 0 && (
            <span data-lado>
              <span className="font-label text-texto-meta">vencido</span>
              {subtotal(
                vencidos,
                'Vencido',
                `Vencido de ${nome}`,
                'Parcelas que já passaram da data e a construtora não pagou. É o que precisa de cobrança.',
              )}
            </span>
          )}
          {(previstos.length > 0 || vencidos.length === 0) && (
            <span data-lado>
              <span className="font-label text-texto-meta">previsto</span>
              {subtotal(
                previstos,
                'Previsto',
                `Previsto para ${nome}`,
                'Parcelas que ainda não venceram. A data pode mudar — depende da construtora.',
                true,
              )}
            </span>
          )}
        </span>
      </span>
    )
  }

  const abrirTotal = () =>
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

  const faixa = (
    <FiltrosRapidos
      rotuloAcessivel="Período"
      ativo={janela}
      aoMudar={setJanela}
      filtros={[
        { id: 'mes', rotulo: 'Este mês', contador: filtrar('mes').length },
        { id: 'trinta', rotulo: '30 dias', contador: filtrar('trinta').length },
        { id: 'vencidas', rotulo: 'Vencidas', contador: filtrar('vencidas').length },
        { id: 'tudo', rotulo: 'Tudo', contador: filtrar('tudo').length },
      ]}
    />
  )

  return (
    <PageLayout subtitulo={contagem} faixa={faixa}>
      <Heroi
        variante="previsto"
        rotulo="A receber · previsto"
        valor={total}
        aoAbrir={abrirTotal}
        rotuloAcessivel="Ver de onde vem o total a receber"
        frase={`${explicacao[janela]} ${contagem}. É comissão contratada, não dinheiro em conta.`}
      />

      <Cartao rotuloAcessivel="Parcelas a receber">
        <Cartao.Cabecalho titulo="Parcelas a receber" icone={ListOrdered} meta={contagem} />
        {lista.length === 0 ? (
          <EstadoVazio
            icone={ArrowDownCircle}
            titulo="Nada a receber aqui"
            descricao={
              janela === 'vencidas'
                ? 'Nenhuma parcela vencida. É o melhor cenário.'
                : 'Troque o período para ver o que vem mais adiante.'
            }
          />
        ) : (
          <Cartao.Lista
            rotuloAcessivel="Parcelas a receber, por mês de vencimento"
            chaveEscada={janela}
            colunas={{ situacao: true, valor: true, acao: '7rem', fim: true }}
          >
            {meses.map(([chave, itens]) => (
              <Fragment key={chave}>
                <LinhaGrupo
                  rotulo={nomeDoMes(chave)}
                  contador={itens.length === 1 ? '1 parcela' : `${itens.length} parcelas`}
                  par={parDoMes(itens, nomeDoMes(chave).toLowerCase())}
                />
                {itens.map((i, n) => {
                  const s = situacaoDe(i)
                  const outros = quem(i)
                  return (
                    <Fragment key={i.tx.id}>
                      {n > 0 && itens[n - 1].date < hoje && i.date >= hoje && <LinhaGrupo rotulo="Hoje" hoje />}
                      <Linha
                        titulo={i.label}
                        meta={
                          <>
                            {/* Parcela de venda mostra o degrau (gatilho, nota, pagamento);
                                entrada avulsa continua na frase de tempo de sempre. */}
                            {i.installment ? (
                              <span>{fraseDaEtapa(i.installment, hoje)}</span>
                            ) : (
                              <FraseDeTempo situacao={s} prevista={i.date} />
                            )}
                            {outros && ` · ${outros}`}
                          </>
                        }
                        situacao={<ChipSituacao situacao={s} />}
                        valor={<Valor valor={i.amount} posto="linha" />}
                        para={i.sale ? `/vendas/${i.sale.id}` : undefined}
                        acao={
                          <Button
                            size="sm"
                            variant="secundario"
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
              </Fragment>
            ))}
          </Cartao.Lista>
        )}
      </Cartao>

      <ReceberParcela venda={parcela?.venda ?? null} parcela={parcela?.p ?? null} onFechar={() => setParcela(null)} />
      <BaixarLancamento tx={avulso} onFechar={() => setAvulso(null)} />
    </PageLayout>
  )
}
