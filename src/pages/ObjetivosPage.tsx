import { useMemo, useState } from 'react'
import {
  Target,
  PlusCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Trash2,
  Pencil,
  Database,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tip } from '@/components/ui/Tip'
import { ObjectiveModal } from '@/features/objectives/ObjectiveModal'
import { deriveCostStructure } from '@/lib/simulator'
import {
  analyzeObjective,
  businessMonthlyResults,
  personalCostStructure,
  personalMonthlyResults,
  type ObjectiveAnalysis,
  type Verdict,
} from '@/lib/objectives'
import { formatCurrency, formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Objective } from '@/types'

const VERDICT: Record<
  Verdict,
  { label: string; icon: typeof CheckCircle2; chip: string; bar: string }
> = {
  go: {
    label: 'Pode fazer',
    icon: CheckCircle2,
    chip: 'bg-income/12 text-income border-income/25',
    bar: 'bg-income',
  },
  wait: {
    label: 'Espere juntar',
    icon: Clock,
    chip: 'bg-pending/12 text-pending border-pending/25',
    bar: 'bg-pending',
  },
  tight: {
    label: 'Apertado',
    icon: AlertTriangle,
    chip: 'bg-pending/12 text-pending border-pending/25',
    bar: 'bg-pending',
  },
  grow_first: {
    label: 'Cresça antes',
    icon: TrendingUp,
    chip: 'bg-critical/12 text-critical border-critical/25',
    bar: 'bg-critical',
  },
}

