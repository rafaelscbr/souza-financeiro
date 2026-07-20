import { useMemo, useState } from 'react'
import { Check, Layers } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Button } from '@/components/ui/Button'
import { Tip } from '@/components/ui/Tip'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Progress } from '@/components/ui/Progress'
import { companyDisplayColor } from '@/assets/companies'
import {
  computeKpisMulti,
  filterTransactions,
  findGoal,
  firstDayOfMonth,
} from '@/lib/finance'
import { formatCurrency, formatMonthYear, formatPercent } from '@/lib/format'
import type { Kpis } from '@/lib/finance'

export function MetasPage() {
  const { businessCompanies, period, scopeCompanyId, activeCompany } = useAppData()
  const monthKey = firstDayOfMonth(period)

  // Segue o escopo do topo: com uma empresa selecionada, só a meta dela.
  const shown = activeCompany
    ? businessCompanies.filter((c) => c.id === scopeCompanyId)
    : businessCompanies

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-content">
          Orçamento
          <Tip label="Diferença entre orçamento e objetivo" align="start">
            <strong className="text-content">Orçamento</strong> é a meta de receita e lucro deste
            mês — o que você planeja alcançar na operação normal.
            <span className="mt-1.5 block">
              <strong className="text-content">Objetivo</strong> é uma conquista com custo, como
              alugar uma sala. Fica na tela de Objetivos.
            </span>
          </Tip>
        </h1>
        <p className="text-sm text-content-faint">
          {activeCompany ? activeCompany.name : 'Grupo e empresas'} · {formatMonthYear(period)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* A meta do grupo só faz sentido na visão consolidada. */}
        {!activeCompany && (
          <GoalCard
            key={`group-${monthKey}`}
            companyId={null}
            name="Grupo (consolidado)"
            color="#10B981"
            isGroup
          />
        )}
        {shown.map((c) => (
          <GoalCard
            key={`${c.id}-${monthKey}`}
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
  const { businessTransactions, businessCompanies, goals, period, regime, saveGoal, deleteGoal } =
    useAppData()

  const kpis: Kpis = useMemo(
    () =>
      computeKpisMulti(
        filterTransactions(businessTransactions, companyId, period, regime),
        businessCompanies,
      ),
    [businessTransactions, businessCompanies, companyId, period, regime],
  )

  const existingRevenue = findGoal(goals, companyId, period, 'monthly_revenue')
  const existingProfit = findGoal(goals, companyId, period, 'monthly_profit')

  const [revenueTarget, setRevenueTarget] = useState<number | null>(
    existingRevenue ? existingRevenue.target_value : null,
  )
  const [profitTarget, setProfitTarget] = useState<number | null>(
    existingProfit ? existingProfit.target_value : null,
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const month = firstDayOfMonth(period)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const rev = revenueTarget ?? 0
      if (rev > 0)
        await saveGoal({ company_id: companyId, metric: 'monthly_revenue', target_value: rev, month })
      else if (existingRevenue) await deleteGoal(existingRevenue.id)

      const prof = profitTarget ?? 0
      if (prof > 0)
        await saveGoal({ company_id: companyId, metric: 'monthly_profit', target_value: prof, month })
      else if (existingProfit) await deleteGoal(existingProfit.id)

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

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
          value={revenueTarget}
          onChange={setRevenueTarget}
          current={kpis.revenue}
          color={color}
        />
        <GoalInput
          label="Meta de lucro"
          value={profitTarget}
          onChange={setProfitTarget}
          current={kpis.netProfit}
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
  color,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  current: number
  color: string
}) {
  const target = value ?? 0
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
      <CurrencyInput value={value} onChange={onChange} />
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
