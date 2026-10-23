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
import { GastoDoOrcamento } from '../GastoDoOrcamento'
import { TetoDoOrcamento } from '../TetoDoOrcamento'
import { dreGroupOf } from '@/lib/finance'
import { competenciaNoDre } from '@/lib/dre'
import { custoNoPeriodo, orcamentoMesAMes, type Cenario } from '@/lib/orcamento'
import { formatCurrency, formatDate } from '@/lib/format'
import type { BudgetLine, Transaction } from '@/types'

/*
 * ORÇAMENTO — "as vendas cobrem a estrutura?" (22/10/2026).
 *
 * Refeito no mesmo dia: a primeira versão tinha filtro de período, três
 * números no destaque, orçado × gasto por categoria e "quanto precisa
 * vender", e o Rafael achou difícil de entender. Agora se lê como uma
 * planilha: um resultado no topo, uma linha por mês (custo, o que as vendas
 * deixam e o que sobra ou falta) e a lista dos gastos. Tocar num mês abre a
 * conta daquele mês. As contas moram em lib/orcamento.ts.
 *
 * Com o teto de gastos (040) definido, o custo de cada mês é o teto, e os
 * gastos orçados mostram onde ele vai; o que sobra é o "livre do teto".
 */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const nomeDoMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`
const mesCurto = (m: string) => `${CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`

export function RelatorioOrcamento() {
  const { company, orcamento, transactions, installments, hoje } = useAdmin()
  const { abrir } = useComposicao()
  const [cenario, setCenario] = useState<Cenario>('confirmado')
  const [editando, setEditando] = useState<BudgetLine | null>(null)
  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [tetoAberto, setTetoAberto] = useState(false)

  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const meses = useMemo(
    () => orcamentoMesAMes({ linhas: orcamento, transactions, parcelas, cenario, hoje: new Date(`${hoje}T12:00:00`) }),
    [orcamento, transactions, parcelas, cenario, hoje],
  )
  const temPossiveis = orcamento.some((l) => l.status === 'possivel')

  /*
   * O teto (040) é o custo do mês: o orçamento gira em torno dele. Sem teto,
   * vale a soma dos gastos orçados, como antes.
   */
  const teto = company?.monthly_budget ?? null
  type Mes = (typeof meses)[number]
  const custoDe = (m: Mes) => teto ?? m.apuracao.orcado
  const sobraDe = (m: Mes) => Math.round((m.apuracao.vendasDeixam - custoDe(m)) * 100) / 100
  const maiorMesFixo = meses.reduce((mx, m) => Math.max(mx, m.apuracao.orcado), 0)
  const mesAtual = meses.find((m) => m.mes === hoje.slice(0, 7)) ?? meses[0]

  const custoTotal = meses.reduce((s, m) => s + custoDe(m), 0)
  const vendasTotal = meses.reduce((s, m) => s + m.apuracao.vendasDeixam, 0)
  const resultado = Math.round((vendasTotal - custoTotal) * 100) / 100
  const noVermelho = meses.filter((m) => sobraDe(m) < 0)
  const intervalo = meses.length ? `${mesCurto(meses[0].mes)} a ${mesCurto(meses[meses.length - 1].mes)}` : ''

  /* ------------------------------------------------------------ abrir */

  const frase = (t: Transaction) =>
    t.status === 'settled'
      ? `${dreGroupOf(t) === 'revenue' ? 'recebido' : 'pago'} em ${formatDate(t.settled_date ?? t.competence_date)}`
      : `previsto para ${formatDate(competenciaNoDre(t, parcelas))}`

  /** A conta de um mês: os gastos orçados (−) e o que as vendas deixam (+), item por item. */
  const abrirMes = (m: Mes) => {
    const a = m.apuracao
    const livreDoTeto = teto ? Math.round((teto - a.orcado) * 100) / 100 : 0
    abrir({
      rotulo: sobraDe(m) >= 0 ? 'Sobra' : 'Falta',
      titulo: nomeDoMes(m.mes),
      explica: teto
        ? `As vendas deixam ${formatCurrency(a.vendasDeixam)} e o teto de gastos é ${formatCurrency(teto)}. Abaixo, onde o teto vai e cada comissão do mês, já sem imposto e corretor.`
        : `As vendas deixam ${formatCurrency(a.vendasDeixam)} e a estrutura orçada custa ${formatCurrency(a.orcado)}. Abaixo, cada gasto e cada comissão do mês, já sem imposto e corretor.`,
      total: sobraDe(m),
      itens: [
        ...a.linhasDoPeriodo.map((l) => ({
          id: l.id,
          titulo: `${l.description}${l.status === 'possivel' ? ' (possível)' : ''}`,
          meta: `gasto orçado · ${l.category}`,
          valor: -custoNoPeriodo(l, m.periodo),
        })),
        ...(livreDoTeto !== 0
          ? [
              {
                id: 'livre-do-teto',
                titulo: livreDoTeto > 0 ? 'Livre do teto' : 'Gastos orçados acima do teto',
                meta: livreDoTeto > 0 ? 'o que sobra do teto para gastos fora do plano' : 'os gastos fixos passam do teto neste mês',
                valor: -livreDoTeto,
              },
            ]
          : []),
        ...[...a.lancamentosDasVendas]
          .sort((x, y) => competenciaNoDre(x, parcelas).localeCompare(competenciaNoDre(y, parcelas)))
          .map((t) => ({
            id: t.id,
            titulo: t.description || t.category,
            meta: `${frase(t)} · ${t.category}`,
            valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
            para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
          })),
      ],
      nota: a.temPrevisto ? 'Parte das comissões ainda é previsão: depende de a construtora pagar no prazo.' : undefined,
      vazio: 'Nada orçado nem vendido neste mês.',
    })
  }

  const abrirTodos = () =>
    abrir({
      rotulo: resultado >= 0 ? 'Sobra' : 'Falta',
      titulo: `Orçamento · ${intervalo}`,
      explica: teto
        ? 'Mês a mês: o que as vendas deixam menos o teto de gastos.'
        : 'Mês a mês: o que as vendas deixam menos o que a estrutura orçada custa.',
      total: resultado,
      itens: meses.map((m) => ({
        id: m.mes,
        titulo: nomeDoMes(m.mes),
        meta: `${teto ? 'teto' : 'custos'} ${formatCurrency(custoDe(m))} · vendas deixam ${formatCurrency(m.apuracao.vendasDeixam)}`,
        valor: sobraDe(m),
      })),
      vazio: 'Nenhum mês com gasto orçado.',
    })

  const linhasOrdenadas = [...orcamento].sort(
    (x, y) => x.start_month.localeCompare(y.start_month) || x.description.localeCompare(y.description),
  )

  return (
    <PageLayout
      subtitulo="O que a estrutura vai custar e se as vendas cobrem."
      faixa={
        temPossiveis ? (
          <FiltrosRapidos
            rotuloAcessivel="Cenário"
            ativo={cenario}
            aoMudar={setCenario}
            filtros={[
              { id: 'confirmado', rotulo: 'Só o confirmado' },
              { id: 'com-possiveis', rotulo: 'Com os possíveis', dica: 'Soma também os gastos que você ainda está pensando em ter.' },
            ]}
          />
        ) : undefined
      }
    >
      {orcamento.length === 0 ? (
        <EstadoVazio
          icone={Plus}
          titulo="Nenhum gasto no orçamento"
          descricao="Cadastre os custos que a imobiliária tem ou vai ter, como coworking, tráfego e contabilidade. A tela mostra, mês a mês, se as vendas cobrem."
          acao={
            <Button variant="primario" onClick={() => setCadastroAberto(true)}>
              Adicionar gasto
            </Button>
          }
        />
      ) : (
        <>
          {/* O orçamento olha para a frente: é previsão, rotulado e nunca ouro (regra de 13/09). */}
          <Heroi
            variante="previsto"
            rotulo={`${resultado >= 0 ? 'Sobra prevista' : 'Falta prevista'} · ${intervalo}`}
            valor={resultado}
            rotuloAcessivel="Ver o resultado de cada mês"
            aoAbrir={abrirTodos}
            frase={
              <>
                {teto ? (
                  <>
                    O teto de gastos é <Valor valor={teto} posto="fato" /> por mês,{' '}
                    <Valor valor={custoTotal} posto="fato" /> no período. As vendas já fechadas devem deixar{' '}
                    <Valor valor={vendasTotal} posto="fato" />.{' '}
                  </>
                ) : (
                  <>
                    A estrutura custa <Valor valor={custoTotal} posto="fato" /> no período e as vendas já fechadas devem
                    deixar <Valor valor={vendasTotal} posto="fato" />.{' '}
                  </>
                )}
                {noVermelho.length === 0
                  ? 'Todos os meses ficam cobertos.'
                  : noVermelho.length <= 3
                    ? `${noVermelho.length === 1 ? 'Um mês fica' : `${noVermelho.length} meses ficam`} no vermelho: ${noVermelho.map((m) => mesCurto(m.mes)).join(', ')}.`
                    : `${noVermelho.length} de ${meses.length} meses ficam no vermelho, o primeiro em ${mesCurto(noVermelho[0].mes)}.`}
              </>
            }
          />

          <Cartao>
            <Cartao.Cabecalho
              titulo="Mês a mês"
              meta={`${teto ? 'Teto de gastos' : 'Custos'} × o que as vendas deixam. Toque num mês para ver a conta.`}
            />
            <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Orçamento mês a mês">
              {meses.map((m) => (
                <Linha
                  key={m.mes}
                  titulo={nomeDoMes(m.mes)}
                  meta={`${teto ? 'teto' : 'custos'} ${formatCurrency(custoDe(m))} · vendas deixam ${formatCurrency(m.apuracao.vendasDeixam)}`}
                  valor={<Valor valor={sobraDe(m)} posto="linha" estado={sobraDe(m) < 0 ? 'negativo' : undefined} />}
                  metaValor={sobraDe(m) < 0 ? 'falta' : 'sobra'}
                  aoClicar={() => abrirMes(m)}
                />
              ))}
            </Cartao.Lista>
          </Cartao>

          <Cartao>
            <Cartao.Cabecalho
              titulo="Seus gastos"
              meta={teto ? `Onde vai o teto de ${formatCurrency(teto)}. Toque num gasto para mudar.` : 'Toque num gasto para mudar ou apagar.'}
              extra={
                <div className="flex flex-wrap gap-2">
                  <Button variant="secundario" size="sm" onClick={() => setTetoAberto(true)}>
                    {teto ? 'Alterar teto' : 'Definir teto'}
                  </Button>
                  <Button variant="secundario" size="sm" onClick={() => setCadastroAberto(true)}>
                    Adicionar gasto
                  </Button>
                </div>
              }
            />
            <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Gastos do orçamento">
              {linhasOrdenadas.map((l) => (
                <Linha
                  key={l.id}
                  titulo={`${l.description}${l.status === 'possivel' ? ' · possível' : ''}`}
                  meta={`${mesCurto(l.start_month)} ${l.end_month ? `a ${mesCurto(l.end_month)}` : 'em diante'}`}
                  valor={<Valor valor={l.amount} posto="linha" />}
                  metaValor="por mês"
                  aoClicar={() => setEditando(l)}
                />
              ))}
            </Cartao.Lista>
            {teto && mesAtual && (
              <Cartao.Rodape>
                <span>
                  Em {nomeDoMes(mesAtual.mes)}, os gastos fixos somam <Valor valor={mesAtual.apuracao.orcado} posto="fato" /> do
                  teto de <Valor valor={teto} posto="fato" />:{' '}
                  {teto - mesAtual.apuracao.orcado >= 0 ? (
                    <>
                      <Valor valor={teto - mesAtual.apuracao.orcado} posto="fato" /> livres.
                    </>
                  ) : (
                    <>
                      passam em <Valor valor={mesAtual.apuracao.orcado - teto} posto="fato" />.
                    </>
                  )}
                </span>
              </Cartao.Rodape>
            )}
          </Cartao>
        </>
      )}

      <TetoDoOrcamento aberto={tetoAberto} aoFechar={() => setTetoAberto(false)} sugestao={maiorMesFixo} />

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
