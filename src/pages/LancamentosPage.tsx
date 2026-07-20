import { useMemo, useState } from 'react'
import { Download, Search, Inbox, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tip } from '@/components/ui/Tip'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useComposer } from '@/features/transactions/TransactionComposer'
import { RecurringPrompt } from '@/features/transactions/RecurringPrompt'
import {
  dreGroupOf,
  inScope,
  lastNMonths,
  listingDate,
  monthKey,
  monthKeyOf,
} from '@/lib/finance'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

type TypeFilter = 'all' | 'revenue' | 'cost_of_sale' | 'expense' | 'withdrawal'
type RangeFilter = 'mes' | '3m' | '12m' | 'tudo'
type StatusTab = 'all' | 'settled' | 'receivable' | 'payable' | 'overdue'

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'settled', label: 'Liquidados' },
  { value: 'receivable', label: 'A receber' },
  { value: 'payable', label: 'A pagar' },
  { value: 'overdue', label: 'Vencidos' },
]

export function LancamentosPage() {
  // O escopo do topo manda: nada de filtro de empresa duplicado aqui dentro.
  const {
    businessTransactions: transactions,
    businessCompanies: companies,
    contacts,
    period,
    regime,
    scopeCompanyId,
    activeCompany,
  } = useAppData()
  const { openNew } = useComposer()

  const [search, setSearch] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [contactId, setContactId] = useState('all')
  const [range, setRange] = useState<RangeFilter>('3m')

  const today = toDateOnly(new Date())

  const monthKeys = useMemo(() => {
    if (range === 'tudo') return null
    const n = range === 'mes' ? 1 : range === '3m' ? 3 : 12
    return new Set(lastNMonths(period, n).map(monthKey))
  }, [range, period])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (!inScope(t, scopeCompanyId)) return false
      if (monthKeys && !monthKeys.has(monthKeyOf(listingDate(t, regime)))) return false
      if (contactId !== 'all' && t.contact_id !== contactId) return false

      if (statusTab !== 'all') {
        const isRevenue = dreGroupOf(t) === 'revenue'
        const due = t.due_date ?? t.competence_date
        if (statusTab === 'settled' && t.status !== 'settled') return false
        if (statusTab === 'receivable' && !(t.status === 'pending' && isRevenue)) return false
        if (statusTab === 'payable' && !(t.status === 'pending' && !isRevenue)) return false
        if (statusTab === 'overdue' && !(t.status === 'pending' && due < today)) return false
      }

      if (type !== 'all') {
        const g = dreGroupOf(t)
        if (type === 'revenue' && g !== 'revenue') return false
        if (type === 'cost_of_sale' && g !== 'cost_of_sale') return false
        if (type === 'withdrawal' && g !== 'withdrawal') return false
        if (type === 'expense' && !['operating_expense', 'variable_expense'].includes(g)) return false
      }

      if (q) {
        const contact = contacts.find((c) => c.id === t.contact_id)?.name ?? ''
        const hay = `${t.category} ${t.description} ${contact}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [transactions, scopeCompanyId, monthKeys, regime, contactId, statusTab, type, search, contacts, today])

  const totals = useMemo(() => {
    let inflow = 0
    let outflow = 0
    for (const t of filtered) {
      if (dreGroupOf(t) === 'revenue') inflow += t.amount
      else outflow += t.amount
    }
    return { inflow, outflow, balance: inflow - outflow }
  }, [filtered])

  const overdueCount = useMemo(
    () =>
      transactions.filter(
        (t) => inScope(t, scopeCompanyId) && t.status === 'pending' && (t.due_date ?? t.competence_date) < today,
      ).length,
    [transactions, scopeCompanyId, today],
  )

  const scopeName = activeCompany ? activeCompany.name : 'Todas as empresas'
  const dateWord = regime === 'cash' ? 'data do dinheiro' : 'mês de competência'

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Lançamentos</h1>
          <p className="flex items-center gap-1.5 text-sm text-content-faint">
            <span>
              {scopeName} · {filtered.length}{' '}
              {filtered.length === 1 ? 'lançamento' : 'lançamentos'} por {dateWord}
            </span>
            <Tip label="Como esta lista é ordenada" align="start">
              {regime === 'cash' ? (
                <>
                  No regime de <strong className="text-content">caixa</strong>, cada lançamento
                  aparece no mês em que o dinheiro se move. Uma comissão fechada em julho e paga em
                  setembro fica em <strong className="text-content">setembro</strong>.
                </>
              ) : (
                <>
                  No regime de <strong className="text-content">competência</strong>, cada lançamento
                  aparece no mês da venda. Uma comissão fechada em julho e paga em setembro fica em{' '}
                  <strong className="text-content">julho</strong>, marcada como “a receber”.
                </>
              )}
            </Tip>
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleExport(filtered, companies, contacts, regime)}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">CSV</span>
        </Button>
      </div>

      <RecurringPrompt />

      {/* Abas de situação */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Situação">
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab.value
          const isOverdue = tab.value === 'overdue'
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active}
              onClick={() => setStatusTab(tab.value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-transparent bg-content text-white'
                  : 'border-line bg-surface text-content-muted hover:bg-surface-2 hover:text-content',
              )}
            >
              {isOverdue && overdueCount > 0 && (
                <AlertTriangle className={cn('h-3.5 w-3.5', active ? 'text-white' : 'text-critical')} />
              )}
              {tab.label}
              {isOverdue && overdueCount > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-bold',
                    active ? 'bg-white/20' : 'bg-critical/15 text-critical',
                  )}
                >
                  {overdueCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <Input
            className="pl-9"
            placeholder="Buscar por categoria, descrição ou contato…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label="Tipo">
            <option value="all">Todos os tipos</option>
            <option value="revenue">Receitas</option>
            <option value="cost_of_sale">Comissões de corretores</option>
            <option value="expense">Despesas</option>
            <option value="withdrawal">Retiradas</option>
          </Select>
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label="Contato">
            <option value="all">Todos contatos</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="col-span-2 lg:col-span-1">
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeFilter)}
              aria-label="Período"
            >
              <option value="mes">Mês em foco</option>
              <option value="3m">Últimos 3 meses</option>
              <option value="12m">Últimos 12 meses</option>
              <option value="tudo">Todo o período</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <TotalPill label="Entradas" value={totals.inflow} tone="text-income" />
        <TotalPill label="Saídas" value={totals.outflow} tone="text-expense" />
        <TotalPill
          label="Saldo"
          value={totals.balance}
          tone={totals.balance >= 0 ? 'text-content' : 'text-expense'}
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="Nenhum lançamento encontrado"
          description={
            statusTab === 'overdue'
              ? 'Nada vencido por aqui — todas as contas em dia.'
              : 'Ajuste os filtros acima ou registre um novo lançamento.'
          }
          action={<Button onClick={() => openNew()}>Novo lançamento</Button>}
        />
      ) : (
        <Section title="Resultado" bodyClassName="pt-1">
          <TransactionList transactions={filtered} showCompany={scopeCompanyId === null} />
        </Section>
      )}
    </div>
  )
}

function TotalPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-center shadow-card">
      <p className="text-[11px] uppercase tracking-wide text-content-faint">{label}</p>
      <p className={`tnum mt-0.5 text-base font-bold ${tone}`}>{formatCurrency(value)}</p>
    </div>
  )
}

function handleExport(
  rows: Transaction[],
  companies: { id: string; name: string }[],
  contacts: { id: string; name: string }[],
  regime: 'cash' | 'accrual',
) {
  const header = [
    'Competência',
    'Data do dinheiro',
    'Empresa',
    'Tipo',
    'Categoria',
    'Descrição',
    'Contato',
    'Situação',
    'Valor',
  ]
  const lines = rows.map((t) => [
    t.competence_date,
    t.settled_date ?? t.due_date ?? '',
    companies.find((c) => c.id === t.company_id)?.name ?? '',
    t.kind === 'income' ? 'Receita' : t.kind === 'withdrawal' ? 'Retirada' : 'Despesa',
    t.category,
    t.description,
    contacts.find((c) => c.id === t.contact_id)?.name ?? '',
    t.status === 'settled' ? 'Liquidado' : 'Pendente',
    t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ])
  const content = [header, ...lines]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lancamentos-${regime === 'cash' ? 'caixa' : 'competencia'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
