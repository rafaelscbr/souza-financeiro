import { useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { dreGroupOf } from '@/lib/finance'
import { formatCurrency, toDateOnly } from '@/lib/format'
import type { Transaction } from '@/types'

/**
 * Dar baixa: confirmar que o dinheiro entrou ou saiu, e em qual conta.
 * Antes disso exigia abrir o formulário completo de edição.
 */
export function SettleModal({
  tx,
  onClose,
}: {
  tx: Transaction | null
  onClose: () => void
}) {
  const { accounts, treasuryReady, settleTransaction } = useAppData()

  const available = tx ? accounts.filter((a) => a.is_active && a.company_id === tx.company_id) : []

  const [accountId, setAccountId] = useState<string>('')
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!tx) return null

  const isIn = dreGroupOf(tx) === 'revenue'
  const verb = isIn ? 'Recebimento' : 'Pagamento'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!tx) return
    setError(null)
    setSaving(true)
    try {
      await settleTransaction(tx.id, accountId || null, date)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível dar baixa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!tx}
      onClose={onClose}
      title={`Confirmar ${verb.toLowerCase()}`}
      description={`${tx.category} · ${formatCurrency(tx.amount)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <CheckCircle2 className={isIn ? 'h-5 w-5 text-income' : 'h-5 w-5 text-expense'} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-content">
              {tx.description || tx.category}
            </p>
            <p className="tnum text-sm font-bold text-content">{formatCurrency(tx.amount)}</p>
          </div>
        </div>

        <FormField
          label={`Data do ${isIn ? 'recebimento' : 'pagamento'}`}
          htmlFor="settle-date"
          hint="Quando o dinheiro se moveu de fato"
        >
          <Input
            id="settle-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            autoFocus
          />
        </FormField>

        {treasuryReady && (
          <FormField
            label="Conta"
            htmlFor="settle-account"
            hint={
              available.length === 0
                ? 'Nenhuma conta cadastrada para esta empresa — cadastre em Contas'
                : `Em qual conta o dinheiro ${isIn ? 'entrou' : 'saiu'}`
            }
          >
            <Select
              id="settle-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={available.length === 0}
            >
              <option value="">Definir depois</option>
              {available.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
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
            {saving ? <Spinner className="h-5 w-5" /> : `Confirmar ${verb.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
