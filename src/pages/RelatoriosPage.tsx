import { useMemo, useState } from 'react'
import { Download, Users, Building2 } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Segmented } from '@/components/ui/Segmented'
import { Button } from '@/components/ui/Button'
import { HealthBadge } from '@/components/ui/HealthBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { companyDisplayColor, COMPANY_SHORT_NAME } from '@/assets/companies'
import {
  computeKpis,
  healthFromKpis,
  lastNMonths,
  monthKey,
  monthKeyOf,
  regimeDate,
  sumByContact,
  type Kpis,
} from '@/lib/finance'
import { formatCurrency, formatMonthYear, formatPercent } from '@/lib/format'
import type { Transaction } from '@/types'

type RangeKey = 'mes' | '3m' | '6m' | '12m'
const RANGE_MONTHS: Record<RangeKey, number> = { mes: 1, '3m': 3, '6m': 6, '12m': 12 }

export function RelatoriosPage() {
  const {
    businessCompanies: companies,
    businessTransactions: transactions,
    contacts,
    scopeCompanyId,
    activeCompany,
    period,
    regime,
  } = useAppData()
  const [range, setRange] = useState<RangeKey>('mes')

  const monthKeys = useMemo(
    () => new Set(lastNMonths(period, RANGE_MONTHS[range]).map(monthKey)),
    [period, range],
  )
  const inRange = (t: Transaction) => {
    const d = regimeDate(t, regime)
    return d !== null && monthKeys.has(monthKeyOf(d))
  }

  // DRE do escopo atual
  const scopedTx = useMemo(
    () => transactions.filter((t) => inRange(t) && (scopeCompanyId === null || t.company_id === scopeCompanyId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, monthKeys, scopeCompanyId, regime],
  )
  const dre = useMemo(() => computeKpis(scopedTx), [scopedTx])

  // Comparativo entre empresas
  const rows = useMemo(
    () =>
      companies.map((company) => {
        const kpis = computeKpis(transactions.filter((t) => inRange(t) && t.company_id === company.id))
        return { company, kpis, health: healthFromKpis(kpis) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, transactions, monthKeys],
  )

  // Por contato
  const brokerRep = useMemo(
    () => sumByContact(transactions.filter(inRange), contacts.filter((c) => c.type === 'broker')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, contacts, monthKeys],
  )
  const supplierRep = useMemo(
    () => sumByContact(transactions.filter(inRange), contacts.filter((c) => c.type === 'supplier')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, contacts, monthKeys],
  )

  const periodLabel =
    range === 'mes' ? formatMonthYear(period) : `${RANGE_MONTHS[range]} meses até ${formatMonthYear(period)}`
  const scopeName = activeCompany ? activeCompany.name : 'Grupo (consolidado)'

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-content">Relatórios</h1>
          <p className="text-sm text-content-faint">{periodLabel}</p>
        </div>
        <Segmented
          className="sm:w-auto"
          ariaLabel="Período"
          value={range}
          onChange={setRange}
          options={[
            { value: 'mes', label: 'Mês' },
            { value: '3m', label: '3m' },
            { value: '6m', label: '6m' },
            { value: '12m', label: '12m' },
          ]}
        />
      </div>

      {/* DRE */}
      <Section title={`DRE — ${scopeName}`} subtitle="Demonstração de Resultado do período">
        <DreTable kpis={dre} />
      </Section>

      {/* Comparativo entre empresas */}
      <Section
        title="Comparativo entre empresas"
        action={
          <Button variant="secondary" size="sm" onClick={() => exportComparativo(rows)}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        }
        bodyClassName="pt-1"
      >
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="px-2 py-2 font-medium">Empresa</th>
                <th className="px-2 py-2 text-right font-medium">Receita</th>
                <th className="px-2 py-2 text-right font-medium">Lucro bruto</th>
                <th className="px-2 py-2 text-right font-medium">Lucro líq.</th>
                <th className="px-2 py-2 text-right font-medium">Margem</th>
                <th className="px-2 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const color = companyDisplayColor(r.company.slug, r.company.brand_color, r.company.accent_color)
                return (
                  <tr key={r.company.id}>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium text-content">{COMPANY_SHORT_NAME[r.company.slug]}</span>
                      </div>
                    </td>
                    <td className="tnum px-2 py-2.5 text-right text-income">{formatCurrency(r.kpis.revenue)}</td>
                    <td className="tnum px-2 py-2.5 text-right text-content-muted">{formatCurrency(r.kpis.grossProfit)}</td>
                    <td className={`tnum px-2 py-2.5 text-right font-semibold ${r.kpis.netProfit >= 0 ? 'text-content' : 'text-expense'}`}>
                      {formatCurrency(r.kpis.netProfit)}
                    </td>
                    <td className="tnum px-2 py-2.5 text-right text-content-muted">{formatPercent(r.kpis.netMargin)}</td>
                    <td className="px-2 py-2.5 text-center">
                      <HealthBadge status={r.health} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Por contato */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Repasses por corretor" subtitle="Quanto foi/será pago a cada corretor">
          {brokerRep.length === 0 ? (
            <EmptyState icon={<Users className="h-7 w-7" />} title="Sem repasses no período" />
          ) : (
            <ContactTable rows={brokerRep} kind="repassado" />
          )}
        </Section>
        <Section title="Gastos por fornecedor" subtitle="Quanto foi/será pago a cada fornecedor">
          {supplierRep.length === 0 ? (
            <EmptyState icon={<Building2 className="h-7 w-7" />} title="Sem gastos com fornecedores no período" />
          ) : (
            <ContactTable rows={supplierRep} kind="gasto" />
          )}
        </Section>
      </div>
    </div>
  )
}

function DreTable({ kpis }: { kpis: Kpis }) {
  const rows: { label: string; value: number; kind?: 'sub' | 'total'; sign?: '-' }[] = [
    { label: 'Receita bruta', value: kpis.revenue },
    { label: '(−) Repasses a corretores', value: -kpis.costOfSale, kind: 'sub' },
    { label: 'Lucro bruto', value: kpis.grossProfit, kind: 'total' },
    { label: '(−) Despesas operacionais', value: -kpis.operatingExpense, kind: 'sub' },
    { label: '(−) Despesas variáveis', value: -kpis.variableExpense, kind: 'sub' },
    ...(kpis.otherExpense > 0 ? [{ label: '(−) Outras despesas', value: -kpis.otherExpense, kind: 'sub' as const }] : []),
    { label: 'Lucro líquido', value: kpis.netProfit, kind: 'total' },
    { label: '(−) Retiradas', value: -kpis.withdrawals, kind: 'sub' },
    { label: 'Resultado após retiradas', value: kpis.netProfit - kpis.withdrawals, kind: 'total' },
  ]
  return (
    <div className="space-y-0.5">
      {rows.map((r) => (
        <div
          key={r.label}
          className={
            r.kind === 'total'
              ? 'flex items-center justify-between border-t border-line py-2 font-semibold text-content'
              : 'flex items-center justify-between py-1.5 text-sm text-content-muted'
          }
        >
          <span>{r.label}</span>
          <span className={`tnum ${r.value < 0 ? 'text-expense' : r.kind === 'total' ? 'text-content' : 'text-content'}`}>
            {formatCurrency(r.value)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 text-xs text-content-faint">
        <span>Margem bruta {formatPercent(kpis.grossMargin, 0)}</span>
        <span>Margem líquida {formatPercent(kpis.netMargin, 0)}</span>
      </div>
    </div>
  )
}

function ContactTable({
  rows,
  kind,
}: {
  rows: { contact: { id: string; name: string }; paid: number; pending: number; total: number }[]
  kind: string
}) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.contact.id} className="flex items-center justify-between py-2.5">
          <span className="truncate text-sm font-medium text-content">{r.contact.name}</span>
          <div className="text-right">
            <p className="tnum text-sm font-semibold text-content">{formatCurrency(r.total)}</p>
            <p className="text-[11px] text-content-faint">
              {kind}
              {r.pending > 0 ? ` · ${formatCurrency(r.pending)} pendente` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function exportComparativo(rows: { company: { name: string }; kpis: Kpis }[]) {
  const header = ['Empresa', 'Receita', 'Custos', 'Lucro bruto', 'Despesas', 'Lucro líquido', 'Margem líquida']
  const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const lines = rows.map((r) => [
    r.company.name,
    brl(r.kpis.revenue),
    brl(r.kpis.costOfSale),
    brl(r.kpis.grossProfit),
    brl(r.kpis.operatingExpense + r.kpis.variableExpense + r.kpis.otherExpense),
    brl(r.kpis.netProfit),
    formatPercent(r.kpis.netMargin),
  ])
  const content = [header, ...lines].map((r) => r.map((c) => `"${c}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'relatorio-empresas.csv'
  a.click()
  URL.revokeObjectURL(url)
}
