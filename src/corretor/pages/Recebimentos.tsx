import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock } from 'lucide-react'
import { useCorretor, SITUACAO } from '../CorretorData'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { formatCurrency, formatDate, parseDateOnly, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CorretorParcela } from '../CorretorData'

type Filtro = 'todos' | 'aReceber' | 'recebidos'

/**
 * O cronograma: cada recebimento, de qual venda vem e em que situação está.
 *
 * Os atrasados vêm primeiro, e "atrasado" aqui tem significado preciso: a
 * imobiliária já recebeu a parcela e a comissão ainda não foi paga. Parcela
 * que a construtora não pagou não é atraso do corretor — é espera.
 */
export function Recebimentos() {
  const { parcelas } = useCorretor()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const hoje = toDateOnly(new Date())

  const lista = useMemo(
    () =>
      parcelas.filter((p) => {
        if (filtro === 'aReceber') return p.status === 'liberada' || p.status === 'prevista'
        if (filtro === 'recebidos') return p.status === 'recebida'
        return true
      }),
    [parcelas, filtro],
  )

  const atrasados = lista.filter((p) => p.status === 'liberada' && p.expected_date < hoje)
  const resto = lista.filter((p) => !atrasados.includes(p))

  const porMes = useMemo(() => {
    const m = new Map<string, CorretorParcela[]>()
    for (const p of resto) {
      const chave = (p.status === 'recebida' ? p.paid_date ?? p.expected_date : p.expected_date).slice(0, 7)
      const a = m.get(chave)
      if (a) a.push(p)
      else m.set(chave, [p])
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [resto])

  const total = Math.round(lista.reduce((s, p) => s + p.broker_amount - p.broker_adjustment, 0) * 100) / 100

  if (parcelas.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        title="Nenhum recebimento ainda"
        description="Quando a imobiliária registrar uma venda sua, o cronograma aparece aqui."
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-bold text-content">Recebimentos</h1>
        <p className="text-sm text-content-faint">
          {lista.length} parcela{lista.length === 1 ? '' : 's'} · {formatCurrency(total)}
        </p>
      </div>

      <Segmented
        ariaLabel="Filtro"
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'aReceber', label: 'A receber' },
          { value: 'recebidos', label: 'Recebidos' },
        ]}
      />

      {atrasados.length > 0 && (
        <section>
          <h2 className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-pending">
            <AlertTriangle className="h-3.5 w-3.5" />
            Liberado e ainda não pago
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-pending/30 bg-surface shadow-card">
            {atrasados.map((p) => (
              <Item key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}

      {porMes.map(([mes, itens]) => (
        <section key={mes}>
          <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-content-faint">
            {parseDateOnly(`${mes}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {itens.map((p) => (
              <Item key={p.id} p={p} />
            ))}
          </ul>
        </section>
      ))}

      {lista.length === 0 && (
        <EmptyState
          title="Nada com esse filtro"
          description={filtro === 'recebidos' ? 'Você ainda não recebeu nenhuma comissão.' : 'Nada a receber agora.'}
        />
      )}
    </div>
  )
}

function Item({ p }: { p: CorretorParcela }) {
  const s = SITUACAO[p.status]
  const liquido = Math.round((p.broker_amount - p.broker_adjustment) * 100) / 100

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link to={`/minhas-vendas/${p.sale_id}`} className="truncate text-sm font-medium text-content hover:underline">
            {p.sale_title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-content-faint">
            {p.count > 1 && <span>parcela {p.idx}/{p.count}</span>}
            <span className="inline-flex items-center gap-1">
              {p.status === 'recebida' ? (
                <CheckCircle2 className="h-3 w-3 text-income" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {p.status === 'recebida' && p.paid_date
                ? `paga em ${formatDate(p.paid_date)}`
                : formatDate(p.expected_date)}
            </span>
            <span className={cn('font-semibold', s.cor)}>{s.rotulo}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-content-faint">
            {p.installment_amount > 0 && (
              <>
                base {formatCurrency(p.installment_amount - p.iss_amount - p.simples_amount)}
                {p.broker_pct != null ? ` × ${p.broker_pct}%` : ''}
              </>
            )}
          </p>
        </div>
        <span className="tnum shrink-0 text-sm font-bold text-content">{formatCurrency(liquido)}</span>
      </div>
    </li>
  )
}
