import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDownCircle } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { ReceberParcela } from '../ReceberParcela'
import { BaixarLancamento } from '../BaixarLancamento'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { formatCurrency, formatDate, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SaleInstallment, Transaction } from '@/types'
import type { SaleView } from '@/lib/sales'

type Janela = 'mes' | 'trinta' | 'vencidas' | 'tudo'

/** O que ainda entra, por data de vencimento. */
export function Receber() {
  const { receber, mes } = useAdmin()
  const [janela, setJanela] = useState<Janela>('mes')
  const [parcela, setParcela] = useState<{ venda: SaleView; p: SaleInstallment } | null>(null)
  const [avulso, setAvulso] = useState<Transaction | null>(null)

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
  const limite30 = toDateOnly(new Date(Date.now() + 30 * 86400000))

  const lista = useMemo(
    () =>
      receber.filter((i) => {
        if (janela === 'mes') return i.date.slice(0, 7) === chaveMes || i.overdue
        if (janela === 'trinta') return i.date <= limite30
        if (janela === 'vencidas') return i.overdue
        return true
      }),
    [receber, janela, chaveMes, limite30],
  )

  const total = Math.round(lista.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const vencidas = receber.filter((i) => i.overdue)

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-bold text-content">A receber</h1>
        <p className="text-sm text-content-faint">
          {receber.length} em aberto
          {vencidas.length > 0 ? ` · ${vencidas.length} vencida${vencidas.length > 1 ? 's' : ''}` : ''}
        </p>
      </div>

      <Segmented
        ariaLabel="Período"
        value={janela}
        onChange={setJanela}
        options={[
          { value: 'mes', label: 'Este mês' },
          { value: 'trinta', label: '30 dias' },
          { value: 'vencidas', label: 'Vencidas' },
          { value: 'tudo', label: 'Tudo' },
        ]}
      />

      <div className="flex items-baseline justify-between rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
        <span className="text-sm text-content-muted">
          {lista.length} lançamento{lista.length === 1 ? '' : 's'}
        </span>
        <span className="tnum text-xl font-bold text-income">{formatCurrency(total)}</span>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<ArrowDownCircle className="h-8 w-8" />}
          title="Nada a receber aqui"
          description={
            janela === 'vencidas'
              ? 'Nenhuma parcela vencida. É o melhor cenário.'
              : 'Troque o período para ver o que vem mais adiante.'
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {lista.map((i) => (
            <li key={i.tx.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {i.sale ? (
                    <Link to={`/vendas/${i.sale.id}`} className="truncate text-sm font-medium text-content hover:underline">
                      {i.label}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium text-content">{i.label}</span>
                  )}
                  {i.overdue && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-critical/12 px-1.5 py-0.5 text-[10px] font-semibold text-critical">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      vencida
                    </span>
                  )}
                </div>
                <p className="text-xs text-content-faint">
                  {formatDate(i.date)}
                  {i.sale?.client_name ? ` · ${i.sale.client_name}` : ''}
                  {i.sale?.development ? ` · ${i.sale.development}` : ''}
                </p>
              </div>
              <span className={cn('tnum shrink-0 text-sm font-bold', i.overdue ? 'text-critical' : 'text-content')}>
                {formatCurrency(i.amount)}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  if (i.sale && i.installment) setParcela({ venda: i.sale, p: i.installment })
                  else setAvulso(i.tx)
                }}
              >
                Recebi
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ReceberParcela
        venda={parcela?.venda ?? null}
        parcela={parcela?.p ?? null}
        onFechar={() => setParcela(null)}
      />
      <BaixarLancamento tx={avulso} onFechar={() => setAvulso(null)} />
    </div>
  )
}
