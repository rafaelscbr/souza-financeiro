import { useMemo, useState } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { resolveBudgets } from '@/lib/budgets'
import { firstDayOfMonth } from '@/lib/finance'
import { formatMonthYear } from '@/lib/format'

/**
 * Orçamento por categoria em dois níveis: o limite PADRÃO vale todo mês; o
 * ajuste do MÊS vence o padrão só naquele mês (viagem em julho, 13º em
 * dezembro). Preserva histórico: mudar o padrão não reescreve meses passados
 * que tinham ajuste próprio.
 */
export function BudgetEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { personalCompany, categories, personalBudgets, personalReady, period, savePersonalBudget } =
    useAppData()

  const [scope, setScope] = useState<'default' | 'month'>('default')
  const monthKey = firstDayOfMonth(period)

  const expenseCategories = useMemo(
    () =>
      categories
        .filter((c) => c.company_id === personalCompany?.id && c.kind === 'expense')
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, personalCompany],
  )

  // Os dois baselines são calculados sempre: salvar precisa comparar cada
  // escopo com o SEU valor original, não só o que está na tela.
  const baselines = useMemo(() => {
    const def: Record<string, number | null> = {}
    for (const c of expenseCategories) {
      def[c.name] =
        personalBudgets.find((b) => b.category === c.name && b.month === null)?.monthly_limit ?? null
    }
    // No modo mês, parte do valor EFETIVO (ajuste do mês, senão o padrão).
    const resolved = resolveBudgets(personalBudgets, monthKey)
    const mon: Record<string, number | null> = {}
    for (const c of expenseCategories) {
      mon[c.name] = resolved.find((b) => b.category === c.name)?.limit ?? null
    }
    return { default: def, month: mon }
  }, [expenseCategories, personalBudgets, monthKey])

  const initial = baselines[scope]

  const [edits, setEdits] = useState<Record<string, Record<string, number | null>>>({})
  const values = { ...initial, ...(edits[scope] ?? {}) }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setValue(name: string, v: number | null) {
    setEdits((prev) => ({ ...prev, [scope]: { ...(prev[scope] ?? {}), [name]: v } }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      // Percorre os DOIS escopos: quem edita o padrão, troca para "este mês" e
      // salva não pode perder o que digitou antes.
      for (const s of ['default', 'month'] as const) {
        const changed = edits[s] ?? {}
        for (const name of Object.keys(changed)) {
          const next = changed[name] ?? 0
          const prev = baselines[s][name] ?? 0
          if (next !== prev) {
            await savePersonalBudget(name, next, s === 'month' ? monthKey : null)
          }
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o orçamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Orçamento mensal"
      description="Defina um limite de gasto por categoria. Deixe em branco para não limitar."
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="h-5 w-5" /> : 'Salvar orçamento'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {personalReady && (
          <Segmented
            ariaLabel="Escopo do orçamento"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'default', label: 'Todo mês (padrão)' },
              { value: 'month', label: `Só ${formatMonthYear(period)}` },
            ]}
          />
        )}
        {scope === 'month' && (
          <p className="text-xs text-content-faint">
            O ajuste vale só para {formatMonthYear(period)} e vence o padrão. Os outros meses
            continuam com o limite padrão.{' '}
            <strong className="font-medium text-content-muted">
              Apagar o valor remove o ajuste
            </strong>{' '}
            e a categoria volta a usar o limite padrão.
          </p>
        )}

        <div className="space-y-3">
          {expenseCategories.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <label htmlFor={`b-${c.id}`} className="flex flex-1 items-center gap-2 text-sm text-content">
                {c.icon && <span aria-hidden>{c.icon}</span>}
                {c.name}
              </label>
              <div className="w-40">
                <CurrencyInput
                  id={`b-${c.id}`}
                  value={values[c.name] ?? null}
                  onChange={(v) => setValue(c.name, v)}
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
