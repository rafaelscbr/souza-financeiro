import { useMemo, useState } from 'react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Tabela } from '@/components/ui/Tabela'
import { Valor } from '@/components/ui/Valor'
import { ExportarRelatorio, FiltrosDePeriodo } from '../RelatorioPecas'
import { CATEGORIA_GESTAO, periodosDoDre, type TipoPeriodo } from '@/lib/dre'
import { repassesPorPessoa, totaisDosRepasses, type RepassesDaPessoa } from '@/lib/repasses'
import { formatDate } from '@/lib/format'
import type { Transaction } from '@/types'

/*
 * COMISSÕES E REPASSES (Fase 5, 23/10/2026).
 *
 * Quanto a imobiliária repassou no período, a cada corretor e ao gestor de
 * equipe, e quanto ainda deve a cada um hoje — liberado (a parcela entrou) e
 * previsto (depende da construtora). Os números vêm de `repassesPorPessoa`
 * (lib/repasses.ts), que lê o razão: a soma das pessoas é a soma dos
 * lançamentos, por construção. Todo valor abre nos lançamentos.
 *
 * Souza 3.0 (02/11/2026): o repassado é o número líder; as pessoas viram uma
 * tabela (comissão, gestão, repassado, liberado e previsto lado a lado, com o
 * total), e cada linha abre os lançamentos dela.
 */
