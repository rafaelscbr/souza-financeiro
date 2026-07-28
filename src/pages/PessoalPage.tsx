import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Wallet,
  TrendingDown,
  PiggyBank,
  Sparkles,
  Plus,
  PlusCircle,
  Pencil,
  Trash2,
  Building2,
  SlidersHorizontal,
  Database,
  CheckCircle2,
  CreditCard,
  CalendarClock,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { CategoryBarChart } from '@/features/dashboard/Charts'
import { PersonalTransactionModal } from '@/features/personal/PersonalTransactionModal'
import { PersonalQuickSheet } from '@/features/personal/PersonalQuickSheet'
import { PersonalRecurringPrompt } from '@/features/personal/PersonalRecurringPrompt'
import { CardPanel } from '@/features/personal/CardPanel'
import { BudgetEditor } from '@/features/personal/BudgetEditor'
import { VitalsPanel } from '@/features/personal/VitalsPanel'
import { InsightsPanel } from '@/features/personal/InsightsPanel'
import { OwnerIncomePanel } from '@/features/personal/OwnerIncomePanel'
import { NetWorthPanel } from '@/features/personal/NetWorthPanel'
import { PersonalForecastPanel } from '@/features/personal/PersonalForecastPanel'
import { MonthlyClosePanel } from '@/features/personal/MonthlyClosePanel'
import { AnnualReportPanel } from '@/features/personal/AnnualReportPanel'
import { SettleModal } from '@/features/transactions/SettleModal'
import { cardSummary, cardPayables } from '@/lib/cards'
import { ownerIncome, personalVitals } from '@/lib/personal'
import { resolveBudgets } from '@/lib/budgets'
import {
  firstDayOfMonth,
  inMonth,
  isOwnerPayout,
  lastNMonths,
  monthElapsedFraction,
  personalSummary,
} from '@/lib/finance'
import {
  formatCurrency,
  formatDateShort,
  formatMonthShort,
  formatMonthYear,
  parseDateOnly,
  toDateOnly,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

const PERSONAL_COLOR = '#6366F1'

export function PessoalPage() {
  const {
    personalTransactions,
    businessTransactions,
    personalBudgets,
    personalCompany,
    personalReady,
    companies,
    categories,
    accounts,
    transfers,
    period,
    regime,
    deleteTransaction,
    deleteGroup,
  } = useAppData()

  const [searchParams, setSearchParams] = useSearchParams()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [settling, setSettling] = useState<Transaction | null>(null)

  // Atalho da home do iPhone (PWA shortcut): /pessoal?novo=gasto abre o sheet.
  useEffect(() => {
    if (searchParams.get('novo') === 'gasto') {
      setSheetOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const summary = useMemo(
    () => personalSummary(personalTransactions, businessTransactions, period, regime),
    [personalTransactions, businessTransactions, period, regime],
  )

  const personalAccounts = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )

  // Indicadores de planejamento: taxa de poupança, custo de vida e reserva.
  const vitals = useMemo(
    () =>
      personalVitals(
        personalTransactions,
        businessTransactions,
        personalAccounts,
        transfers,
        period,
        regime,
      ),
    [personalTransactions, businessTransactions, personalAccounts, transfers, period, regime],
  )

  // Renda média que as empresas pagam — alimenta a previsão de caixa dos
  // meses futuros (o mês corrente já tem o que entrou de verdade).
  const expectedMonthlyIncome = useMemo(
    () =>
      ownerIncome(businessTransactions, companies, lastNMonths(period, 12), regime).monthlyAvg,
    [businessTransactions, companies, period, regime],
  )

  const monthPersonal = useMemo(
    () =>
      personalTransactions
        .filter((t) => inMonth(t, period, regime))
        .sort((a, b) =>
          (a.settled_date ?? a.due_date ?? a.competence_date) <
          (b.settled_date ?? b.due_date ?? b.competence_date)
            ? 1
            : -1,
        ),
    [personalTransactions, period, regime],
  )

  const withdrawals = useMemo(
    () => businessTransactions.filter((t) => isOwnerPayout(t) && inMonth(t, period, regime)),
    [businessTransactions, period, regime],
  )

  // Contas a pagar pessoais (qualquer mês) + faturas de cartão por vencer.
  const pendingPersonal = useMemo(
    () =>
      personalTransactions
        .filter((t) => t.status === 'pending')
        .sort((a, b) => ((a.due_date ?? a.competence_date) < (b.due_date ?? b.competence_date) ? -1 : 1)),
    [personalTransactions],
  )

  const upcomingInvoices = useMemo(() => {
    if (!personalReady || !personalCompany) return []
    const cards = accounts.filter(
      (a) => a.is_active && a.company_id === personalCompany.id && a.type === 'credit_card',
    )
    const summaries = cards.map((c) => cardSummary(c, personalTransactions, transfers))
    // Só o que já tem vencimento próximo interessa aqui: fechada não paga e a aberta.
    return cardPayables(summaries).filter((p) => p.state !== 'future')
  }, [personalReady, personalCompany, accounts, personalTransactions, transfers])

  const monthFirstDay = firstDayOfMonth(period)
  const budgetRows = useMemo(() => {
    const spentByCat = new Map<string, number>()
    for (const t of monthPersonal) {
      if (t.kind === 'expense') spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount)
    }
    const elapsed = monthElapsedFraction(period)
    return resolveBudgets(personalBudgets, monthFirstDay)
      .map((b) => {
        const spent = spentByCat.get(b.category) ?? 0
        const projected = elapsed > 0.1 && elapsed < 0.98 ? spent / elapsed : spent
        return { ...b, spent, projected }
      })
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
  }, [personalBudgets, monthPersonal, monthFirstDay, period])

  const categoryColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories) {
      if (c.company_id === personalCompany?.id && c.color) map.set(c.name, c.color)
    }
    return map
  }, [categories, personalCompany])

  const categoryData = summary.byCategory.map((c) => ({
    ...c,
    color: categoryColors.get(c.name) ?? PERSONAL_COLOR,
  }))

  const hasCards = accounts.some(
    (a) => a.is_active && a.company_id === personalCompany?.id && a.type === 'credit_card',
  )
  const hasActivity =
    monthPersonal.length > 0 || withdrawals.length > 0 || pendingPersonal.length > 0 || hasCards

  function openEdit(tx: Transaction) {
    setEditing(tx)
    setEditOpen(true)
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Pessoal</h1>
          <p className="text-sm text-content-faint">{formatMonthYear(period)} · sua vida financeira</p>
        </div>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </div>

      {!personalReady && (
        <div className="flex items-start gap-2.5 rounded-xl border border-pending/25 bg-pending/5 px-4 py-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
          <p className="text-sm text-content-muted">
            <strong className="text-content">Falta aplicar a migração do módulo pessoal.</strong>{' '}
            Cartões com fatura, parcelas, ícones de categoria e orçamento por mês precisam dela.
            Abra o SQL Editor do Supabase, cole o conteúdo de{' '}
            <code className="rounded bg-surface-2 px-1 text-xs">supabase/migrations/005_modulo_pessoal.sql</code>{' '}
            e clique em Run. Depois recarregue.
          </p>
        </div>
      )}

      {!hasActivity ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="Suas finanças pessoais começam aqui"
          description="O que as empresas te pagam (pró-labore e distribuição de lucro) entra automaticamente como entrada. Lance seus gastos em 3 toques para ver quanto sobra."
          action={
            <Button onClick={() => setSheetOpen(true)}>
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

          {/* Saúde financeira: poupança, custo de vida e reserva */}
          <VitalsPanel vitals={vitals} />

          {/* Cartões de crédito */}
          {personalReady && hasCards && <CardPanel />}

          {/* A pagar */}
          {(pendingPersonal.length > 0 || upcomingInvoices.length > 0) && (
            <Section title="A pagar" subtitle="Compromissos que ainda vão sair do caixa">
              <ul className="divide-y divide-line">
                {upcomingInvoices.map((p) => (
                  <li key={`${p.account.id}-${p.cycleMonth}`} className="flex items-center gap-3 py-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${p.account.color}1A`, color: p.account.color }}
                    >
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">
                        Fatura {p.account.name}
                      </p>
                      <p
                        className={cn(
                          'text-xs',
                          p.state === 'overdue' ? 'font-medium text-expense' : 'text-content-faint',
                        )}
                      >
                        {p.state === 'overdue' ? 'Venceu' : p.state === 'closed' ? 'Vence' : 'Fatura aberta · vence'}{' '}
                        {formatDateShort(p.dueDate)}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-sm font-semibold text-content">
                      {formatCurrency(p.amount)}
                    </span>
                    <div className="w-[68px] shrink-0" />
                  </li>
                ))}
                {pendingPersonal.map((t) => (
                  <PendingRow
                    key={t.id}
                    tx={t}
                    onSettle={() => setSettling(t)}
                    onEdit={() => openEdit(t)}
                    onDelete={() => (t.group_id ? deleteGroup(t.group_id) : deleteTransaction(t.id))}
                  />
                ))}
              </ul>
            </Section>
          )}

          {/* Fixas do mês */}
          <PersonalRecurringPrompt />

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
                  const willOver = !over && r.projected > r.limit
                  return (
                    <div key={r.category}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-content">
                          {r.category}
                          {r.monthSpecific && (
                            <span className="ml-1.5 rounded bg-surface-3 px-1 py-px text-[10px] font-medium text-content-muted">
                              só este mês
                            </span>
                          )}
                        </span>
                        <span className="tnum text-content-muted">
                          {formatCurrency(r.spent)}{' '}
                          <span className="text-content-faint">/ {formatCurrency(r.limit)}</span>
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        color={over ? '#DC2626' : categoryColors.get(r.category) ?? PERSONAL_COLOR}
                      />
                      {over && (
                        <p className="mt-1 text-xs font-medium text-expense">
                          Estourou {formatCurrency(r.spent - r.limit)}
                        </p>
                      )}
                      {willOver && (
                        <p className="mt-1 text-xs font-medium text-pending">
                          Nesse ritmo, fecha o mês em {formatCurrency(r.projected)} (
                          {Math.round((r.projected / r.limit) * 100)}% do limite)
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Gastos por categoria (mês em foco) */}
          {categoryData.length > 0 && (
            <Section title="Gastos por categoria" subtitle={formatMonthYear(period)}>
              <CategoryBarChart data={categoryData} />
            </Section>
          )}

          {/* Relatórios: cartão por categoria, lugares, fixos, ritmo e tendências */}
          <InsightsPanel livingCostAvg={vitals.livingCostAvg} />

          {/* Renda das empresas e quanto ainda dá para distribuir */}
          <OwnerIncomePanel livingCostAvg={vitals.livingCostAvg} />

          {/* Previsão de caixa, já com as faturas de cartão */}
          <PersonalForecastPanel monthlyIncome={expectedMonthlyIncome} />

          {/* Patrimônio líquido */}
          <NetWorthPanel />

          {/* Fechamento e conciliação */}
          <MonthlyClosePanel />

          {/* Resumo do ano (apoio ao IR) */}
          <AnnualReportPanel />

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
                <PersonalRow
                  key={t.id}
                  tx={t}
                  categoryIcon={
                    categories.find(
                      (c) => c.company_id === personalCompany?.id && c.name === t.category && c.kind === t.kind,
                    )?.icon ?? null
                  }
                  onEdit={() => openEdit(t)}
                  onSettle={t.status === 'pending' ? () => setSettling(t) : undefined}
                  onDelete={() => (t.group_id ? deleteGroup(t.group_id) : deleteTransaction(t.id))}
                />
              ))}
            </ul>
          </Section>
        </>
      )}

      {/* FAB — o caminho dos 3 toques */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald text-white shadow-pop transition-transform active:scale-95 lg:hidden"
        aria-label="Novo lançamento pessoal"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <PersonalQuickSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <PersonalTransactionModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          setEditing(null)
        }}
        editing={editing}
      />
      <BudgetEditor open={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <SettleModal tx={settling} onClose={() => setSettling(null)} />
    </div>
  )
}

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

