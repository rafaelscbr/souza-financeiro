import { useMemo, useState } from 'react'
import { CalendarCheck2, CreditCard } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { SettleModal } from '@/features/transactions/SettleModal'
import { cardPayables, cardSummary } from '@/lib/cards'
import { formatCurrency, formatDateShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

/**
 * O que ainda vai sair do bolso: contas pessoais pendentes e faturas de cartão
 * por vencer, na ordem em que vencem.
 */
export function PagarPessoalPage() {
  const { personalTransactions, accounts, transfers, personalCompany, personalReady } = useAppData()
  const [baixando, setBaixando] = useState<Transaction | null>(null)
  const hoje = toDateOnly(new Date())

  const pendentes = useMemo(
    () =>
      personalTransactions
        .filter((t) => t.status === 'pending')
        .sort((a, b) =>
          (a.due_date ?? a.competence_date) < (b.due_date ?? b.competence_date) ? -1 : 1,
        ),
    [personalTransactions],
  )

  const faturas = useMemo(() => {
    if (!personalReady || !personalCompany) return []
    const cartoes = accounts.filter(
      (a) => a.is_active && a.company_id === personalCompany.id && a.type === 'credit_card',
    )
    return cardPayables(cartoes.map((c) => cardSummary(c, personalTransactions, transfers))).filter(
      (p) => p.state !== 'future',
    )
  }, [personalReady, personalCompany, accounts, personalTransactions, transfers])

  const total =
    pendentes.reduce((s, t) => s + t.amount, 0) + faturas.reduce((s, f) => s + f.amount, 0)

  if (pendentes.length === 0 && faturas.length === 0) {
    return (
      <EmptyState
        icon={<CalendarCheck2 className="h-8 w-8" />}
        title="Nada a pagar"
        description="Nenhuma conta pessoal pendente e nenhuma fatura de cartão por vencer. Aproveite."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
        <span className="text-sm font-medium text-content-muted">Total a pagar</span>
        <span className="tnum text-lg font-bold text-expense">{formatCurrency(total)}</span>
      </div>

      {faturas.length > 0 && (
        <Section title="Faturas de cartão" subtitle="Fechadas não pagas e a fatura aberta">
          <ul className="divide-y divide-line">
            {faturas.map((f) => (
              <li key={`${f.account.id}-${f.cycleMonth}`} className="flex items-center gap-3 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${f.account.color}1A`, color: f.account.color }}
                >
                  <CreditCard className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{f.account.name}</p>
                  <p
                    className={cn(
                      'text-xs',
                      f.state === 'overdue' ? 'font-medium text-expense' : 'text-content-faint',
                    )}
                  >
                    {f.state === 'overdue' ? 'Venceu' : f.state === 'closed' ? 'Vence' : 'Aberta · vence'}{' '}
                    {formatDateShort(f.dueDate)}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm font-semibold text-content">
                  {formatCurrency(f.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {pendentes.length > 0 && (
        <Section title="Contas pessoais" subtitle={`${pendentes.length} pendente(s)`}>
          <ul className="divide-y divide-line">
            {pendentes.map((t) => {
              const venc = t.due_date ?? t.competence_date
              const atrasado = venc < hoje
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">{t.category}</p>
                    <p
                      className={cn(
                        'truncate text-xs',
                        atrasado ? 'font-medium text-expense' : 'text-content-faint',
                      )}
                    >
                      {atrasado ? 'Venceu' : 'Vence'} {formatDateShort(venc)}
                      {t.description && ` · ${t.description}`}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-sm font-semibold text-expense">
                    {formatCurrency(t.amount)}
                  </span>
                  <button
                    onClick={() => setBaixando(t)}
                    className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
                  >
                    Baixar
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      <SettleModal tx={baixando} onClose={() => setBaixando(null)} />
    </div>
  )
}
