import { useMemo } from 'react'
import { Wallet } from 'lucide-react'
import { useAdmin } from './AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { formatCurrency, formatMonthYear } from '@/lib/format'
import { folegoDoCaixa, previsaoDeCaixa } from '@/lib/painel'
import { accountBalance } from '@/lib/treasury'
import { situacaoDeTela } from '@/lib/situacao'
import type { MoneyItem } from '@/lib/sales'

/*
 * PREVISÃO DE CAIXA (Fase 3 e 4, 23/10/2026): o saldo de hoje andando seis
 * meses. O mesmo cartão no Início e no Fluxo de caixa — um desenho só, uma
 * conta só (lib/painel.ts). Sempre a partir do mês de hoje, não do mês da
 * tela: previsão começa no presente.
 */
export function CartaoPrevisaoDeCaixa({ className }: { className?: string }) {
  const { company, orcamento, accounts, transactions, transfers, installments, receber, pagar, hoje } = useAdmin()
  const { abrir } = useComposicao()

  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const saldo = useMemo(
    () =>
      Math.round(
        accounts
          .filter((a) => a.is_active && a.type !== 'credit_card')
          .reduce((s, a) => s + accountBalance(a, transactions, transfers, hoje).balance, 0) * 100,
      ) / 100,
    [accounts, transactions, transfers, hoje],
  )
  const teto = company?.monthly_budget ?? null
  const inicio = useMemo(() => {
    const h = new Date(`${hoje}T12:00:00`)
    return new Date(h.getFullYear(), h.getMonth(), 1)
  }, [hoje])
  const previsao = useMemo(
    () => previsaoDeCaixa({ saldo, receber, pagar, orcamento, teto, transactions, parcelas, inicio }),
    [saldo, receber, pagar, orcamento, teto, transactions, parcelas, inicio],
  )
  const folego = folegoDoCaixa(saldo, teto)
  const menorSaldo = previsao.reduce((m, p) => Math.min(m, p.saldoFim), saldo)

  const comp = (l: MoneyItem[]) =>
    l.map((i) => ({
      id: i.tx.id,
      titulo: i.label,
      meta: i.sale?.development ?? i.tx.category,
      valor: i.amount,
      situacao: i.installment
        ? situacaoDeTela(i.installment.status, i.installment.expected_date, hoje)
        : i.overdue
          ? ('vencida' as const)
          : ('prevista' as const),
      idx: i.installment?.idx,
      count: i.installment?.count,
      para: i.sale ? `/vendas/${i.sale.id}` : undefined,
    }))

  return (
    <Cartao className={className}>
      <Cartao.Cabecalho
        titulo="Previsão de caixa"
        icone={Wallet}
        meta={
          folego == null
            ? 'os próximos 6 meses'
            : `o caixa de hoje paga ${folego.toLocaleString('pt-BR')} ${folego === 1 ? 'mês' : 'meses'} de estrutura sem venda nova`
        }
      />
      <Cartao.Lista colunas={{ valor: '10rem', fim: true }} rotuloAcessivel="Previsão de caixa mês a mês">
        {previsao.map((p, k) => {
          const nome = formatMonthYear(new Date(`${p.mes}-01T12:00:00`))
          return (
            <Linha
              key={p.mes}
              titulo={k === 0 ? `${nome} · até o fim do mês` : nome}
              meta={`entra ${formatCurrency(p.entra)} · sai ${formatCurrency(p.sai)}`}
              valor={
                p.saldoFim < 0 ? (
                  <Valor valor={p.saldoFim} posto="linha" estado="negativo" />
                ) : (
                  <Valor valor={p.saldoFim} posto="linha" previsto />
                )
              }
              aoClicar={() =>
                abrir({
                  rotulo: 'Entra menos sai',
                  titulo: `O caixa em ${nome}`,
                  explica: `O que deve entrar e sair no mês: parcelas a receber, contas e comissões a pagar e o custo do orçamento que ainda não foi lançado. Com isso, o saldo termina o mês em ${formatCurrency(p.saldoFim)}. A data das parcelas depende da construtora — é previsão.`,
                  total: Math.round((p.entra - p.sai) * 100) / 100,
                  itens: [
                    ...comp(p.entradas),
                    ...comp(p.saidas).map((i) => ({ ...i, valor: -i.valor })),
                    ...(p.reservado > 0
                      ? [{ id: `reservado-${p.mes}`, titulo: 'Orçamento ainda não lançado', meta: 'gastos fixos confirmados', valor: -p.reservado }]
                      : []),
                  ],
                  nota: k === 0 ? 'O primeiro mês inclui o que está em atraso, a receber e a pagar.' : undefined,
                  vazio: 'Nada previsto para este mês.',
                })
              }
            />
          )
        })}
      </Cartao.Lista>
      <Cartao.Rodape>
        <p className="max-w-[72ch]">
          {menorSaldo < 0
            ? 'Em algum mês o caixa fica negativo: antecipe recebimento ou segure gasto antes de chegar lá.'
            : 'Saldo de hoje mais o que entra, menos o que sai, mês a mês. Retirada do sócio fica de fora.'}
        </p>
      </Cartao.Rodape>
    </Cartao>
  )
}
