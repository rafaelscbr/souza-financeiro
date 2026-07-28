import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Circle, Scale, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Spinner } from '@/components/ui/Spinner'
import { Tip } from '@/components/ui/Tip'
import { accountBalance } from '@/lib/treasury'
import { cardSummary, isCardAccount } from '@/lib/cards'
import { inMonth, monthKey } from '@/lib/finance'
import { formatCurrency, formatMonthYear, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Account, TransactionInput } from '@/types'

/** Categoria dos acertos de saldo — fica de fora do custo de vida por nome. */
const ADJUST_CATEGORY = 'Acerto de saldo'

/**
 * Fechamento do mês pessoal.
 *
 * Todo controle manual diverge da realidade em poucos meses — um lançamento
 * esquecido aqui, um valor errado ali. A conciliação é o ritual que mantém o
 * espelho fiel: você confere o saldo real no banco e o sistema lança a
 * diferença, em vez de você caçar o erro.
 */
export function MonthlyClosePanel() {
  const { personalTransactions, accounts, transfers, personalCompany, period } = useAppData()
  const [reconciling, setReconciling] = useState<Account | null>(null)

  const personalAccounts = useMemo(
    () => accounts.filter((a) => a.is_active && a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )

  const today = toDateOnly(new Date())

  // 1) Lançamentos do mês liquidados sem conta — ficam fora de qualquer saldo.
  const unassigned = useMemo(
    () =>
      personalTransactions.filter(
        (t) => t.status === 'settled' && t.account_id === null && inMonth(t, period, 'cash'),
      ),
    [personalTransactions, period],
  )

  // 2) Faturas fechadas ainda não pagas.
  const openInvoices = useMemo(
    () =>
      personalAccounts
        .filter(isCardAccount)
        .map((a) => cardSummary(a, personalTransactions, transfers, today))
        .filter((s) => s.closedUnpaid > 0.005),
    [personalAccounts, personalTransactions, transfers, today],
  )

  // 3) Saldos para conferir contra o banco.
  const balances = useMemo(
    () =>
      personalAccounts
        .filter((a) => a.type !== 'credit_card')
        .map((a) => accountBalance(a, personalTransactions, transfers, today)),
    [personalAccounts, personalTransactions, transfers, today],
  )

  const isCurrentMonth = monthKey(period) === monthKey(new Date())
  if (personalAccounts.length === 0) return null

  const pendingSteps = (unassigned.length > 0 ? 1 : 0) + (openInvoices.length > 0 ? 1 : 0)

  return (
    <Section
      title={`Fechamento de ${formatMonthYear(period)}`}
      subtitle={
        pendingSteps === 0
          ? 'Nada pendente — confira os saldos e siga em frente'
          : `${pendingSteps} ${pendingSteps === 1 ? 'ponto' : 'pontos'} para conferir`
      }
    >
      <div className="space-y-3">
        <Step
          done={unassigned.length === 0}
          label="Todo lançamento tem conta definida"
          detail={
            unassigned.length === 0
              ? 'Nenhum lançamento solto neste mês'
              : `${unassigned.length} ${unassigned.length === 1 ? 'lançamento fica' : 'lançamentos ficam'} fora do saldo até você escolher a conta`
          }
        />

        <Step
          done={openInvoices.length === 0}
          label="Faturas de cartão pagas"
          detail={
            openInvoices.length === 0
              ? 'Nenhuma fatura fechada em aberto'
              : openInvoices
                  .map((s) => `${s.account.name}: ${formatCurrency(s.closedUnpaid)}`)
                  .join(' · ')
          }
        />

        {/* Conciliação */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
          <div className="mb-2 flex items-center gap-1.5">
            <Scale className="h-4 w-4 text-content-muted" />
            <h3 className="text-sm font-semibold text-content">Conferir com o banco</h3>
            <Tip label="Por que conciliar">
              O sistema só sabe o que você lançou. Se esquecer um gasto, o saldo daqui descola do
              extrato — e quanto mais tempo passa, mais difícil achar a diferença. Conferindo todo
              mês, o acerto é de centavos em vez de virar um mistério.
            </Tip>
          </div>
          <ul className="space-y-2">
            {balances.map((b) => (
              <li key={b.account.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: b.account.color }}
                  />
                  <span className="truncate text-sm text-content">{b.account.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-sm font-semibold text-content">
                    {formatCurrency(b.balance)}
                  </span>
                  <button
                    onClick={() => setReconciling(b.account)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-emerald hover:bg-emerald-soft"
                  >
                    Conferir
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {!isCurrentMonth && (
            <p className="mt-2 text-[11px] text-content-faint">
              Os saldos acima são de hoje, não do fim do mês em foco.
            </p>
          )}
        </div>
      </div>

      <ReconcileModal
        key={reconciling?.id ?? 'nenhum'}
        account={reconciling}
        onClose={() => setReconciling(null)}
      />
    </Section>
  )
}

function Step({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-income" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
      )}
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', done ? 'text-content-muted' : 'text-content')}>
          {label}
        </p>
        <p className="text-xs text-content-faint">{detail}</p>
      </div>
    </div>
  )
}

/**
 * Ajuste de saldo: você informa o que o banco mostra e o sistema lança a
 * diferença como um acerto — nunca sobrescreve o saldo direto, senão o extrato
 * deixaria de explicar como chegou nele.
 */
function ReconcileModal({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { personalTransactions, transfers, personalCompany, personalReady, createTransaction } =
    useAppData()

  const [real, setReal] = useState<number | null>(null)
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!account) return null

  const current = accountBalance(account, personalTransactions, transfers, date).balance
  const diff = real === null ? 0 : Math.round((real - current) * 100) / 100
  const hasDiff = Math.abs(diff) >= 0.01

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!account || !personalCompany) return
    setError(null)
    if (real === null) return setError('Informe o saldo que o banco mostra.')
    if (!hasDiff) {
      onClose()
      return
    }

    const input: TransactionInput = {
      company_id: personalCompany.id,
      kind: diff > 0 ? 'income' : 'expense',
      category: ADJUST_CATEGORY,
      dre_group: null,
      description: `Acerto de saldo · ${account.name}`,
      amount: Math.abs(diff),
      competence_date: date,
      status: 'settled',
      settled_date: date,
      due_date: null,
      is_recurring: false,
      contact_id: null,
      counterparty: null,
      property_value: null,
      commission_pct: null,
      broker_pct: null,
      group_id: null,
      installment_index: null,
      installment_count: null,
      account_id: account.id,
      ...(personalReady ? { card_cycle_month: null } : {}),
    }

    setSaving(true)
    try {
      await createTransaction(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível lançar o acerto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!account}
      onClose={onClose}
      title={`Conferir ${account.name}`}
      description="Abra o app do banco e copie o saldo. O sistema lança só a diferença."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-content-muted">O sistema diz</span>
          <span className="tnum text-lg font-bold text-content">{formatCurrency(current)}</span>
        </div>

        <FormField label="Saldo real no banco" htmlFor="rc-real">
          <CurrencyInput id="rc-real" value={real} onChange={setReal} autoFocus />
        </FormField>

        <FormField label="Data da conferência" htmlFor="rc-date">
          <Input
            id="rc-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </FormField>

        {real !== null && (
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-4 py-3',
              hasDiff ? 'border-pending/25 bg-pending/5' : 'border-income/25 bg-income/5',
            )}
          >
            {hasDiff ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-income" />
            )}
            <p className="text-sm text-content-muted">
              {hasDiff ? (
                <>
                  Diferença de{' '}
                  <strong className={diff > 0 ? 'text-income' : 'text-expense'}>
                    {formatCurrency(Math.abs(diff))}
                  </strong>{' '}
                  {diff > 0 ? 'a mais' : 'a menos'} no banco. Vou lançar um acerto nesse valor —
                  provavelmente é algum gasto ou entrada que não foi registrado.
                </>
              ) : (
                <>
                  <strong className="text-content">Bateu certinho.</strong> Nada a ajustar.
                </>
              )}
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={saving || real === null}>
            {saving ? <Spinner className="h-5 w-5" /> : hasDiff ? 'Lançar acerto' : 'Fechar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