function PersonalRow({
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

function PendingRow({
  tx,
  onSettle,
  onEdit,
  onDelete,
}: {
  tx: Transaction
  onSettle: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const today = toDateOnly(new Date())
  const due = tx.due_date ?? tx.competence_date
  const overdue = due < today

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          overdue ? 'bg-expense/12 text-expense' : 'bg-pending/12 text-pending',
        )}
      >
        <CalendarClock className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content">
          {tx.category}
          {tx.description && <span className="font-normal text-content-muted"> · {tx.description}</span>}
        </p>
        <p className={cn('text-xs', overdue ? 'font-medium text-expense' : 'text-content-faint')}>
          {overdue ? 'Venceu' : 'Vence'} {formatDateShort(due)}
          {' · '}
          {formatMonthYear(parseDateOnly(due)) !== formatMonthYear(new Date())
            ? formatMonthYear(parseDateOnly(due))
            : 'este mês'}
        </p>
      </div>
      <span className="tnum shrink-0 text-sm font-semibold text-content">{formatCurrency(tx.amount)}</span>
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
            {deleting ? '…' : 'Excluir'}
          </button>
        ) : (
          <>
            <button
              onClick={onSettle}
              className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-income"
              aria-label="Dar baixa"
              title="Dar baixa (paguei)"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
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