export function RelatorioComissoes() {
  const { transactions, vendas, contacts, installments, mes } = useAdmin()
  const { abrir } = useComposicao()
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')

  const periodo = useMemo(() => periodosDoDre(mes, tipo).atual, [mes, tipo])
  const pessoas = useMemo(
    () => repassesPorPessoa({ transactions, vendas, contacts, installments, periodo }),
    [transactions, vendas, contacts, installments, periodo],
  )
  const total = useMemo(() => totaisDosRepasses(pessoas), [pessoas])

  const itens = (txs: Transaction[], quando: (t: Transaction) => string) =>
    [...txs]
      .sort((a, b) => quando(a).localeCompare(quando(b)))
      .map((t) => ({
        id: t.id,
        titulo: t.description || t.category,
        meta: `${t.category === CATEGORIA_GESTAO ? 'gestão' : 'comissão'} · ${formatDate(quando(t))}`,
        valor: t.amount,
        para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
      }))
  const pagoEm = (t: Transaction) => t.settled_date ?? t.competence_date
  const previstoPara = (t: Transaction) => t.due_date ?? t.competence_date

  const abrirPago = (lista: RepassesDaPessoa[], nome: string) =>
    abrir({
      rotulo: 'Repassado',
      titulo: `${nome} · ${periodo.rotulo}`,
      explica: 'Comissão e gestão que saíram da conta da imobiliária no período, pela data do pagamento.',
      total: Math.round(lista.reduce((s, l) => s + l.pago, 0) * 100) / 100,
      itens: itens(lista.flatMap((l) => l.lancamentosPagos), pagoEm),
      vazio: 'Nada repassado neste período.',
    })
  const abrirLiberado = (lista: RepassesDaPessoa[], nome: string) =>
    abrir({
      rotulo: 'Liberado',
      titulo: `${nome} · liberado hoje`,
      explica: 'A imobiliária já recebeu a parcela e ainda não repassou. É dívida de hoje — pague em Pagar.',
      total: Math.round(lista.reduce((s, l) => s + l.liberado, 0) * 100) / 100,
      itens: itens(lista.flatMap((l) => l.lancamentosLiberados), previstoPara),
      vazio: 'Nada liberado esperando repasse.',
    })
  const abrirPrevisto = (lista: RepassesDaPessoa[], nome: string) =>
    abrir({
      rotulo: 'Previsto',
      titulo: `${nome} · previsto`,
      explica: 'Só vira dívida quando a construtora pagar a parcela. A data é a prevista para a parcela.',
      total: Math.round(lista.reduce((s, l) => s + l.previsto, 0) * 100) / 100,
      itens: itens(lista.flatMap((l) => l.lancamentosPrevistos), previstoPara),
      vazio: 'Nada previsto.',
    })

  const fraseDoTitulo = (
    <>
      <b>
        <Valor valor={total.pago} posto="fato" tinta="text-t1" /> repassados
      </b>{' '}
      em {periodo.rotulo}
      {total.liberado > 0 && (
        <>
          {' · '}
          <Valor valor={total.liberado} posto="fato" tinta="text-t1" /> liberados esperando repasse
        </>
      )}
    </>
  )

  return (
    <PageLayout
      subtitulo={fraseDoTitulo}
      faixa={<FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />}
      acoes={
        <ExportarRelatorio
          nome={`Comissoes e repasses ${periodo.rotulo}`}
          planilha={() => ({
            cabecalho: ['Pessoa', `Comissão paga · ${periodo.rotulo}`, 'Gestão paga', 'Total repassado', 'Liberado hoje', 'Previsto hoje'],
            linhas: [
              ...pessoas.map((l) => [l.nome, l.pagoComissao, l.pagoGestao, l.pago, l.liberado, l.previsto]),
              ['Total', total.pagoComissao, total.pagoGestao, total.pago, total.liberado, total.previsto],
            ],
          })}
        />
      }
    >
      <FaixaDeMetricas
        rotuloAcessivel={`Repasses de ${periodo.rotulo}`}
        metricas={[
          {
            rotulo: `Repassado · ${periodo.rotulo}`,
            valor: total.pago,
            lider: true,
            nota:
              total.pagoGestao > 0 ? (
                <>
                  comissão <Valor valor={total.pagoComissao} posto="fato" /> · gestão <Valor valor={total.pagoGestao} posto="fato" />
                </>
              ) : (
                'pela data do pagamento'
              ),
            aoClicar: total.pago !== 0 ? () => abrirPago(pessoas, 'Todos') : undefined,
          },
          {
            rotulo: 'Liberado, a repassar',
            valor: total.liberado,
            nota: 'a parcela já entrou; é dívida de hoje',
            aoClicar: total.liberado !== 0 ? () => abrirLiberado(pessoas, 'Todos') : undefined,
          },
          {
            rotulo: 'Previsto',
            valor: total.previsto,
            nota: 'depende de a construtora pagar',
            aoClicar: total.previsto !== 0 ? () => abrirPrevisto(pessoas, 'Todos') : undefined,
          },
        ]}
      />

      <Cartao>
        <Cartao.Cabecalho titulo="Por pessoa" meta="repassado no período; liberado e previsto são de hoje" />
        {pessoas.length === 0 ? (
          <Cartao.Corpo>
            <p className="text-texto-corrido text-t3">Nenhum repasse no período e nada a repassar.</p>
          </Cartao.Corpo>
        ) : (
          <Tabela
            rotuloAcessivel={`Repasses por pessoa · ${periodo.rotulo}`}
            linhas={pessoas}
            chave={(l) => l.contactId ?? 'sem-pessoa'}
            aoAbrirLinha={(l) =>
              l.pago > 0 ? abrirPago([l], l.nome) : l.liberado > 0 ? abrirLiberado([l], l.nome) : abrirPrevisto([l], l.nome)
            }
            rotuloAbrir={(l) => `Ver os lançamentos de ${l.nome}`}
            colunas={[
              { id: 'pessoa', rotulo: 'Pessoa', celula: (l) => <span className="font-medium">{l.nome}</span>, total: 'Total' },
              {
                id: 'comissao',
                rotulo: 'Comissão',
                numerica: true,
                // Sem gestão no período, comissão e repassado são o mesmo número: a coluna some.
                celula: (l) => (total.pagoGestao > 0 ? <Valor valor={l.pagoComissao} posto="fato" /> : null),
                total: total.pagoGestao > 0 ? <Valor valor={total.pagoComissao} posto="fato" forte /> : undefined,
              },
              {
                id: 'gestao',
                rotulo: 'Gestão',
                numerica: true,
                celula: (l) => (total.pagoGestao > 0 ? <Valor valor={l.pagoGestao} posto="fato" /> : null),
                total: total.pagoGestao > 0 ? <Valor valor={total.pagoGestao} posto="fato" forte /> : undefined,
              },
              {
                id: 'repassado',
                rotulo: 'Repassado',
                numerica: true,
                celula: (l) => <Valor valor={l.pago} posto="linha" />,
                total: <Valor valor={total.pago} posto="destaque" />,
              },
              {
                id: 'liberado',
                rotulo: 'Liberado',
                numerica: true,
                celula: (l) => <Valor valor={l.liberado} posto="fato" />,
                total: <Valor valor={total.liberado} posto="fato" forte />,
              },
              {
                id: 'previsto',
                rotulo: 'Previsto',
                numerica: true,
                celula: (l) => <Valor valor={l.previsto} posto="fato" previsto />,
                total: <Valor valor={total.previsto} posto="fato" previsto />,
              },
            ]}
          />
        )}
        <Cartao.Rodape>
          <p className="max-w-[72ch]">
            Comissão de corretor e gestão de equipe são custo da venda: no DRE entram juntas, em "Comissões de
            corretores", com a gestão em linha própria.
          </p>
        </Cartao.Rodape>
      </Cartao>
    </PageLayout>
  )
}
