import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { FiltrosDePeriodo } from '../RelatorioPecas'
import { CATEGORIA_GESTAO, periodosDoDre, type TipoPeriodo } from '@/lib/dre'
import { repassesPorPessoa, totaisDosRepasses, type RepassesDaPessoa } from '@/lib/repasses'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Transaction } from '@/types'

/*
 * COMISSÕES E REPASSES (Fase 5, 23/10/2026).
 *
 * Quanto a imobiliária repassou no período, a cada corretor e ao gestor de
 * equipe, e quanto ainda deve a cada um hoje — liberado (a parcela entrou) e
 * previsto (depende da construtora). Os números vêm de `repassesPorPessoa`
 * (lib/repasses.ts), que lê o razão: a soma das pessoas é a soma dos
 * lançamentos, por construção. Todo valor abre nos lançamentos.
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

  return (
    <PageLayout
      subtitulo="O que a imobiliária repassou a cada corretor e ao gestor, e o que ainda deve a cada um."
      faixa={<FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />}
    >
      <Heroi
        variante="ouro"
        rotulo={`Repassado · ${periodo.rotulo}`}
        valor={total.pago}
        rotuloAcessivel={`Ver os repasses de ${periodo.rotulo}`}
        aoAbrir={() => abrirPago(pessoas, 'Todos')}
        frase={
          total.pagoGestao > 0
            ? `${formatCurrency(total.pagoComissao)} de comissão de corretor e ${formatCurrency(total.pagoGestao)} de gestão de equipe, pela data do pagamento.`
            : 'Comissão de corretor que saiu da conta da imobiliária no período, pela data do pagamento.'
        }
        apoios={[
          {
            rotulo: 'Liberado, a repassar',
            valor: total.liberado,
            rotuloAcessivel: 'Ver o que está liberado esperando repasse',
            aoAbrir: () => abrirLiberado(pessoas, 'Todos'),
          },
          {
            rotulo: 'Previsto',
            valor: total.previsto,
            rotuloAcessivel: 'Ver o que está previsto',
            aoAbrir: () => abrirPrevisto(pessoas, 'Todos'),
          },
        ].filter((a) => a.valor !== 0)}
      />

      <Cartao>
        <Cartao.Cabecalho
          titulo="Por pessoa"
          icone={Users}
          meta="Repassado no período; liberado e previsto são de hoje. Toque para ver os lançamentos."
        />
        {pessoas.length === 0 ? (
          <Cartao.Corpo>
            <p className="text-texto-corrido text-t3">Nenhum repasse no período e nada a repassar.</p>
          </Cartao.Corpo>
        ) : (
          <Cartao.Lista colunas={{ valor: '10rem', fim: true }} rotuloAcessivel="Repasses por pessoa">
            {pessoas.map((l) => (
              <Linha
                key={l.contactId ?? 'sem-pessoa'}
                titulo={l.nome}
                meta={[
                  l.pagoGestao > 0 ? `comissão ${formatCurrency(l.pagoComissao)} · gestão ${formatCurrency(l.pagoGestao)}` : null,
                  l.liberado > 0 ? `liberado ${formatCurrency(l.liberado)}` : null,
                  l.previsto > 0 ? `previsto ${formatCurrency(l.previsto)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'nada a repassar'}
                valor={<Valor valor={l.pago} posto="linha" />}
                metaValor="repassado"
                aoClicar={() =>
                  l.pago > 0
                    ? abrirPago([l], l.nome)
                    : l.liberado > 0
                      ? abrirLiberado([l], l.nome)
                      : abrirPrevisto([l], l.nome)
                }
              />
            ))}
          </Cartao.Lista>
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
