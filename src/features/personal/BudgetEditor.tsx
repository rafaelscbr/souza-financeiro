import { useMemo, useState } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Spinner } from '@/components/ui/Spinner'

export function BudgetEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { personalCompany, categories, personalBudgets, savePersonalBudget } = useAppData()

  const expenseCategories = useMemo(
    () =>
      categories
        .filter((c) => c.company_id === personalCompany?.id && c.kind === 'expense')
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, personalCompany],
  )

  const initial = useMemo(() => {
    const map: Record<string, number | null> = {}
    for (const c of expenseCategories) {
      map[c.name] = personalBudgets.find((b) => b.category === c.name)?.monthly_limit ?? null
    }
    return map
  }, [expenseCategories, personalBudgets])

  const [values, setValues] = useState<Record<string, number | null>>(initial)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      for (const c of expenseCategories) {
        const next = values[c.name] ?? 0
        const prev = initial[c.name] ?? 0
        if (next !== prev) await savePersonalBudget(c.name, next)
      }
      onClose()
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
      <div className="space-y-3">
        {expenseCategories.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <label htmlFor={`b-${c.id}`} className="flex-1 text-sm text-content">
              {c.name}
            </label>
            <div className="w-40">
              <CurrencyInput
                id={`b-${c.id}`}
                value={values[c.name] ?? null}
                onChange={(v) => setValues((prev) => ({ ...prev, [c.name]: v }))}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
