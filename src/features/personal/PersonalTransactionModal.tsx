import { useMemo, useState, type FormEvent } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { toDateOnly } from '@/lib/format'
import type { Transaction, TransactionInput, TransactionKind } from '@/types'

const CUSTOM = '__custom__'

export function PersonalTransactionModal({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing: Transaction | null
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar lançamento pessoal' : 'Novo lançamento pessoal'}
      description={editing ? undefined : 'Suas receitas e gastos pessoais.'}
    >
      {open && <PersonalForm editing={editing} onClose={onClose} />}
    </Modal>
  )
}

function PersonalForm({ editing, onClose }: { editing: Transaction | null; onClose: () => void }) {
  const { personalCompany, categories, accounts, treasuryReady, createTransaction, updateTransaction } =
    useAppData()

  const [kind, setKind] = useState<TransactionKind>(editing?.kind === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState<number | null>(editing ? editing.amount : null)
  const [date, setDate] = useState(editing?.settled_date ?? editing?.competence_date ?? toDateOnly(new Date()))
  const [description, setDescription] = useState(editing?.description ?? '')
  const [isRecurring, setIsRecurring] = useState(editing?.is_recurring ?? false)
  const [accountId, setAccountId] = useState<string>(editing?.account_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const personalAccounts = useMemo(
    () => accounts.filter((a) => a.is_active && a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )

  const cats = useMemo(
    () =>
      categories
        .filter((c) => c.company_id === personalCompany?.id && c.kind === kind)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, personalCompany, kind],
  )

  const isEditingCustom = !!editing && !cats.some((c) => c.name === editing.category)
  const [selected, setSelected] = useState(editing ? (isEditingCustom ? CUSTOM : editing.category) : cats[0]?.name ?? CUSTOM)
  const [custom, setCustom] = useState(isEditingCustom ? editing!.category : '')

  const category = selected === CUSTOM ? custom.trim() : selected

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!personalCompany) return setError('Empresa pessoal não encontrada.')
    if ((amount ?? 0) <= 0) return setError('Informe um valor maior que zero.')
    if (!category) return setError('Selecione ou informe uma categoria.')

    const input: TransactionInput = {
      company_id: personalCompany.id,
      kind,
      category,
      dre_group: null,
      description: description.trim(),
      amount: amount ?? 0,
      competence_date: date,
      status: 'settled',
      settled_date: date,
      due_date: null,
      is_recurring: kind === 'expense' ? isRecurring : false,
      contact_id: null,
      counterparty: null,
      property_value: null,
      commission_pct: null,
      broker_pct: null,
      group_id: null,
      installment_index: null,
      installment_count: null,
      account_id: accountId || null,
    }

    setSaving(true)
    try {
      if (editing) await updateTransaction(editing.id, input)
      else await createTransaction(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Segmented
        ariaLabel="Tipo"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Gasto', activeClass: 'bg-expense/12 text-expense border border-expense/25' },
          { value: 'income', label: 'Entrada', activeClass: 'bg-income/12 text-income border border-income/25' },
        ]}
      />

      <FormField label="Categoria" htmlFor="p-category">
        <Select id="p-category" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {cats.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value={CUSTOM}>Outra…</option>
        </Select>
      </FormField>

      {selected === CUSTOM && (
        <FormField label="Nova categoria" htmlFor="p-custom">
          <Input id="p-custom" value={custom} onChange={(e) => setCustom(e.target.value)} autoFocus placeholder="Ex.: Pet, Viagem…" />
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Valor" htmlFor="p-amount">
          <CurrencyInput id="p-amount" value={amount} onChange={setAmount} autoFocus={!editing && selected !== CUSTOM} />
        </FormField>
        <FormField label="Data" htmlFor="p-date">
          <Input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Descrição" htmlFor="p-desc">
        <Input id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
      </FormField>

      {treasuryReady && personalAccounts.length > 0 && (
        <FormField
          label="Conta"
          htmlFor="p-account"
          hint={`Onde o dinheiro ${kind === 'income' ? 'entrou' : 'saiu'}`}
        >
          <Select id="p-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Definir depois</option>
            {personalAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {kind === 'expense' && (
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
          <span className="text-sm text-content">Gasto fixo (todo mês)</span>
          <input type="checkbox" className="peer sr-only" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
          <span
            className="relative h-6 w-11 rounded-full bg-surface-3 transition-colors peer-checked:bg-emerald after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:after:translate-x-5"
            aria-hidden
          />
        </label>
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
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? <Spinner className="h-5 w-5" /> : editing ? 'Salvar' : 'Lançar'}
        </Button>
      </div>
    </form>
  )
}
