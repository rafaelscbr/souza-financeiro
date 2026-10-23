import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useAdmin } from './AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format'
import { monthKey } from '@/lib/finance'
import { situacaoDoTeto } from '@/lib/orcamento'

/*
 * O TETO NO INÍCIO (22/10/2026). "Quanto ainda posso gastar este mês?" em três
 * linhas: o que já foi gasto, o que está reservado para os gastos fixos que
 * ainda não foram lançados e o que sobra livre. Sem teto definido, o cartão
 * não aparece.
 */
export function CartaoDoTeto() {
  const { company, orcamento, transactions, installments, mes } = useAdmin()
  const { abrir } = useComposicao()
  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const teto = company?.monthly_budget ?? null
  const s = useMemo(
    () => (teto ? situacaoDoTeto({ teto, linhas: orcamento, transactions, parcelas, mes: monthKey(mes) }) : null),
    [teto, orcamento, transactions, parcelas, mes],
  )
  if (!s) return null

  const nomeDoMes = formatMonthYear(mes)
  const abrirGasto = () =>
    abrir({
      rotulo: 'Já gasto',
      titulo: `Gasto da estrutura · ${nomeDoMes}`,
      explica: 'As despesas da imobiliária lançadas no mês, pagas ou ainda a pagar.',
      total: -s.gasto,
      itens: s.lancamentos.map((t) => ({
        id: t.id,
        titulo: t.description || t.category,
        meta: `${t.status === 'settled' ? 'pago' : 'vence'} em ${formatDate(t.settled_date ?? t.due_date ?? t.competence_date)} · ${t.category}`,
        valor: -t.amount,
      })),
      vazio: 'Nada lançado neste mês.',
    })
  const abrirReservado = () =>
    abrir({
      rotulo: 'Reservado',
      titulo: `Gastos fixos ainda não lançados · ${nomeDoMes}`,
      explica: 'O que está no orçamento e ainda não foi lançado no mês. Fica separado do teto para não ser gasto com outra coisa.',
      total: -s.reservado,
      itens: s.reservas
        .filter((r) => r.falta > 0)
        .map((r) => ({
          id: r.categoria,
          titulo: r.linhas.map((l) => l.description).join(', '),
          meta: `orçado ${formatCurrency(r.orcado)} · ${r.categoria}`,
          valor: -r.falta,
        })),
      vazio: 'Todos os gastos fixos do mês já foram lançados.',
    })

  return (
    <Cartao>
      <Cartao.Cabecalho titulo="Orçamento do mês" icone={Wallet} meta={`teto de ${formatCurrency(s.teto)}`} />
      <Cartao.Lista colunas={{ valor: '10rem', fim: true }} rotuloAcessivel="Orçamento do mês">
        <Linha
          titulo="Já gasto"
          meta={`${s.lancamentos.length} ${s.lancamentos.length === 1 ? 'despesa lançada' : 'despesas lançadas'}`}
          valor={<Valor valor={-s.gasto} posto="linha" />}
          aoClicar={abrirGasto}
        />
        <Linha
          titulo="Reservado"
          meta="gastos fixos que ainda vão ser lançados"
          valor={<Valor valor={-s.reservado} posto="linha" />}
          aoClicar={abrirReservado}
        />
        <Linha
          titulo={s.livre < 0 ? 'Passou do teto' : 'Livre para gastar'}
          meta={
            s.gasto > s.teto
              ? 'o gasto do mês já passou do teto'
              : s.livre < 0
                ? 'com os fixos que faltam lançar, o mês passa do teto'
                : 'o que sobra do teto neste mês'
          }
          valor={<Valor valor={s.livre} posto="linha" forte estado={s.livre < 0 ? 'negativo' : undefined} />}
          para="/relatorios/orcamento"
        />
      </Cartao.Lista>
      <Cartao.Rodape>
        <Link to="/relatorios/orcamento" className="text-texto-meta text-t2 underline-offset-4 hover:underline">
          Ver o orçamento completo
        </Link>
      </Cartao.Rodape>
    </Cartao>
  )
}
