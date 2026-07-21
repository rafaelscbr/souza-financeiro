import { useState } from 'react'
import { Pencil, Trash2, RefreshCw, CheckCircle2, Copy } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { useComposer } from './TransactionComposer'
import { SettleModal } from './SettleModal'
import { listingDate } from '@/lib/finance'
import { formatCurrency, formatDateShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction, TransactionInput } from '@/types'

/** Campos a repetir ao duplicar — datas, status e parcelamento voltam ao padrão. */
function duplicatePrefill(tx: Transaction): Partial<TransactionInput> {
  return {
    company_id: tx.company_id,
    kind: tx.kind,
    category: tx.category,
    dre_group: tx.dre_group,
    description: tx.description,
    amount: tx.amount,
    contact_id: tx.contact_id,
    cost_center_id: tx.cost_center_id,
    property_value: tx.property_value,
    commission_pct: tx.commission_pct,
    broker_pct: tx.broker_pct,
  }
}

export function TransactionList({
  transactions,
  showCompany = false,
}: {
  transactions: Transaction[]
  showCompany?: boolean
}) {
  const { regime } = useAppData()
  const [settling, setSettling] = useState<Transaction | null>(null)

  // Ordena pela data que importa no regime atual, para a lista bater com os KPIs.
  const sorted = [...transactions].sort((a, b) => {
    const da = listingDate(a, regime)
    const db = listingDate(b, regime)
    if (da !== db) return da < db ? 1 : -1
    return a.created_at < b.created_at ? 1 : -1
  })

  return (
    <>
      <ul className="divide-y divide-line">
        {sorted.map((t) => (
          <TransactionRow key={t.id} tx={t} showCompany={showCompany} onSettle={setSettling} />
        ))}
      </ul>
      <SettleModal tx={settling} onClose={() => setSettling(null)} />
    </>
  )
}

function TransactionRow({
  tx,
  showCompany,
  onSettle,
}: {
  tx: Transaction
  showCompany: boolean
  onSettle: (tx: Transaction) => void
}) {
  const { deleteTransaction, companies, contacts, regime } = useAppData()
  const { openEdit, openNew } = useComposer()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const rowDate = listingDate(tx, regime)
  const dueDate = tx.due_date ?? tx.competence_date
  const isOverdue = tx.status === 'pending' && dueDate < toDateOnly(new Date())

  const company = companies.find((c) => c.id === tx.company_id)
  const contact = contacts.find((c) => c.id === tx.contact_id)
  const sign = tx.kind === 'income' ? '+' : '−'
  const amountColor =
    tx.kind === 'income' ? 'text-income' : tx.kind === 'expense' ? 'text-expense' : 'text-withdrawal'
  const subtitle = [showCompany && company ? company.name : null, contact?.name, tx.description]
    .filter(Boolean)
    .join(' · ')

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteTransaction(tx.id)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <li className="group flex items-center gap-3 py-3">
      <div className="w-10 shrink-0 text-center">
        <span className="tnum block text-xs font-medium text-content-muted">
          {formatDateShort(rowDate)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-content">{tx.category}</span>
          {tx.is_recurring && (
            <RefreshCw className="h-3 w-3 shrink-0 text-content-faint" aria-label="Recorrente" />
          )}
          {tx.installment_count && tx.installment_count > 1 && (
            <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
              {tx.installment_index}/{tx.installment_count}
            </span>
          )}
          {tx.status === 'pending' && (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                isOverdue ? 'bg-critical/15 text-critical' : 'bg-pending/15 text-pending',
              )}
            >
              {isOverdue ? 'Vencido' : tx.kind === 'expense' ? 'A pagar' : 'A receber'}
            </span>
          )}
        </div>
        {subtitle && <p className="truncate text-xs text-content-faint">{subtitle}</p>}
        {/* No regime de competência, deixa explícito quando o dinheiro se move. */}
        {regime === 'accrual' && tx.status === 'pending' && (
          <p className={cn('text-[11px]', isOverdue ? 'text-critical' : 'text-content-faint')}>
            {tx.kind === 'expense' ? 'Paga' : 'Cai'} em {formatDateShort(dueDate)}
          </p>
        )}
      </div>

      <span className={cn('tnum shrink-0 text-sm font-semibold', amountColor)}>
        {sign} {formatCurrency(tx.amount)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {confirming ? (
          <>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-lg bg-expense/15 px-2 py-1 text-xs font-medium text-expense hover:bg-expense/25"
            >
              {deleting ? '…' : 'Excluir'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg px-2 py-1 text-xs text-content-muted hover:bg-surface-2"
            >
              Não
            </button>
          </>
        ) : (
          <>
            {/* Baixa em um clique — só faz sentido no que ainda está pendente. */}
            {tx.status === 'pending' && (
              <button
                onClick={() => onSettle(tx)}
                className="rounded-lg p-2 text-content-faint transition-colors hover:bg-income/10 hover:text-income"
                aria-label={`Dar baixa em ${tx.category}`}
                title={tx.kind === 'expense' ? 'Marcar como pago' : 'Marcar como recebido'}
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => openNew(duplicatePrefill(tx))}
              className="hidden rounded-lg p-2 text-content-faint transition-colors hover:bg-surface-2 hover:text-content sm:block"
              aria-label={`Duplicar lançamento ${tx.category}`}
              title="Duplicar"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => openEdit(tx)}
              className="rounded-lg p-2 text-content-faint transition-colors hover:bg-surface-2 hover:text-content"
              aria-label={`Editar lançamento ${tx.category}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg p-2 text-content-faint transition-colors hover:bg-surface-2 hover:text-expense"
              aria-label={`Excluir lançamento ${tx.category}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}
