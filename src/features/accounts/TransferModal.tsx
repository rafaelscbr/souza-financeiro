import { useState, type FormEvent } from 'react'
import { ArrowDown } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Spinner } from '@/components/ui/Spinner'
import { toDateOnly } from '@/lib/format'
import type { Account } from '@/types'

export function TransferModal({
  open,
  accounts,
  onClose,
}: {
  open: boolean
  accounts: Account[]
  onClose: () => void
}) {
  const { createTransfer } = useAppData()

  const [from, setFrom] = useState(accounts[0]?.id ?? '')
  const [to, setTo] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [description, setDescription] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!from || !to) return setError('Escolha as duas contas.')
    if (from === to) return setError('Origem e destino precisam ser contas diferentes.')
    if (!amount || amount <= 0) return setError('Informe um valor maior que zero.')

    setSaving(true)
    try {
      await createTransfer({
        from_account_id: from,
        to_account_id: to,
        amount,
        date,
        description: description.trim() || null,
      })
      setAmount(null)
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível transferir.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transferir entre contas"
      description="Mover dinheiro entre contas suas não é receita nem despesa — não entra no resultado."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="De" htmlFor="tr-from">
          <Select id="tr-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="flex justify-center">
          <ArrowDown className="h-4 w-4 text-content-faint" aria-hidden />
        </div>

        <FormField label="Para" htmlFor="tr-to">
          <Select id="tr-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Valor" htmlFor="tr-amount">
          <CurrencyInput id="tr-amount" value={amount} onChange={setAmount} autoFocus />
        </FormField>

        <FormField label="Data" htmlFor="tr-date">
          <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>

        <FormField label="Descrição (opcional)" htmlFor="tr-desc">
          <Input
            id="tr-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Reserva do mês"
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
            {saving ? <Spinner className="h-5 w-5" /> : 'Transferir'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
