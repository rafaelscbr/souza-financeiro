import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Button } from '@/components/ui/Button'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { EstadoVazio } from '@/components/ui/Estados'
import { FiltrosDePeriodo } from '../RelatorioPecas'
import { GastoDoOrcamento } from '../GastoDoOrcamento'
import { dreGroupOf } from '@/lib/finance'
import { competenciaNoDre, periodosDoDre, type TipoPeriodo } from '@/lib/dre'
import {
  apurarOrcamento,
  comissaoMedia,
  custoNoPeriodo,
  margemDaCarteira,
  type Cenario,
  type CategoriaDoOrcamento,
} from '@/lib/orcamento'
import { formatCurrency, formatDate, formatPercent } from '@/lib/format'
import type { BudgetLine, Transaction } from '@/types'

/*
 * ORÇAMENTO — "estou dentro do plano?" (22/10/2026).
 *
 * Parte dos custos que o Rafael cadastra (confirmados e possíveis) e mede
 * contra o DRE: quanto a estrutura orçada custa, quanto as vendas deixam para
 * a imobiliária e quanto sobra ou falta. Quando falta, diz quantas vendas a
 * mais cobririam. As contas moram em lib/orcamento.ts; esta tela só mostra.
 */

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesCurto = (data: string) => `${NOMES[Number(data.slice(5, 7)) - 1]}/${data.slice(0, 4)}`