export function ObjetivosPage() {
  const {
    objectives,
    migrationApplied,
    businessTransactions,
    personalTransactions,
    businessCompanies,
    companies,
    period,
    regime,
    deleteObjective,
  } = useAppData()

  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<Objective | null>(null)

  const analyses = useMemo<ObjectiveAnalysis[]>(
    () =>
      objectives
        .filter((o) => o.status === 'planned')
        .map((o) => {
          if (o.scope === 'personal') {
            return analyzeObjective(
              o,
              personalMonthlyResults(personalTransactions, businessTransactions, period, regime),
              period,
              personalCostStructure(personalTransactions, businessTransactions, period),
            )
          }
          return analyzeObjective(
            o,
            businessMonthlyResults(
              businessTransactions,
              o.company_id,
              period,
              businessCompanies,
              regime,
            ),
            period,
            deriveCostStructure(
              businessTransactions,
              o.company_id,
              period,
              businessCompanies,
            ),
          )
        }),
    [objectives, personalTransactions, businessTransactions, businessCompanies, period, regime],
  )

  const achieved = objectives.filter((o) => o.status === 'achieved')

  function openNew() {
    setEditing(null)
    setComposing(true)
  }

  if (!migrationApplied) {
    return (
      <div className="animate-fade-in space-y-5">
        <Header />
        <EmptyState
          icon={<Database className="h-8 w-8" />}
          title="Falta aplicar a migração do banco"
          description="Os objetivos precisam de uma tabela nova no Supabase. Abra o SQL Editor, cole o conteúdo de supabase/migrations/001_dre_impostos_e_objetivos.sql e clique em Run. Depois recarregue esta tela."
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-3">
        <Header />
        <Button size="sm" onClick={openNew}>
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Novo objetivo</span>
        </Button>
      </div>

      {analyses.length === 0 ? (
        <EmptyState
          icon={<Target className="h-8 w-8" />}
          title="Nenhum objetivo em andamento"
          description="Cadastre algo que você quer conquistar — alugar uma sala, contratar um assistente, trocar de carro — com o custo de entrada e o custo mensal. Eu cruzo com o seu resultado real e digo se dá, quanto falta faturar e quando fazer o movimento."
          action={
            <Button onClick={openNew}>
              <PlusCircle className="h-4 w-4" />
              Criar primeiro objetivo
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {analyses.map((a) => (
            <ObjectiveCard
              key={a.objective.id}
              analysis={a}
              companyName={
                companies.find((c) => c.id === a.objective.company_id)?.name ?? 'Pessoal'
              }
              onEdit={() => {
                setEditing(a.objective)
                setComposing(true)
              }}
              onDelete={() => deleteObjective(a.objective.id)}
            />
          ))}
        </div>
      )}

      {achieved.length > 0 && (
        <Section title="Conquistados" subtitle={`${achieved.length} objetivo(s)`} bodyClassName="pt-1">
          <ul className="divide-y divide-line">
            {achieved.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-income" />
                <span className="flex-1 text-sm text-content">{o.name}</span>
                <span className="tnum text-xs text-content-faint">
                  {formatCurrency(o.one_time_cost + o.monthly_cost)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <ObjectiveModal
        open={composing}
        editing={editing}
        onClose={() => {
          setComposing(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold text-content">
        Objetivos
        <Tip label="Como o sistema decide" align="start">
          Cada objetivo é julgado contra o seu <strong className="text-content">pior mês</strong> do
          período, não contra a média. Comissão é receita irregular — compromisso fixo aprovado pela
          média quebra no primeiro mês fraco.
        </Tip>
      </h1>
      <p className="text-sm text-content-faint">
        O que você quer conquistar, e quando dá para fazer
      </p>
    </div>
  )
}

function ObjectiveCard({
  analysis: a,
  companyName,
  onEdit,
  onDelete,
}: {
  analysis: ObjectiveAnalysis
  companyName: string
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const v = VERDICT[a.verdict]
  const Icon = v.icon
  const o = a.objective

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className={cn('h-1', v.bar)} aria-hidden />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-content">{o.name}</h2>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                  v.chip,
                )}
              >
                <Icon className="h-3 w-3" />
                {v.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-content-faint">
              {o.scope === 'personal' ? 'Pessoal' : companyName}
              {o.one_time_cost > 0 && ` · entrada ${formatCurrency(o.one_time_cost)}`}
              {o.monthly_cost > 0 && ` · ${formatCurrency(o.monthly_cost)}/mês`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {confirming ? (
              <>
                <button
                  onClick={onDelete}
                  className="rounded-lg bg-expense/15 px-2 py-1 text-xs font-medium text-expense"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded-lg px-2 py-1 text-xs text-content-muted hover:bg-surface-2"
                >
                  Não
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onEdit}
                  className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-content"
                  aria-label={`Editar ${o.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-expense"
                  aria-label={`Excluir ${o.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Veredito */}
        <p className="mt-3 text-[15px] font-semibold text-content">{a.headline}</p>

        <ul className="mt-2 space-y-1.5">
          {a.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-sm text-content-muted">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-content-faint" aria-hidden />
              <span>{r}</span>
            </li>
          ))}
        </ul>

        {/* Números de apoio */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 lg:grid-cols-4">
          <Stat label="Sobra média hoje" value={formatCurrency(a.avgMonthlyProfit)} />
          <Stat
            label="Sobra depois do custo"
            value={formatCurrency(a.surplusAfter)}
            tone={a.surplusAfter >= 0 ? 'text-income' : 'text-expense'}
          />
          <Stat
            label="Faturamento necessário"
            value={isFinite(a.revenueNeeded) ? formatCurrency(a.revenueNeeded) : '—'}
            hint={
              a.revenueGap > 0 ? `+${formatCurrency(a.revenueGap)} que hoje` : 'já alcançado'
            }
          />
          <Stat
            label="Pronto em"
            value={
              a.monthsToSave == null
                ? '—'
                : a.monthsToSave === 0
                  ? 'agora'
                  : `${a.monthsToSave} ${a.monthsToSave === 1 ? 'mês' : 'meses'}`
            }
            hint={a.readyDate && a.monthsToSave ? formatMonthYear(a.readyDate) : undefined}
          />
        </div>

        {a.objective.monthly_cost > 0 && (
          <p className="mt-3 text-xs text-content-faint">
            Reserva recomendada antes de assumir:{' '}
            <strong className="text-content-muted">
              {formatCurrency(a.recommendedReserve)}
            </strong>{' '}
            (3 meses de custo fixo). Novo ponto de equilíbrio:{' '}
            <strong className="text-content-muted">
              {isFinite(a.newBreakEven) ? formatCurrency(a.newBreakEven) : '—'}
            </strong>
            .
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = 'text-content',
}: {
  label: string
  value: string
  hint?: string
  tone?: string
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-content-faint">{label}</p>
      <p className={cn('tnum text-sm font-bold', tone)}>{value}</p>
      {hint && <p className="truncate text-[11px] text-content-faint">{hint}</p>}
    </div>
  )
}
