import { useMemo, useState } from 'react'
import {
  Wallet,
  TrendingDown,
  PiggyBank,
  Sparkles,
  PlusCircle,
  Pencil,
  Trash2,
  Building2,
  SlidersHorizontal,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { CategoryBarChart } from '@/features/dashboard/Charts'
import { PersonalTransactionModal } from '@/features/personal/PersonalTransactionModal'
import { BudgetEditor } from '@/features/personal/BudgetEditor'
import { dreGroupOf, inMonth, personalSummary } from '@/lib/finance'
import { formatCurrency, formatDateShort, formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

const PERSONAL_COLOR = '#6366F1'

export function PessoalPage() {
  const { personalTransactions, businessTransactions, personalBudgets, companies, period, regime, deleteTransaction } =
    useAppData()

  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)

  const summary = useMemo(
    () => personalSummary(personalTransactions, businessTransactions, period, regime),
    [personalTransactions, businessTransactions, period, regime],
  )

  const monthPersonal = useMemo(
    () =>
      personalTransactions
        .filter((t) => inMonth(t, period, regime))
        .sort((a, b) => (a.settled_date ?? a.competence_date) < (b.settled_date ?? b.competence_date) ? 1 : -1),
    [personalTransactions, period, regime],
  )

  const withdrawals = useMemo(
    () => businessTransactions.filter((t) => dreGroupOf(t) === 'withdrawal' && inMonth(t, period, regime)),
    [businessTransactions, period, regime],
  )

  const budgetRows = useMemo(() => {
    const spentByCat = new Map<string, number>()
    for (const t of monthPersonal) {
      if (t.kind === 'expense') spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount)
    }
    return personalBudgets
      .map((b) => ({ category: b.category, limit: b.monthly_limit, spent: spentByCat.get(b.category) ?? 0 }))
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
  }, [personalBudgets, monthPersonal])

  const categoryData = summary.byCategory.map((c) => ({ ...c, color: PERSONAL_COLOR }))
  const hasActivity = monthPersonal.length > 0 || withdrawals.length > 0

  function openNew() {
    setEditing(null)
    setComposing(true)
  }
  function openEdit(tx: Transaction) {
    setEditing(tx)
    setComposing(true)
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Pessoal</h1>
          <p className="text-sm text-content-faint">{formatMonthYear(period)} · sua vida financeira</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </div>

      {!hasActivity ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="Suas finanças pessoais começam aqui"
          description="O que as empresas te pagam (pró-labore e distribuição de lucro) entra automaticamente como entrada. Lance seus gastos pessoais para ver quanto sobra."
          action={
            <Button onClick={openNew}>
              <PlusCircle className="h-4 w-4" />
              Lançar gasto pessoal
            </Button>
          }
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Entradas"
              value={formatCurrency(summary.inflow)}
              tone="positive"
              icon={<Wallet className="h-4 w-4" />}
              hint={
                summary.inflowFromBusiness > 0
                  ? `Das empresas: ${formatCurrency(summary.inflowFromBusiness)}`
                  : undefined
              }
            />
            <KpiCard
              label="Saídas"
              value={formatCurrency(summary.outflow)}
              tone="negative"
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <KpiCard
              label="Sobra"
              value={formatCurrency(summary.surplus)}
              tone={summary.surplus >= 0 ? 'positive' : 'negative'}
              icon={<PiggyBank className="h-4 w-4" />}
              hint={summary.surplus < 0 ? 'Gastou mais do que entrou' : 'Disponível pra poupar'}
            />
            <KpiCard
              label="Investido/Poupado"
              value={formatCurrency(summary.invested)}
              tone="accent"
              icon={<PiggyBank className="h-4 w-4" />}
            />
          </div>

          {/* Orçamento */}
          <Section
            title="Orçamento do mês"
            subtitle="Gasto × limite por categoria"
            action={
              <button
                onClick={() => setBudgetOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Definir
              </button>
            }
          >
            {budgetRows.length === 0 ? (
              <p className="text-sm text-content-muted">
                Nenhum limite definido.{' '}
                <button onClick={() => setBudgetOpen(true)} className="font-medium text-emerald hover:underline">
                  Criar orçamento
                </button>
              </p>
            ) : (
              <div className="space-y-4">
                {budgetRows.map((r) => {
                  const pct = r.limit > 0 ? r.spent / r.limit : 0
                  const over = r.spent > r.limit
                  return (
                    <div key={r.category}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-content">{r.category}</span>
                        <span className="tnum text-content-muted">
                          {formatCurrency(r.spent)}{' '}
                          <span className="text-content-faint">/ {formatCurrency(r.limit)}</span>
                        </span>
                      </div>
                      <Progress value={pct} color={over ? '#DC2626' : PERSONAL_COLOR} />
                      {over && (
                        <p className="mt-1 text-xs font-medium text-expense">
                          Estourou {formatCurrency(r.spent - r.limit)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Gastos por categoria */}
          {categoryData.length > 0 && (
            <Section title="Gastos por categoria">
              <CategoryBarChart data={categoryData} />
            </Section>
          )}

          {/* Movimentações */}
          <Section title="Movimentações do mês" subtitle={`${monthPersonal.length + withdrawals.length} registros`}>
            <ul className="divide-y divide-line">
              {withdrawals.map((t) => {
                const company = companies.find((c) => c.id === t.company_id)
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <div className="w-10 shrink-0 text-center">
                      <span className="tnum block text-xs font-medium text-content-muted">
                        {formatDateShort(t.settled_date ?? t.competence_date)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-content">{t.category}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
                          <Building2 className="h-2.5 w-2.5" />
                          {company?.name ?? 'Empresa'}
                        </span>
                      </div>
                      <p className="truncate text-xs text-content-faint">Retirada da empresa</p>
                    </div>
                    <span className="tnum shrink-0 text-sm font-semibold text-income">
                      + {formatCurrency(t.amount)}
                    </span>
                    <div className="w-[68px] shrink-0" />
                  </li>
                )
              })}

              {monthPersonal.map((t) => (
                <PersonalRow key={t.id} tx={t} onEdit={() => openEdit(t)} onDelete={() => deleteTransaction(t.id)} />
              ))}
            </ul>
          </Section>
        </>
      )}

      <PersonalTransactionModal open={composing} onClose={() => setComposing(false)} editing={editing} />
      <BudgetEditor open={budgetOpen} onClose={() => setBudgetOpen(false)} />
    </div>
  )
}

function PersonalRow({ tx, onEdit, onDelete }: { tx: Transaction; onEdit: () => void; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const sign = tx.kind === 'income' ? '+' : '−'
  const color = tx.kind === 'income' ? 'text-income' : 'text-expense'

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="w-10 shrink-0 text-center">
        <span className="tnum block text-xs font-medium text-content-muted">
          {formatDateShort(tx.settled_date ?? tx.competence_date)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content">{tx.category}</p>
        {tx.description && <p className="truncate text-xs text-content-faint">{tx.description}</p>}
      </div>
      <span className={cn('tnum shrink-0 text-sm font-semibold', color)}>
        {sign} {formatCurrency(tx.amount)}
      </span>
      <div className="flex w-[68px] shrink-0 items-center justify-end gap-1">
        {confirming ? (
          <>
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
              {deleting ? '…' : 'Excluir'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-content"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-expense"
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}