export function RelatorioOrcamento() {
  const { orcamento, transactions, installments, sales, mes } = useAdmin()
  const { abrir } = useComposicao()
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')
  const [cenario, setCenario] = useState<Cenario>('confirmado')
  const [editando, setEditando] = useState<BudgetLine | null>(null)
  const [cadastroAberto, setCadastroAberto] = useState(false)

  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const periodo = useMemo(() => periodosDoDre(mes, tipo).atual, [mes, tipo])
  const a = useMemo(
    () => apurarOrcamento({ linhas: orcamento, transactions, parcelas, periodo, cenario }),
    [orcamento, transactions, parcelas, periodo, cenario],
  )
  const margem = useMemo(() => margemDaCarteira(installments), [installments])
  const media = useMemo(() => comissaoMedia(sales), [sales])
  const temPossiveis = orcamento.some((l) => l.status === 'possivel')

  /** Quanto de comissão devida cobre um valor, e quantas vendas médias isso é. */
  const comissaoPara = (v: number) => (margem > 0 ? v / margem : 0)
  const vendasPara = (v: number) => (media > 0 ? comissaoPara(v) / media : 0)
  const emVendas = (n: number) => {
    if (n <= 0) return 'nenhuma venda'
    const arred = Math.round(n * 10) / 10
    return `${arred.toLocaleString('pt-BR')} ${arred <= 1 ? 'venda' : 'vendas'}`
  }

  /* ------------------------------------------------------------ abrir */

  const frase = (t: Transaction) =>
    t.status === 'settled'
      ? `${dreGroupOf(t) === 'revenue' ? 'recebido' : 'pago'} em ${formatDate(t.settled_date ?? t.competence_date)}`
      : `previsto para ${formatDate(competenciaNoDre(t, parcelas))}`
  const itensDe = (txs: Transaction[]) =>
    [...txs]
      .sort((x, y) => competenciaNoDre(x, parcelas).localeCompare(competenciaNoDre(y, parcelas)))
      .map((t) => ({
        id: t.id,
        titulo: t.description || t.category,
        meta: `${frase(t)} · ${t.category}`,
        valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
        para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
      }))
  const itensDoOrcamento = (linhas: BudgetLine[]) =>
    linhas.map((l) => ({
      id: l.id,
      titulo: `${l.description}${l.status === 'possivel' ? ' (possível)' : ''}`,
      meta: `${formatCurrency(l.amount)} por mês · ${l.category}`,
      valor: -custoNoPeriodo(l, periodo),
    }))

  const abrirVendas = () =>
    abrir({
      rotulo: 'As vendas deixam',
      titulo: `O que as vendas deixam · ${periodo.rotulo}`,
      explica:
        'A comissão que ficou devida no período menos o imposto e a parte dos corretores: o que sobra das vendas para pagar a estrutura.',
      total: a.vendasDeixam,
      itens: itensDe(a.lancamentosDasVendas),
      vazio: 'Nenhuma comissão ficou devida neste período.',
    })
  const abrirOrcado = () =>
    abrir({
      rotulo: 'Estrutura orçada',
      titulo: `Estrutura orçada · ${periodo.rotulo}`,
      explica: 'Cada gasto do orçamento, pelo valor do mês vezes os meses em que ele vale no período.',
      total: -a.orcado,
      itens: itensDoOrcamento(a.linhasDoPeriodo),
      vazio: 'Nenhum gasto orçado neste período.',
    })
  const abrirGasto = (c?: CategoriaDoOrcamento) => {
    const txs = c ? c.lancamentos : a.categorias.flatMap((x) => x.lancamentos)
    abrir({
      rotulo: c ? c.categoria : 'Gasto de verdade',
      titulo: `${c ? c.categoria : 'Gasto de verdade'} · ${periodo.rotulo}`,
      explica: c
        ? `Orçado: ${formatCurrency(c.orcado)}. Abaixo, o que foi lançado nesta categoria no período.`
        : 'As despesas da estrutura lançadas no período: comerciais, administrativas e pessoal.',
      total: -(c ? c.gasto : a.gasto),
      itens: itensDe(txs),
      vazio: 'Nada lançado neste período.',
    })
  }

  /* ------------------------------------------------------------ texto */

  const falta = -a.sobra
  const fraseDoHeroi = (
    <>
      As vendas deixam <Valor valor={a.vendasDeixam} posto="fato" /> e a estrutura orçada custa{' '}
      <Valor valor={a.orcado} posto="fato" />.{' '}
      {a.sobra >= 0 ? (
        a.gasto > a.orcado ? (
          <>
            Os custos orçados estão cobertos, mas o gasto de verdade passou do orçado em{' '}
            <Valor valor={a.gasto - a.orcado} posto="fato" />.
          </>
        ) : (
          'Os custos do período estão cobertos.'
        )
      ) : (
        <>
          Para cobrir, faltam <Valor valor={comissaoPara(falta)} posto="fato" /> de comissão: cerca de{' '}
          {emVendas(vendasPara(falta))}.
        </>
      )}
    </>
  )
  const rotulo = `${a.sobra >= 0 ? 'Sobra' : 'Falta'} depois da estrutura · ${periodo.rotulo}`
  const heroiComum = {
    valor: a.sobra,
    rotuloAcessivel: `Ver a estrutura orçada de ${periodo.rotulo}`,
    aoAbrir: abrirOrcado,
    frase: fraseDoHeroi,
    apoios: [
      { rotulo: 'As vendas deixam', valor: a.vendasDeixam, rotuloAcessivel: 'Ver o que as vendas deixam', aoAbrir: abrirVendas },
      { rotulo: 'Estrutura orçada', valor: -a.orcado, rotuloAcessivel: 'Ver a estrutura orçada', aoAbrir: abrirOrcado },
      { rotulo: 'Gasto de verdade', valor: -a.gasto, rotuloAcessivel: 'Ver o gasto de verdade', aoAbrir: () => abrirGasto() },
    ].filter((x) => x.valor !== 0),
  }

  const situacaoDaCategoria = (c: CategoriaDoOrcamento) => {
    if (c.orcado === 0) return 'fora do orçamento'
    if (c.gasto === 0) return 'nada lançado ainda'
    const d = c.gasto - c.orcado
    if (Math.abs(d) < 0.005) return 'igual ao orçado'
    return d > 0 ? `passou ${formatCurrency(d)}` : `${formatCurrency(-d)} abaixo do orçado`
  }

  const linhasOrdenadas = [...orcamento].sort(
    (x, y) => x.start_month.localeCompare(y.start_month) || x.description.localeCompare(y.description),
  )

  return (
    <PageLayout
      subtitulo="O que a estrutura vai custar e se as vendas cobrem."
      faixa={
        <>
          <FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />
          {temPossiveis && (
            <FiltrosRapidos
              rotuloAcessivel="Cenário"
              ativo={cenario}
              aoMudar={setCenario}
              filtros={[
                { id: 'confirmado', rotulo: 'Só o confirmado' },
                { id: 'com-possiveis', rotulo: 'Com os possíveis', dica: 'Soma também os gastos que você ainda está pensando em ter.' },
              ]}
            />
          )}
        </>
      }
    >
      {orcamento.length === 0 ? (
        <EstadoVazio
          icone={Plus}
          titulo="Nenhum gasto no orçamento"
          descricao="Cadastre os custos que a imobiliária tem ou vai ter, como coworking, tráfego e contabilidade. O relatório diz se as vendas cobrem."
          acao={
            <Button variant="primario" onClick={() => setCadastroAberto(true)}>
              Adicionar gasto
            </Button>
          }
        />
      ) : (
        <>
          {/* Com comissão prevista no período, o herói é previsão: rotulado e nunca ouro (13/09). */}
          {a.temPrevisto ? (
            <Heroi variante="previsto" rotulo={`${rotulo} · inclui o previsto`} {...heroiComum} />
          ) : a.sobra < 0 ? (
            <Heroi variante="ouro" estado="negativo" rotulo={rotulo} {...heroiComum} />
          ) : (
            <Heroi variante="ouro" rotulo={rotulo} {...heroiComum} />
          )}

          <Cartao>
            <Cartao.Cabecalho
              titulo="Orçado × gasto"
              meta="Por categoria. Toque para ver o que foi lançado."
            />
            {a.categorias.length === 0 ? (
              <Cartao.Corpo>
                <p className="text-texto text-t2">Nenhum gasto orçado nem lançado neste período.</p>
              </Cartao.Corpo>
            ) : (
              <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Orçado e gasto por categoria">
                {a.categorias.map((c) => (
                  <Linha
                    key={c.categoria}
                    titulo={c.categoria}
                    meta={c.orcado === 0 ? 'fora do orçamento' : `orçado ${formatCurrency(c.orcado)} · ${situacaoDaCategoria(c)}`}
                    valor={<Valor valor={-c.gasto} posto="linha" estado={c.gasto > 0 ? 'negativo' : undefined} />}
                    metaValor="gasto"
                    aoClicar={() => abrirGasto(c)}
                  />
                ))}
              </Cartao.Lista>
            )}
          </Cartao>

          <Cartao>
            <Cartao.Cabecalho titulo="Quanto precisa vender" />
            <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Quanto precisa vender">
              <Linha
                titulo="Comissão que cobre a estrutura"
                meta={`a imobiliária fica com ${formatPercent(margem, 0)} de cada comissão, depois de imposto e corretor`}
                valor={<Valor valor={comissaoPara(a.orcado)} posto="linha" />}
                aoClicar={abrirOrcado}
              />
              <Linha
                titulo="Em vendas"
                meta={`com a comissão média de ${formatCurrency(media)} por venda`}
                valor={<span className="text-texto-titulo text-t1">{emVendas(vendasPara(a.orcado))}</span>}
              />
            </Cartao.Lista>
          </Cartao>

          <Cartao>
            <Cartao.Cabecalho
              titulo="Seus gastos orçados"
              meta="Toque num gasto para mudar ou apagar."
              extra={
                <Button variant="secundario" size="sm" onClick={() => setCadastroAberto(true)}>
                  Adicionar gasto
                </Button>
              }
            />
            <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Gastos do orçamento">
              {linhasOrdenadas.map((l) => (
                <Linha
                  key={l.id}
                  titulo={`${l.description}${l.status === 'possivel' ? ' · possível' : ''}`}
                  meta={`${l.category} · ${mesCurto(l.start_month)} ${l.end_month ? `a ${mesCurto(l.end_month)}` : 'em diante'}`}
                  valor={<Valor valor={l.amount} posto="linha" />}
                  metaValor="por mês"
                  aoClicar={() => setEditando(l)}
                />
              ))}
            </Cartao.Lista>
          </Cartao>
        </>
      )}

      <GastoDoOrcamento
        aberto={cadastroAberto || editando !== null}
        linha={editando}
        aoFechar={() => {
          setCadastroAberto(false)
          setEditando(null)
        }}
      />
    </PageLayout>
  )
}
