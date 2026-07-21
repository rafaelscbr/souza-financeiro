import { useMemo, useState, type FormEvent } from 'react'
import { Settings2, Bookmark, BookmarkPlus, X } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, toDateOnly } from '@/lib/format'
import type { TransactionInput, TransactionKind, TransactionTemplate } from '@/types'

const KIND_OPTIONS: { value: Exclude<TransactionKind, 'withdrawal'>; label: string; activeClass: string }[] = [
  { value: 'income', label: 'Entrou', activeClass: 'bg-income/12 text-income border border-income/25' },
  { value: 'expense', label: 'Saiu', activeClass: 'bg-expense/12 text-expense border border-expense/25' },
]

/**
 * Lançamento em poucos toques para o dia a dia: valor, categoria, salvar.
 * Assume que o dinheiro JÁ se moveu (liquidado hoje) — o caso mais comum.
 * Para venda, parcelamento ou "a receber", o botão leva ao formulário completo.
 */
export function QuickEntryForm({
  submitting,
  error,
  onSubmit,
  onSwitchToFull,
  onCancel,
}: {
  submitting: boolean
  error: string | null
  onSubmit: (rows: TransactionInput[]) => void
  onSwitchToFull: () => void
  onCancel: () => void
}) {
  const { businessCompanies, categories, scopeCompanyId, templates, templatesReady, createTemplate } =
    useAppData()

  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [companyId, setCompanyId] = useState(scopeCompanyId ?? businessCompanies[0]?.id ?? '')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [localError, setLocalError] = useState<string | null>(null)

  // Modelos aplicáveis: do escopo atual (ou sem empresa), só receita/despesa.
  const myTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          (t.kind === 'income' || t.kind === 'expense') &&
          (t.company_id === null || t.company_id === companyId),
      ),
    [templates, companyId],
  )
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const availableCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === kind && (c.company_id === null || c.company_id === companyId))
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, kind, companyId],
  )
  const [category, setCategory] = useState(availableCategories[0]?.name ?? '')

  // Mantém a categoria válida ao trocar de tipo/empresa.
  const categoryValid = availableCategories.some((c) => c.name === category)
  const resolvedCategory = categoryValid ? category : availableCategories[0]?.name ?? ''

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (!companyId) return setLocalError('Escolha a empresa.')
    if (!resolvedCategory) return setLocalError('Escolha a categoria.')
    if (!amount || amount <= 0) return setLocalError('Informe um valor maior que zero.')

    const cat = availableCategories.find((c) => c.name === resolvedCategory)
    const row: TransactionInput = {
      company_id: companyId,
      kind,
      category: resolvedCategory,
      dre_group: kind === 'income' ? 'revenue' : (cat?.dre_group ?? 'variable_expense'),
      description: '',
      amount,
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
      account_id: null,
    }
    onSubmit([row])
  }

  function applyTemplate(t: TransactionTemplate) {
    if (t.kind === 'income' || t.kind === 'expense') setKind(t.kind)
    if (t.company_id) setCompanyId(t.company_id)
    setCategory(t.category)
    if (t.amount != null) setAmount(t.amount)
  }

  async function saveTemplate() {
    const cat = resolvedCategory
    if (!cat) return setLocalError('Escolha a categoria antes de salvar o modelo.')
    const name = templateName.trim() || cat
    const dreGroup =
      kind === 'income' ? 'revenue' : availableCategories.find((c) => c.name === cat)?.dre_group ?? 'variable_expense'
    try {
      await createTemplate({
        company_id: scopeCompanyId ? companyId : null,
        name,
        kind,
        category: cat,
        dre_group: dreGroup,
        amount: amount ?? null,
        contact_id: null,
        sort_order: 0,
      })
      setSavingTemplate(false)
      setTemplateName('')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Não foi possível salvar o modelo.')
    }
  }

  const shownError = localError ?? error
  const showCompany = scopeCompanyId === null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Modelos salvos — um toque preenche tipo, categoria e valor */}
      {templatesReady && myTemplates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {myTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-content-muted transition-colors hover:border-emerald/40 hover:text-content"
            >
              <Bookmark className="h-3 w-3" />
              {t.name}
              {t.amount != null && (
                <span className="text-content-faint">· {formatCurrency(t.amount)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <Segmented ariaLabel="Entrou ou saiu" value={kind} onChange={setKind} options={KIND_OPTIONS} />

      <FormField label="Valor" htmlFor="q-amount">
        <CurrencyInput id="q-amount" value={amount} onChange={setAmount} autoFocus />
      </FormField>

      <div className={showCompany ? 'grid grid-cols-2 gap-3' : ''}>
        {showCompany && (
          <FormField label="Empresa" htmlFor="q-company">
            <Select id="q-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {businessCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Categoria" htmlFor="q-category">
          <Select id="q-category" value={resolvedCategory} onChange={(e) => setCategory(e.target.value)}>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Data" htmlFor="q-date">
        <Input id="q-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormField>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSwitchToFull}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
        >
          <Settings2 className="h-4 w-4" />
          Mais opções
        </button>
        {templatesReady && (
          <button
            type="button"
            onClick={() => setSavingTemplate((v) => !v)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
            title="Salvar como modelo"
          >
            <BookmarkPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Salvar modelo</span>
          </button>
        )}
      </div>

      {/* Salvar como modelo — nome opcional */}
      {savingTemplate && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-2">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={`Nome do modelo (ex.: ${resolvedCategory || 'Contador'})`}
            aria-label="Nome do modelo"
            autoFocus
          />
          <Button type="button" size="sm" onClick={saveTemplate} className="h-11 shrink-0">
            Salvar
          </Button>
          <button
            type="button"
            onClick={() => setSavingTemplate(false)}
            className="shrink-0 rounded-lg p-2 text-content-faint hover:bg-surface-2"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {shownError && (
        <p className="text-sm text-expense" role="alert">
          {shownError}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? <Spinner className="h-5 w-5" /> : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
