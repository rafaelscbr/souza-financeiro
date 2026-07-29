import { useState } from 'react'
import { Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDateShort, formatMonthShort, parseDateOnly, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

/**
 * Uma linha do extrato pessoal: categoria com ícone, selos de parcela/fatura/
 * atraso, valor e as ações. Vive à parte porque a visão geral, os gastos e o
 * a-pagar mostram a mesma linha — duplicá-la faria as três divergirem.
 */
function txBadges(tx: Transaction) {
  const badges: { label: string; className: string }[] = []
  const today = toDateOnly(new Date())
  if (tx.status === 'pending') {
    const overdue = (tx.due_date ?? tx.competence_date) < today
    badges.push(
      overdue
        ? { label: 'Vencido', className: 'bg-expense/12 text-expense' }
        : { label: 'A pagar', className: 'bg-pending/15 text-pending' },
    )
  }
  if (tx.installment_index != null && tx.installment_count != null) {
    badges.push({
      label: `${tx.installment_index}/${tx.installment_count}`,
      className: 'bg-surface-3 text-content-muted',
    })
  }
  if (tx.card_cycle_month) {
    badges.push({
      label: `fatura ${formatMonthShort(parseDateOnly(tx.card_cycle_month))}`,
      className: 'bg-withdrawal/12 text-withdrawal',
    })
  }
  return badges
}

export function PersonalRow({
  tx,
  categoryIcon,
  onEdit,
  onSettle,
  onDelete,
}: {
  tx: Transaction
  categoryIcon: string | null
  onEdit: () => void
  onSettle?: () => void
  onDelete: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const sign = tx.kind === 'income' ? '+' : '−'
  const color = tx.kind === 'income' ? 'text-income' : 'text-expense'
  const isCardTx = tx.card_cycle_month != null
  const isSeries = tx.group_id != null

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="w-10 shrink-0 text-center">
        <span className="tnum block text-xs font-medium text-content-muted">
          {formatDateShort(tx.settled_date ?? tx.due_date ?? tx.competence_date)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-content">
            {categoryIcon && <span aria-hidden className="mr-1">{categoryIcon}</span>}
            {tx.category}
          </span>
          {txBadges(tx).map((b) => (
            <span
              key={b.label}
              className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', b.className)}
            >
              {b.label}
            </span>
          ))}
        </div>
        {tx.description && <p className="truncate text-xs text-content-faint">{tx.description}</p>}
      </div>
      <span className={cn('tnum shrink-0 text-sm font-semibold', color)}>
        {sign} {formatCurrency(tx.amount)}
      </span>
      <div className="flex w-[92px] shrink-0 items-center justify-end gap-0.5">
        {confirming ? (
          <button
            onClick={async () => {
              setDeleting(true)
              try {
                await onDelete()
              } finally {
                setDeleting(false)
                setConfirming(false)
              }
            }}
            disabled={deleting}
            className="rounded-lg bg-expense/15 px-2 py-1 text-xs font-medium text-expense"
          >
            {deleting ? '…' : isSeries ? 'Excluir série' : 'Excluir'}
          </button>
        ) : (
          <>
            {onSettle && (
              <button
                onClick={onSettle}
                className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-income"
                aria-label="Dar baixa"
                title="Dar baixa (paguei)"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {!isCardTx && (
              <button
                onClick={onEdit}
                className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-content"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-expense"
              aria-label="Excluir"
              title={isSeries ? 'Excluir a série inteira de parcelas' : 'Excluir'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}
