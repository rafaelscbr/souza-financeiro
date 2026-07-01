import { useMemo, useState } from 'react'
import { Check, Layers } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Progress } from '@/components/ui/Progress'
import { companyDisplayColor } from '@/assets/companies'
import {
  computeKpis,
  filterTransactions,
  findGoal,
  firstDayOfMonth,
} from '@/lib/finance'
import { formatCurrency, formatMonthYear, formatPercent, parseAmountInput } from '@/lib/format'
import type { Kpis } from '@/lib/finance'

export function MetasPage() {
  const { companies, period } = useAppData()

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-content">Metas</h1>
        <p className="text-sm text-content-faint">
          Metas de {formatMonthYear(period)} · receita e lucro mensais
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GoalCard companyId={null} name="Grupo (consolidado)" color="#10B981" isGroup />
        {companies.map((c) => (
          <GoalCard
            key={c.id}
            companyId={c.id}
            name={c.name}
            color={companyDisplayColor(c.slug, c.brand_color, c.accent_color)}
          />
        ))}
      </div>
    </div>
  )
}

function GoalCard({
  companyId,
  name,
  color,
  isGroup = false,
}: {
  companyId: string | null
  name: string
  color: string
  isGroup?: boolean
}) {
  const { transactions, goals, period, saveGoal, deleteGoal } = useAppData()

  const kpis: Kpis = useMemo(
    () => computeKpis(filterTransactions(transactions, companyId, period)),
    [transactions, companyId, period],
  )

  const existingRevenue = findGoal(goals, companyId, period, 'monthly_revenue')
  const existingProfit = findGoal(goals, companyId, period, 'monthly_profit')

  const [revenueStr, setRevenueStr] = useState(
    existingRevenue ? String(existingRevenue.target_value).replace('.', ',') : '',
  )
  const [profitStr, setProfitStr] = useState(
    existingProfit ? String(existingProfit.target_value).replace('.', ',') : '',
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const month = firstDayOfMonth(period)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const rev = parseAmountInput(revenueStr)
      if (rev > 0)
        await saveGoal({ company_id: companyId, metric: 'monthly_revenue', target_value: rev, month })
      else if (existingRevenue) await deleteGoal(existingRevenue.id)

      const prof = parseAmountInput(profitStr)
      if (prof > 0)
        await saveGoal({ company_id: companyId, metric: 'monthly_profit', target_value: prof, month })
      else if (existingProfit) await deleteGoal(existingProfit.id)

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const revTarget = parseAmountInput(revenueStr)
  const profTarget = parseAmountInput(profitStr)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="mb-4 flex items-center gap-2">
        {isGroup ? (
          <Layers className="h-4 w-4" style={{ color }} />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        )}
        <h2 className="text-sm font-semibold text-content">{name}</h2>
      </div>

      <div className="space-y-4">
        <GoalInput
          label="Meta de receita"
          value={revenueStr}
          onChange={setRevenueStr}
          current={kpis.revenue}
          target={revTarget}
          color={color}
        />
        <GoalInput
          label="Meta de lucro"
          value={profitStr}
          onChange={setProfitStr}
          current={kpis.netProfit}
          target={profTarget}
          color={color}
        />
      </div>

      <Button
        className="mt-4 w-full"
        variant={saved ? 'primary' : 'secondary'}
        onClick={handleSave}
        disabled={saving}
      >
        {saved ? (
          <>
            <Check className="h-4 w-4" /> Salvo
          </>
        ) : saving ? (
          'Salvando…'
        ) : (
          'Salvar metas'
        )}
      </Button>
    </div>
  )
}

function GoalInput({
  label,
  value,
  onChange,
  current,
  target,
  color,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  current: number
  target: number
  color: string
}) {
  const pct = target > 0 ? current / target : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-content-muted">{label}</label>
        {target > 0 && (
          <span className="text-xs font-medium" style={{ color }}>
            {formatPercent(pct, 0)}
          </span>
        )}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-content-faint">
          R$
        </span>
        <Input
          inputMode="decimal"
          className="pl-9 tnum"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
        />
      </div>
      {target > 0 && (
        <div className="mt-2">
          <Progress value={pct} color={color} />
          <p className="mt-1 text-xs text-content-faint">
            Realizado: <span className="tnum text-content-muted">{formatCurrency(current)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
