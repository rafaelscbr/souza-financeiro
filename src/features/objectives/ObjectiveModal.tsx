import { useState, type FormEvent } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import type { Objective, ObjectiveInput } from '@/types'

type Scope = 'business' | 'personal'

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'business', label: 'Da empresa' },
  { value: 'personal', label: 'Pessoal' },
]

export function ObjectiveModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Objective | null
  onClose: () => void
}) {
  const { businessCompanies, scopeCompanyId, createObjective, updateObjective } = useAppData()

  const [scope, setScope] = useState<Scope>(editing?.scope ?? 'business')
  const [companyId, setCompanyId] = useState(
    editing?.company_id ?? scopeCompanyId ?? businessCompanies[0]?.id ?? '',
  )
  const [name, setName] = useState(editing?.name ?? '')
  const [oneTime, setOneTime] = useState<number | null>(editing?.one_time_cost ?? null)
  const [monthly, setMonthly] = useState<number | null>(editing?.monthly_cost ?? null)
  const [targetDate, setTargetDate] = useState(editing?.target_date ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = (oneTime ?? 0) + (monthly ?? 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) return setError('Dê um nome ao objetivo.')
    if (total <= 0) return setError('Informe pelo menos um custo — de entrada ou mensal.')
    if (scope === 'business' && !companyId) return setError('Escolha a empresa.')

    const input: ObjectiveInput = {
      scope,
      company_id: scope === 'business' ? companyId : null,
      name: name.trim(),
      one_time_cost: oneTime ?? 0,
      monthly_cost: monthly ?? 0,
      target_date: targetDate || null,
      notes: notes.trim() || null,
      status: 'planned',
    }

    setSaving(true)
    try {
      if (editing) await updateObjective(editing.id, input)
      else await createObjective(input)
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
      title={editing ? 'Editar objetivo' : 'Novo objetivo'}
      description="Informe o custo e eu digo se dá, quanto falta faturar e quando fazer o movimento."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Segmented ariaLabel="Tipo de objetivo" value={scope} onChange={setScope} options={SCOPE_OPTIONS} />

        {scope === 'business' && (
          <FormField label="Empresa" htmlFor="obj-company">
            <Select id="obj-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {businessCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label="O que você quer?" htmlFor="obj-name">
          <Input
            id="obj-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              scope === 'business' ? 'Ex.: Alugar sala comercial no centro' : 'Ex.: Trocar de carro'
            }
            autoFocus
          />
        </FormField>

        <FormField
          label="Custo de entrada"
          htmlFor="obj-onetime"
          hint="Paga uma vez só: caução, mobília, taxa, sinal"
        >
          <CurrencyInput id="obj-onetime" value={oneTime} onChange={setOneTime} />
        </FormField>

        <FormField
          label="Custo mensal"
          htmlFor="obj-monthly"
          hint="Se repete todo mês: aluguel, condomínio, salário, parcela"
        >
          <CurrencyInput id="obj-monthly" value={monthly} onChange={setMonthly} />
        </FormField>

        {monthly != null && monthly > 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-content-muted">
            No primeiro ano isso custa{' '}
            <strong className="text-content">
              {formatCurrency((oneTime ?? 0) + monthly * 12)}
            </strong>{' '}
            — entrada mais doze meses.
          </p>
        )}

        <FormField
          label="Quando você quer (opcional)"
          htmlFor="obj-date"
          hint="Eu comparo com o que os números dizem ser possível"
        >
          <Input
            id="obj-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </FormField>

        <FormField label="Observações (opcional)" htmlFor="obj-notes">
          <Textarea
            id="obj-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes, endereço, condições negociadas…"
          />
        </FormField>

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
            {saving ? <Spinner className="h-5 w-5" /> : editing ? 'Salvar' : 'Criar objetivo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
