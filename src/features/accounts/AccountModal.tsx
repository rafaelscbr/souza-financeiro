import { useState, type FormEvent } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Spinner } from '@/components/ui/Spinner'
import { ACCOUNT_TYPE_LABEL } from '@/lib/treasury'
import { toDateOnly } from '@/lib/format'
import type { Account, AccountInput, AccountType } from '@/types'

const TYPES: AccountType[] = ['checking', 'savings', 'cash', 'investment', 'credit_card']

const COLORS = ['#0F766E', '#1E3A8A', '#7C3AED', '#B45309', '#BE123C', '#0369A1', '#4D7C0F', '#374151']

export function AccountModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Account | null
  onClose: () => void
}) {
  const { businessCompanies, personalCompany, scopeCompanyId, createAccount, updateAccount } =
    useAppData()

  const allCompanies = personalCompany ? [...businessCompanies, personalCompany] : businessCompanies

  const [companyId, setCompanyId] = useState(
    editing?.company_id ?? scopeCompanyId ?? allCompanies[0]?.id ?? '',
  )
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<AccountType>(editing?.type ?? 'checking')
  const [bank, setBank] = useState(editing?.bank ?? '')
  const [opening, setOpening] = useState<number | null>(editing?.opening_balance ?? null)
  const [openingDate, setOpeningDate] = useState(editing?.opening_date ?? toDateOnly(new Date()))
  const [color, setColor] = useState(editing?.color ?? COLORS[0])
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Dê um nome à conta.')
    if (!companyId) return setError('Escolha a empresa.')

    const input: AccountInput = {
      company_id: companyId,
      name: name.trim(),
      type,
      bank: bank.trim() || null,
      opening_balance: opening ?? 0,
      opening_date: openingDate,
      color,
      is_active: isActive,
      sort_order: editing?.sort_order ?? 0,
    }

    setSaving(true)
    try {
      if (editing) await updateAccount(editing.id, input)
      else await createAccount(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar conta' : 'Nova conta'}
      description="Informe o saldo que existe hoje. É dele que o sistema parte para acompanhar tudo."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Empresa" htmlFor="acc-company">
          <Select id="acc-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            {allCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Nome da conta" htmlFor="acc-name">
          <Input
            id="acc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Nubank PJ, Caixinha, Banco do Brasil"
            autoFocus
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tipo" htmlFor="acc-type">
            <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Banco (opcional)" htmlFor="acc-bank">
            <Input
              id="acc-bank"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Ex.: Itaú"
            />
          </FormField>
        </div>

        <FormField
          label="Saldo hoje"
          htmlFor="acc-opening"
          hint="O valor que está na conta neste momento — abra o app do banco e copie"
        >
          <CurrencyInput id="acc-opening" value={opening} onChange={setOpening} />
        </FormField>

        <FormField
          label="Data desse saldo"
          htmlFor="acc-opening-date"
          hint="Movimentos anteriores a esta data são ignorados no saldo"
        >
          <Input
            id="acc-opening-date"
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
          />
        </FormField>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-content-muted">Cor</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={color === c}
                className="h-8 w-8 rounded-lg transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {editing && (
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
            <span className="text-sm text-content">
              Conta ativa
              <span className="mt-0.5 block text-xs text-content-faint">
                Desative em vez de excluir quando a conta já tem movimento
              </span>
            </span>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span
              className="relative h-6 w-11 shrink-0 rounded-full bg-surface-3 transition-colors peer-checked:bg-emerald after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:after:translate-x-5"
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
            {saving ? <Spinner className="h-5 w-5" /> : editing ? 'Salvar' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
