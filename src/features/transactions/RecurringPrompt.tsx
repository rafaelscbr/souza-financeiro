import { useMemo, useState } from 'react'
import { RefreshCw, Check } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Tip } from '@/components/ui/Tip'
import { buildRecurringInput, pendingRecurring } from '@/lib/recurring'
import { formatCurrency, formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Oferece lançar as despesas fixas que faltam no mês. Some sozinho quando
 * não há nada pendente — e nunca lança sozinho: o dono confere antes.
 */
export function RecurringPrompt() {
  const { businessTransactions, scopeCompanyId, companies, period, createTransactions } = useAppData()

  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidates = useMemo(
    () => pendingRecurring(businessTransactions, scopeCompanyId, period),
    [businessTransactions, scopeCompanyId, period],
  )

  if (candidates.length === 0) return null

  // Por padrão vem tudo marcado — o caso comum é lançar todas.
  const chosen = selected ?? new Set(candidates.map((c) => c.template.id))
  const total = candidates
    .filter((c) => chosen.has(c.template.id))
    .reduce((s, c) => s + c.template.amount, 0)

  function toggle(id: string) {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function generate() {
    setSaving(true)
    setError(null)
    try {
      const inputs = candidates
        .filter((c) => chosen.has(c.template.id))
        .map((c) => buildRecurringInput(c, period))
      await createTransactions(inputs)
      setSelected(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível lançar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brandblue/20 bg-brandblue-soft/60 p-4">
      <div className="mb-3 flex items-start gap-2">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-brandblue" />
        <div className="flex-1">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-content">
            Despesas fixas de {formatMonthYear(period)}
            <Tip label="Como as despesas fixas funcionam">
              Toda despesa marcada como <strong className="text-content">fixa</strong> no
              formulário aparece aqui no mês seguinte, com o mesmo valor e dia de vencimento.
              <span className="mt-1.5 block">
                Elas nascem como <strong className="text-content">a pagar</strong>, não como pagas
                — marcar sem que o dinheiro tenha saído descolaria o saldo do extrato.
              </span>
            </Tip>
          </h2>
          <p className="text-xs text-content-muted">
            {candidates.length} {candidates.length === 1 ? 'conta ainda não lançada' : 'contas ainda não lançadas'} neste mês
          </p>
        </div>
      </div>

      <ul className="mb-3 space-y-1">
        {candidates.map((c) => {
          const isOn = chosen.has(c.template.id)
          const company = companies.find((co) => co.id === c.template.company_id)
          return (
            <li key={c.template.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2">
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    isOn ? 'border-brandblue bg-brandblue text-white' : 'border-line bg-surface',
                  )}
                >
                  {isOn && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isOn}
                  onChange={() => toggle(c.template.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-content">{c.template.category}</span>
                  <span className="block truncate text-[11px] text-content-faint">
                    {[c.template.description, !scopeCompanyId ? company?.name : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="tnum shrink-0 text-sm font-semibold text-content">
                  {formatCurrency(c.template.amount)}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="mb-2 text-sm text-expense" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-content-muted">
          Total: <strong className="tnum text-content">{formatCurrency(total)}</strong>
        </span>
        <Button size="sm" onClick={generate} disabled={saving || chosen.size === 0}>
          {saving ? <Spinner className="h-4 w-4" /> : `Lançar ${chosen.size}`}
        </Button>
      </div>
    </div>
  )
}
