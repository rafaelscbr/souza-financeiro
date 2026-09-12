import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpCircle, Clock } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { BaixarLancamento } from '../BaixarLancamento'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'
import type { MoneyItem } from '@/lib/sales'

/**
 * O que sai, com as comissões liberadas em primeiro lugar.
 *
 * A ordem da tela é a ordem da obrigação: comissão que já venceu porque a
 * imobiliária recebeu vem antes de imposto, e imposto antes de despesa. A
 * comissão ainda prevista aparece separada, porque não é dívida hoje — o
 * corretor só recebe quando a venda receber.
 */
export function Pagar() {
  const { pagar } = useAdmin()
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

  const totalDevido = Math.round(
    [...grupos.liberadas, ...grupos.impostos, ...grupos.despesas].reduce((s, i) => s + i.amount, 0) * 100,
  ) / 100

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
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-bold text-content">A pagar</h1>
        <p className="text-sm text-content-faint">
          {formatCurrency(totalDevido)} devido agora
          {grupos.previstas.length > 0 ? ` · ${grupos.previstas.length} comissão(ões) ainda prevista(s)` : ''}
        </p>
      </div>

      {porCorretor.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-pending/30 bg-surface shadow-card">
          <div className="flex items-center justify-between bg-pending/8 px-5 py-3">
            <h2 className="text-sm font-semibold text-content">Comissões liberadas</h2>
            <span className="text-xs text-content-muted">a imobiliária já recebeu essas parcelas</span>
          </div>
          {porCorretor.map(([nome, itens]) => {
            const total = Math.round(itens.reduce((s, i) => s + i.amount, 0) * 100) / 100
            return (
              <div key={nome} className="border-t border-line px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-content">{nome}</p>
                    <p className="text-xs text-content-faint">
                      {itens.length} parcela{itens.length > 1 ? 's' : ''} liberada
                      {itens.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-base font-bold text-content">{formatCurrency(total)}</span>
                    <Button size="sm" onClick={() => setComissoes(paraPagamento(itens))}>
                      Pagar {itens.length > 1 ? 'tudo' : ''}
                    </Button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {itens.map((i) => (
                    <li key={i.tx.id} className="flex items-baseline justify-between gap-3 text-xs">
                      <Link
                        to={i.sale ? `/vendas/${i.sale.id}` : '/pagar'}
                        className="truncate text-content-muted hover:underline"
                      >
                        {i.label}
                      </Link>
                      <span className="tnum shrink-0 text-content-muted">{formatCurrency(i.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      )}

      {grupos.impostos.length > 0 && (
        <Grupo
          titulo="Imposto"
          subtitulo="guia do Simples e ISS"
          itens={grupos.impostos}
          onPagar={setAvulso}
        />
      )}

      {grupos.despesas.length > 0 && (
        <Grupo titulo="Despesas" subtitulo="estrutura e retiradas" itens={grupos.despesas} onPagar={setAvulso} />
      )}

      {grupos.previstas.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="px-5 py-3">
            <h2 className="text-sm font-semibold text-content">Comissões ainda previstas</h2>
            <p className="text-xs text-content-faint">
              O corretor recebe quando a imobiliária receber. Não é dívida hoje.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {grupos.previstas.map((i) => (
              <li key={i.tx.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-content-faint" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={i.sale ? `/vendas/${i.sale.id}` : '/pagar'}
                    className="truncate text-sm text-content-muted hover:underline"
                  >
                    {i.label}
                  </Link>
                  <p className="text-xs text-content-faint">
                    {i.sale?.brokerName ?? 'corretor'} · previsto {formatDate(i.date)}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm text-content-muted">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PagarComissao itens={comissoes} onFechar={() => setComissoes(null)} />
      <BaixarLancamento tx={avulso} onFechar={() => setAvulso(null)} />
    </div>
  )
}

function Grupo({
  titulo,
  subtitulo,
  itens,
  onPagar,
}: {
  titulo: string
  subtitulo: string
  itens: MoneyItem[]
  onPagar: (t: Transaction) => void
}) {
  const total = Math.round(itens.reduce((s, i) => s + i.amount, 0) * 100) / 100
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-content">{titulo}</h2>
          <p className="text-xs text-content-faint">{subtitulo}</p>
        </div>
        <span className="tnum text-sm font-bold text-content">{formatCurrency(total)}</span>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {itens.map((i) => (
          <li key={i.tx.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm text-content">{i.tx.description || i.tx.category}</span>
                {i.overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-critical/12 px-1.5 py-0.5 text-[10px] font-semibold text-critical">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    vencido
                  </span>
                )}
              </div>
              <p className="text-xs text-content-faint">{formatDate(i.date)}</p>
            </div>
            <span className={cn('tnum shrink-0 text-sm font-semibold', i.overdue ? 'text-critical' : 'text-content')}>
              {formatCurrency(i.amount)}
            </span>
            <Button variant="secondary" size="sm" onClick={() => onPagar(i.tx)}>
              Paguei
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
