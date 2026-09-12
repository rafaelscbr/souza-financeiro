import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Handshake } from 'lucide-react'
import { useCorretor, SITUACAO } from '../CorretorData'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { formatCurrency, formatDate, parseDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A tela que responde a única pergunta que o corretor faz: quanto eu tenho a
 * receber, e quando.
 *
 * O VGV e o número de vendas vêm depois, porque servem para ele se situar — o
 * dinheiro vem primeiro.
 */
export function CorretorInicio() {
  const { painel, ano } = useCorretor()

  if (!painel || (painel.sales_count === 0 && painel.commission_total === 0)) {
    return (
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Nada por aqui ainda"
        description="Suas vendas aparecem assim que a imobiliária registrar a primeira. Se você fechou uma venda e ela não está aqui, fale com a imobiliária."
      />
    )
  }

  const p = painel
  const recebidoPct = p.commission_total > 0 ? p.commission_received / p.commission_total : 0

  return (
    <div className="animate-fade-in space-y-4">
      {/* O número que importa */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <p className="text-[11px] font-medium uppercase tracking-wide text-content-faint">
          Sua comissão em {ano}
        </p>
        <p className="tnum mt-1 text-3xl font-bold text-content">{formatCurrency(p.commission_total)}</p>

        <div className="mt-4">
          <Progress value={recebidoPct} color="#059669" />
          <div className="mt-1 flex justify-between text-[11px] text-content-faint">
            <span>recebido {formatCurrency(p.commission_received)}</span>
            <span>{Math.round(recebidoPct * 100)}%</span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">Recebida</dt>
            <dd className="tnum text-sm font-bold text-income">{formatCurrency(p.commission_received)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">A receber</dt>
            <dd className={cn('tnum text-sm font-bold', p.commission_released > 0 ? 'text-pending' : 'text-content-muted')}>
              {formatCurrency(p.commission_released)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">Prevista</dt>
            <dd className="tnum text-sm font-bold text-content-muted">{formatCurrency(p.commission_expected)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-content-muted">
          <strong className="text-content">A receber</strong> é o que a imobiliária já recebeu e vai
          te pagar. <strong className="text-content">Prevista</strong> depende da construtora pagar
          primeiro.
        </p>
      </section>

      {p.overdue_count > 0 && (
        <section className="rounded-2xl border border-pending/30 bg-pending/8 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-pending" />
            <div>
              <p className="text-sm font-semibold text-content">
                {formatCurrency(p.overdue_amount)} liberado há mais tempo que o previsto
              </p>
              <p className="text-xs text-content-muted">
                {p.overdue_count} parcela{p.overdue_count > 1 ? 's' : ''} que a imobiliária já recebeu.
                Vale um lembrete.
              </p>
            </div>
          </div>
        </section>
      )}

      {p.next && (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wide text-content-faint">
            Próximo recebimento
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-content">{p.next.sale_title}</p>
            <p className="tnum shrink-0 text-lg font-bold text-content">{formatCurrency(p.next.amount)}</p>
          </div>
          <p className="mt-0.5 text-xs text-content-muted">
            {p.next.count > 1 ? `parcela ${p.next.idx}/${p.next.count} · ` : ''}
            {formatDate(p.next.date)} · {SITUACAO[p.next.status]?.rotulo ?? p.next.status}
          </p>
          <p className="mt-1 text-xs text-content-faint">{SITUACAO[p.next.status]?.explica}</p>
        </section>
      )}

      {p.by_month.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-content">Por mês em {ano}</h2>
          <ul className="space-y-2">
            {p.by_month.map((m) => {
              const pct = p.commission_total > 0 ? m.amount / p.commission_total : 0
              return (
                <li key={m.month}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-content-muted">
                      {parseDateOnly(`${m.month}-01`).toLocaleDateString('pt-BR', {
                        month: 'long',
                      })}
                    </span>
                    <span className="tnum font-semibold text-content">{formatCurrency(m.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-brandblue"
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-content">Sua produção em {ano}</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">Vendas</dt>
            <dd className="tnum text-lg font-bold text-content">{p.sales_count}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">VGV vendido</dt>
            <dd className="tnum text-lg font-bold text-content">{formatCurrency(p.vgv)}</dd>
            {p.sales_without_vgv > 0 && (
              <dd className="text-[11px] text-content-faint">
                {p.sales_without_vgv} venda{p.sales_without_vgv > 1 ? 's' : ''} sem valor informado
              </dd>
            )}
          </div>
        </dl>
      </section>

      <Link
        to="/recebimentos"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 text-sm font-medium text-content shadow-card transition-colors hover:border-brandblue/40"
      >
        Ver o cronograma completo
        <ArrowRight className="h-4 w-4 text-content-faint" />
      </Link>
    </div>
  )
}
