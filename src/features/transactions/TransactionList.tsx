import { useState } from 'react'
import { Pencil, Trash2, RefreshCw } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { useComposer } from './TransactionComposer'
import { listingDate } from '@/lib/finance'
import { formatCurrency, formatDateShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

export function TransactionList({
  transactions,
  showCompany = false,
}: {
  transactions: Transaction[]
  showCompany?: boolean
}) {
  const { regime } = useAppData()

  // Ordena pela data que importa no regime atual, para a lista bater com os KPIs.
  const sorted = [...transactions].sort((a, b) => {
    const da = listingDate(a, regime)
    const db = listingDate(b, regime)
    if (da !== db) return da < db ? 1 : -1
    return a.created_at < b.created_at ? 1 : -1
  })

  return (
    <ul className="divide-y divide-line">
      {sorted.map((t) => (
        <TransactionRow key={t.id} tx={t} showCompany={showCompany} />
      ))}
    </ul>
  )
}

function TransactionRow({ tx, showCompany }: { tx: Transaction; showCompany: boolean }) {
  const { deleteTransaction, companies, contacts, regime } = useAppData()
  const { openEdit } = useComposer()
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
