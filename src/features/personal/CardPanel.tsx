import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, CreditCard, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { cardSummary, type CardInvoice, type CardSummary } from '@/lib/cards'
import { formatCurrency, formatDate, formatDateShort, formatMonthYear, parseDateOnly, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Account } from '@/types'

/**
 * Cartões pessoais: fatura aberta, fatura fechada a pagar, limite comprometido
 * e alerta de atraso. A fatura é derivada — cada compra carrega o carimbo do
 * ciclo; aqui só se agrega e se paga (via transferência, nunca como despesa).
 */
export function CardPanel() {
  const { personalCompany, personalTransactions, transfers, accounts } = useAppData()
  const [invoiceAccount, setInvoiceAccount] = useState<Account | null>(null)
  const [paying, setPaying] = useState<CardSummary | null>(null)

  const cards = useMemo(
    () =>
      accounts.filter(
        (a) => a.is_active && a.company_id === personalCompany?.id && a.type === 'credit_card',
      ),
    [accounts, personalCompany],
  )

  const summaries = useMemo(
    () => cards.map((c) => cardSummary(c, personalTransactions, transfers)),
    [cards, personalTransactions, transfers],
  )

  if (cards.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summaries.map((s) => (
          <CardTile
            key={s.account.id}
            summary={s}
            onOpenInvoice={() => setInvoiceAccount(s.account)}
            onPay={() => setPaying(s)}
          />
        ))}
      </div>

      {invoiceAccount && (
        <InvoiceModal
          account={invoiceAccount}
          onClose={() => setInvoiceAccount(null)}
          onPay={(s) => {
            setInvoiceAccount(null)
            setPaying(s)
          }}
        />
      )}
      {paying && <PayInvoiceModal summary={paying} onClose={() => setPaying(null)} />}
    </>
  )
}

