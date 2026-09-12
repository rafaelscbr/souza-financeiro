import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronRight, Handshake, User } from 'lucide-react'
import { useCorretor, SITUACAO } from '../CorretorData'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** As vendas do corretor. */
export function MinhasVendas() {
  const { vendas } = useCorretor()

  if (vendas.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Nenhuma venda registrada"
        description="Assim que a imobiliária registrar uma venda sua, ela aparece aqui com o cronograma da comissão."
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-3">
      <h1 className="text-xl font-bold text-content">Minhas vendas</h1>
      <ul className="space-y-3">
        {vendas.map((v) => {
          const pct = v.commission_total > 0 ? v.commission_received / v.commission_total : 0
          return (
            <li key={v.id}>
              <Link
                to={`/minhas-vendas/${v.id}`}
                className="block rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brandblue/40"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-bold text-content">{v.title}</h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-content-faint">
                      {v.client_name && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {v.client_name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(v.sale_date)}
                      </span>
                      {v.broker_pct != null && <span>{v.broker_pct}% seu</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] uppercase tracking-wide text-content-faint">Sua comissão</p>
                    <p className="tnum text-base font-bold text-content">{formatCurrency(v.commission_total)}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-content-faint" />
                </div>

                <div className="mt-3">
                  <Progress value={pct} color="#059669" />
                  <div className="mt-1 flex flex-wrap justify-between gap-2 text-[11px]">
                    <span className="text-content-faint">recebido {formatCurrency(v.commission_received)}</span>
                    {v.commission_released > 0 && (
                      <span className="font-semibold text-pending">
                        a receber {formatCurrency(v.commission_released)}
                      </span>
                    )}
                    {v.commission_expected > 0 && (
                      <span className="text-content-faint">
                        previsto {formatCurrency(v.commission_expected)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** A ficha de uma venda, com o cronograma e a conta aberta. */
export function MinhaVenda() {
  const { id } = useParams<{ id: string }>()
  const { vendas, parcelas } = useCorretor()

  const venda = vendas.find((v) => v.id === id)
  const minhas = parcelas.filter((p) => p.sale_id === id).sort((a, b) => a.idx - b.idx)

  if (!venda) {
    return (
      <EmptyState
        title="Venda não encontrada"
        description="Ela pode não ser sua ou ter sido cancelada."
        action={
          <Link to="/minhas-vendas">
            <Button variant="secondary">Voltar</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      <Link
        to="/minhas-vendas"
        className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-content"
      >
        <ArrowLeft className="h-4 w-4" />
        Minhas vendas
      </Link>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h1 className="text-lg font-bold text-content">{venda.title}</h1>
        <p className="mt-1 text-sm text-content-muted">
          {[venda.client_name, venda.development, `vendida em ${formatDate(venda.sale_date)}`]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">Valor da venda</dt>
            <dd className="tnum text-sm font-bold text-content">
              {venda.property_value != null ? formatCurrency(venda.property_value) : 'não informado'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">Sua comissão</dt>
            <dd className="tnum text-sm font-bold text-content">{formatCurrency(venda.commission_total)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">Recebida</dt>
            <dd className="tnum text-sm font-bold text-income">{formatCurrency(venda.commission_received)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-content-faint">A receber</dt>
            <dd className="tnum text-sm font-bold text-pending">
              {formatCurrency(venda.commission_released + venda.commission_expected)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <h2 className="px-5 pb-2 pt-4 text-sm font-semibold text-content">Cronograma</h2>
        <ul className="divide-y divide-line">
          {minhas.map((p) => {
            const s = SITUACAO[p.status]
            const liquido = Math.round((p.broker_amount - p.broker_adjustment) * 100) / 100
            return (
              <li key={p.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    {p.count > 1 && (
                      <span className="tnum text-xs font-semibold text-content-faint">
                        {p.idx}/{p.count}
                      </span>
                    )}
                    <span className="text-sm font-medium text-content">
                      {p.status === 'recebida' && p.paid_date
                        ? `paga em ${formatDate(p.paid_date)}`
                        : formatDate(p.expected_date)}
                    </span>
                    <span className={cn('text-xs font-semibold', s.cor)}>{s.rotulo}</span>
                  </div>
                  <span className="tnum text-sm font-bold text-content">{formatCurrency(liquido)}</span>
                </div>

                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] text-content-faint hover:text-content-muted">
                    Como é calculado
                  </summary>
                  <div className="mt-1.5 space-y-0.5 rounded-xl bg-surface-2/60 px-3 py-2 text-[11px] text-content-muted">
                    <p className="flex justify-between">
                      <span>Parcela da imobiliária</span>
                      <span className="tnum">{formatCurrency(p.installment_amount)}</span>
                    </p>
                    {p.iss_amount > 0 && (
                      <p className="flex justify-between">
                        <span>(−) ISS retido na fonte</span>
                        <span className="tnum">{formatCurrency(p.iss_amount)}</span>
                      </p>
                    )}
                    {p.simples_amount > 0 && (
                      <p className="flex justify-between">
                        <span>(−) Imposto (Simples)</span>
                        <span className="tnum">{formatCurrency(p.simples_amount)}</span>
                      </p>
                    )}
                    <p className="flex justify-between border-t border-line pt-0.5">
                      <span>Base × {p.broker_pct ?? 0}%</span>
                      <span className="tnum font-semibold text-content">{formatCurrency(p.broker_amount)}</span>
                    </p>
                    {p.broker_adjustment > 0 && (
                      <p className="flex justify-between">
                        <span>(−) Desconto combinado</span>
                        <span className="tnum">{formatCurrency(p.broker_adjustment)}</span>
                      </p>
                    )}
                    <p className="pt-1 text-content-faint">{s.explica}</p>
                    {p.notes && <p className="text-content-faint">{p.notes}</p>}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
