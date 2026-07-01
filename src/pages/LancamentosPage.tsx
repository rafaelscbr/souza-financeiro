import { useMemo, useState } from 'react'
import { Download, Search, Inbox } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useComposer } from '@/features/transactions/TransactionComposer'
import { dreGroupOf, lastNMonths, monthKey, monthKeyOf } from '@/lib/finance'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/types'

type TypeFilter = 'all' | 'revenue' | 'cost_of_sale' | 'expense' | 'withdrawal'
type RangeFilter = 'mes' | '3m' | '12m' | 'tudo'

export function LancamentosPage() {
  const { transactions, companies, contacts, period } = useAppData()
  const { openNew } = useComposer()

  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [statusF, setStatusF] = useState('all')
  const [contactId, setContactId] = useState('all')
  const [range, setRange] = useState<RangeFilter>('3m')

  const monthKeys = useMemo(() => {
    if (range === 'tudo') return null
    const n = range === 'mes' ? 1 : range === '3m' ? 3 : 12
    return new Set(lastNMonths(period, n).map(monthKey))
  }, [range, period])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (monthKeys && !monthKeys.has(monthKeyOf(t.competence_date))) return false
      if (companyId !== 'all' && t.company_id !== companyId) return false
      if (contactId !== 'all' && t.contact_id !== contactId) return false
      if (statusF !== 'all' && t.status !== statusF) return false
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
  }, [transactions, monthKeys, companyId, contactId, statusF, type, search, contacts])

  const totals = useMemo(() => {
    let inflow = 0
    let outflow = 0
    for (const t of filtered) {
      if (dreGroupOf(t) === 'revenue') inflow += t.amount
      else outflow += t.amount
    }
    return { inflow, outflow, balance: inflow - outflow }
  }, [filtered])

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Lançamentos</h1>
          <p className="text-sm text-content-faint">
            {filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => handleExport(filtered, companies, contacts)}>
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">CSV</span>
        </Button>
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
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Empresa">
            <option value="all">Todas empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label="Tipo">
            <option value="all">Todos os tipos</option>
            <option value="revenue">Receitas</option>
            <option value="cost_of_sale">Repasses (custo)</option>
            <option value="expense">Despesas</option>
            <option value="withdrawal">Retiradas</option>
          </Select>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Situação">
            <option value="all">Toda situação</option>
            <option value="settled">Liquidado</option>
            <option value="pending">Pendente</option>
          </Select>
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label="Contato">
            <option value="all">Todos contatos</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={range} onChange={(e) => setRange(e.target.value as RangeFilter)} aria-label="Período">
            <option value="mes">Mês atual</option>
            <option value="3m">Últimos 3 meses</option>
            <option value="12m">Últimos 12 meses</option>
            <option value="tudo">Todo o período</option>
          </Select>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <TotalPill label="Entradas" value={totals.inflow} tone="text-income" />
        <TotalPill label="Saídas" value={totals.outflow} tone="text-expense" />
        <TotalPill label="Saldo" value={totals.balance} tone={totals.balance >= 0 ? 'text-content' : 'text-expense'} />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="Nenhum lançamento encontrado"
          description="Ajuste os filtros ou registre um novo lançamento."
          action={<Button onClick={() => openNew()}>Novo lançamento</Button>}
        />
      ) : (
        <Section title="Resultado" bodyClassName="pt-1">
          <TransactionList transactions={filtered} showCompany />
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
) {
  const header = ['Data', 'Empresa', 'Tipo', 'Categoria', 'Descrição', 'Contato', 'Situação', 'Valor']
  const lines = rows.map((t) => [
    t.competence_date,
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
  a.download = 'lancamentos.csv'
  a.click()
  URL.revokeObjectURL(url)
}