function CardTile({
  summary,
  onOpenInvoice,
  onPay,
}: {
  summary: CardSummary
  onOpenInvoice: () => void
  onPay: () => void
}) {
  const { account, open, closedUnpaid, closedDueDate, overdue, limitUsed, limitAvailable } = summary
  const notConfigured = account.card_closing_day == null

  return (
    <div
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      style={{ borderLeft: `4px solid ${account.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${account.color}1A`, color: account.color }}
          >
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{account.name}</p>
            <p className="truncate text-[11px] text-content-faint">
              {notConfigured
                ? 'Defina o fechamento na edição da conta'
                : `Fecha dia ${account.card_closing_day} · vence dia ${account.card_due_day ?? account.card_closing_day}`}
            </p>
          </div>
        </div>
        {overdue && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-expense/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-expense">
            <AlertTriangle className="h-3 w-3" />
            Vencida
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-content-faint">
            Fatura aberta
          </p>
          <p className="tnum text-2xl font-bold text-content">{formatCurrency(open.total)}</p>
          <p className="text-[11px] text-content-faint">fecha {formatDateShort(open.closingDate)}</p>
        </div>
        {closedUnpaid > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-content-faint">
              Fechada a pagar
            </p>
            <p className={cn('tnum text-lg font-bold', overdue ? 'text-expense' : 'text-content')}>
              {formatCurrency(closedUnpaid)}
            </p>
            {closedDueDate && (
              <p className={cn('text-[11px]', overdue ? 'text-expense' : 'text-content-faint')}>
                {overdue ? 'venceu' : 'vence'} {formatDateShort(closedDueDate)}
              </p>
            )}
          </div>
        )}
      </div>

      {account.card_limit != null && account.card_limit > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-content-faint">
            <span>Limite comprometido (inclui parcelas futuras)</span>
            <span className="tnum">
              {formatCurrency(limitUsed)} / {formatCurrency(account.card_limit)}
            </span>
          </div>
          <Progress
            value={account.card_limit > 0 ? limitUsed / account.card_limit : 0}
            color={limitUsed > account.card_limit ? '#DC2626' : account.color}
          />
          {limitAvailable != null && (
            <p className="mt-1 text-[11px] text-content-faint">
              Disponível: <span className="tnum">{formatCurrency(Math.max(0, limitAvailable))}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button onClick={onOpenInvoice} className="text-xs font-medium text-emerald hover:underline">
          Ver faturas
        </button>
        {(closedUnpaid > 0 || open.total > 0) && (
          <button onClick={onPay} className="text-xs font-medium text-emerald hover:underline">
            Pagar fatura
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fatura detalhada, com navegação entre ciclos
// ---------------------------------------------------------------------------

function InvoiceModal({
  account,
  onClose,
  onPay,
}: {
  account: Account
  onClose: () => void
  onPay: (s: CardSummary) => void
}) {
  const { personalTransactions, transfers } = useAppData()
  const summary = useMemo(
    () => cardSummary(account, personalTransactions, transfers),
    [account, personalTransactions, transfers],
  )
  const [index, setIndex] = useState(() =>
    Math.max(0, summary.invoices.findIndex((i) => i.state === 'open')),
  )
  const invoice: CardInvoice | undefined = summary.invoices[index]

  if (!invoice) return null

  const stateLabel: Record<CardInvoice['state'], string> = {
    open: 'Aberta',
    closed: 'Fechada',
    future: 'Futura',
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${account.name} · faturas`}
      description="Cada compra é uma despesa individual, categorizada. A fatura só agrupa."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-lg p-2 text-content-muted transition-colors hover:bg-surface-2 disabled:opacity-30"
            aria-label="Fatura anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-content">
              {formatMonthYear(parseDateOnly(invoice.cycleMonth))}
            </p>
            <p className="text-[11px] text-content-faint">
              fecha {formatDate(invoice.closingDate)} · vence {formatDate(invoice.dueDate)}
            </p>
          </div>
          <button
            onClick={() => setIndex((i) => Math.min(summary.invoices.length - 1, i + 1))}
            disabled={index >= summary.invoices.length - 1}
            className="rounded-lg p-2 text-content-muted transition-colors hover:bg-surface-2 disabled:opacity-30"
            aria-label="Próxima fatura"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              invoice.state === 'open'
                ? 'bg-emerald-soft text-emerald-dark'
                : invoice.state === 'future'
                  ? 'bg-withdrawal/12 text-withdrawal'
                  : 'bg-surface-3 text-content-muted',
            )}
          >
            {stateLabel[invoice.state]}
          </span>
          <span className="tnum text-lg font-bold text-content">{formatCurrency(invoice.total)}</span>
        </div>

        {invoice.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-content-muted">Nenhuma compra neste ciclo.</p>
        ) : (
          <ul className="divide-y divide-line">
            {invoice.items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="tnum w-10 shrink-0 text-center text-xs font-medium text-content-muted">
                  {formatDateShort(t.settled_date ?? t.competence_date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content">{t.description || t.category}</p>
                  <p className="truncate text-[11px] text-content-faint">
                    {t.category}
                    {t.installment_index != null && t.installment_count != null && (
                      <span className="ml-1 rounded bg-surface-3 px-1 py-px text-[10px] font-semibold text-content-muted">
                        {t.installment_index}/{t.installment_count}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    'tnum shrink-0 text-sm font-semibold',
                    t.kind === 'income' ? 'text-income' : 'text-content',
                  )}
                >
                  {t.kind === 'income' ? '− ' : ''}
                  {formatCurrency(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {(summary.closedUnpaid > 0 || invoice.state === 'open') && (
          <Button className="w-full" onClick={() => onPay(summary)}>
            Pagar fatura
          </Button>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Pagar fatura = transferência conta → cartão (nunca despesa)
// ---------------------------------------------------------------------------

function PayInvoiceModal({ summary, onClose }: { summary: CardSummary; onClose: () => void }) {
  const { personalCompany, accounts, createTransfer } = useAppData()
  const { showToast } = useToast()

  const sources = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.is_active && a.company_id === personalCompany?.id && a.type !== 'credit_card',
      ),
    [accounts, personalCompany],
  )

  // Se já houve pagamento adiantado, o crédito abate a fatura aberta — sem
  // isto o valor sugerido faria você pagar de novo o que já pagou.
  const suggested =
    summary.closedUnpaid > 0
      ? summary.closedUnpaid
      : Math.max(0, Math.round((summary.open.total - summary.prepaid) * 100) / 100)
  const [from, setFrom] = useState(sources[0]?.id ?? '')
  const [amount, setAmount] = useState<number | null>(suggested > 0 ? suggested : null)
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!from) return setError('Escolha a conta de onde o dinheiro sai.')
    if (!amount || amount <= 0) return setError('Informe o valor pago.')

    setSaving(true)
    try {
      await createTransfer({
        from_account_id: from,
        to_account_id: summary.account.id,
        amount,
        date,
        description: `Pagamento de fatura · ${summary.account.name}`,
      })
      showToast({ message: `Fatura de ${formatCurrency(amount)} paga ✓` })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar o pagamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pagar fatura · ${summary.account.name}`}
      description="O pagamento é uma transferência para o cartão — os gastos já foram contados na compra, então nada é lançado em dobro."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {sources.length === 0 ? (
          <p className="text-sm text-content-muted">
            Cadastre uma conta pessoal (corrente ou dinheiro) em Contas para registrar de onde o
            pagamento sai.
          </p>
        ) : (
          <>
            <FormField label="Pagar com" htmlFor="pay-from">
              <Select id="pay-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                {sources.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Valor"
              htmlFor="pay-amount"
              hint={
                summary.closedUnpaid > 0
                  ? 'Sugerido: a fatura fechada. Pagamento parcial deixa o restante como saldo devedor.'
                  : 'Sugerido: o total da fatura aberta (pagamento antecipado).'
              }
            >
              <CurrencyInput id="pay-amount" value={amount} onChange={setAmount} autoFocus />
            </FormField>

            <FormField label="Data do pagamento" htmlFor="pay-date">
              <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </>
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
          <Button type="submit" className="flex-1" disabled={saving || sources.length === 0}>
            {saving ? <Spinner className="h-5 w-5" /> : 'Confirmar pagamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
