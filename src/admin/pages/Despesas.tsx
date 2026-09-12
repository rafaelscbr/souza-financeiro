import { useMemo, useState } from 'react'
import { Download, Plus, Receipt, RotateCcw, Trash2 } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { LancarDespesa } from '../LancarDespesa'
import { BaixarLancamento } from '../BaixarLancamento'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { buildRecurringInput, pendingRecurring } from '@/lib/recurring'
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

/**
 * O razão do dia a dia, sem as linhas que a venda gera.
 *
 * Comissão, imposto e repasse vivem na ficha da venda — misturá-los aqui era o
 * que fazia a lista de lançamentos ter 40 linhas por venda e virar ilegível.
 */
export function Despesas() {
  const { transactions, mes, categories, contacts, criarLancamento, excluirLancamento, estornarLancamento, company } =
    useAdmin()
  const { showToast } = useToast()
  const [filtro, setFiltro] = useState<'todos' | 'pagos' | 'abertos'>('todos')
  const [nova, setNova] = useState(false)
  const [baixando, setBaixando] = useState<Transaction | null>(null)
  const [gerando, setGerando] = useState(false)

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

  const doMes = useMemo(
    () =>
      transactions
        .filter((t) => !t.sale_id)
        .filter((t) => {
          const d = t.status === 'settled' ? t.settled_date ?? t.competence_date : t.due_date ?? t.competence_date
          return d.slice(0, 7) === chaveMes
        })
        .filter((t) => (filtro === 'pagos' ? t.status === 'settled' : filtro === 'abertos' ? t.status === 'pending' : true))
        .sort((a, b) => {
          const da = a.settled_date ?? a.due_date ?? a.competence_date
          const db = b.settled_date ?? b.due_date ?? b.competence_date
          return da < db ? 1 : -1
        }),
    [transactions, chaveMes, filtro],
  )

  const totais = useMemo(() => {
    let saiu = 0
    let entrou = 0
    for (const t of doMes) {
      if (t.kind === 'income') entrou += t.amount
      else saiu += t.amount
    }
    return { saiu: Math.round(saiu * 100) / 100, entrou: Math.round(entrou * 100) / 100 }
  }, [doMes])

  const fixasPendentes = useMemo(
    () => (company ? pendingRecurring(transactions.filter((t) => !t.sale_id), company.id, mes) : []),
    [transactions, company, mes],
  )

  const nomePorContato = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts])
  const dreDaCategoria = useMemo(() => new Map(categories.map((c) => [c.name, c.dre_group])), [categories])

  function exportar() {
    const linhas = [
      ['Data', 'Tipo', 'Categoria', 'Descrição', 'Fornecedor', 'Valor', 'Situação'],
      ...doMes.map((t) => [
        t.settled_date ?? t.due_date ?? t.competence_date,
        t.kind === 'income' ? 'Entrada' : 'Saída',
        t.category,
        t.description,
        t.contact_id ? nomePorContato.get(t.contact_id) ?? '' : '',
        String(t.amount).replace('.', ','),
        t.status === 'settled' ? 'Liquidado' : 'Em aberto',
      ]),
    ]
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `despesas-${chaveMes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function gerarFixas() {
    setGerando(true)
    try {
      for (const c of fixasPendentes) {
        const input = buildRecurringInput(c, mes)
        await criarLancamento({
          ...input,
          dre_group: input.dre_group ?? dreDaCategoria.get(input.category) ?? 'variable_expense',
        })
      }
      showToast({
        message: `${fixasPendentes.length} despesa(s) fixa(s) lançada(s)`,
        detail: 'nascem em aberto, para você dar baixa quando pagar',
      })
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Despesas e outras entradas</h1>
          <p className="text-sm text-content-faint">{formatMonthYear(mes)}</p>
        </div>
        <div className="flex gap-2">
          {doMes.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportar}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
          <Button size="sm" onClick={() => setNova(true)}>
            <Plus className="h-4 w-4" />
            Lançar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wide text-content-faint">Saiu no mês</p>
          <p className="tnum text-lg font-bold text-expense">{formatCurrency(totais.saiu)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wide text-content-faint">Entrou (fora de venda)</p>
          <p className="tnum text-lg font-bold text-income">{formatCurrency(totais.entrou)}</p>
        </div>
      </div>

      {fixasPendentes.length > 0 && (
        <div className="rounded-2xl border border-brandblue/25 bg-brandblue-soft/50 p-4">
          <p className="text-sm font-semibold text-content">
            {fixasPendentes.length} despesa(s) fixa(s) ainda não lançada(s) neste mês
          </p>
          <p className="mt-0.5 text-xs text-content-muted">
            {fixasPendentes.map((c) => c.template.description || c.template.category).join(' · ')}
          </p>
          <Button size="sm" className="mt-3" onClick={gerarFixas} disabled={gerando}>
            Lançar todas em aberto
          </Button>
        </div>
      )}

      <Segmented
        ariaLabel="Filtro"
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'pagos', label: 'Liquidados' },
          { value: 'abertos', label: 'Em aberto' },
        ]}
      />

      {doMes.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="Nada lançado neste mês"
          description="Use o botão Lançar para registrar uma despesa em três toques."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {doMes.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">{t.description || t.category}</p>
                <p className="text-xs text-content-faint">
                  {formatDate(t.settled_date ?? t.due_date ?? t.competence_date)} · {t.category}
                  {t.contact_id ? ` · ${nomePorContato.get(t.contact_id) ?? ''}` : ''}
                  {t.status === 'pending' ? ' · em aberto' : ''}
                </p>
              </div>
              <span
                className={cn(
                  'tnum shrink-0 text-sm font-semibold',
                  t.kind === 'income' ? 'text-income' : 'text-content',
                )}
              >
                {t.kind === 'income' ? '' : '− '}
                {formatCurrency(t.amount)}
              </span>
              {t.status === 'pending' ? (
                <Button variant="secondary" size="sm" onClick={() => setBaixando(t)}>
                  {t.kind === 'income' ? 'Recebi' : 'Paguei'}
                </Button>
              ) : (
                <button
                  onClick={() => estornarLancamento(t.id, t.settled_date ?? t.competence_date)}
                  className="rounded-lg p-2 text-content-faint transition-colors hover:bg-surface-2 hover:text-content"
                  aria-label="Desfazer baixa"
                  title="Desfazer baixa"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Excluir "${t.description || t.category}" de ${formatCurrency(t.amount)}?`)) {
                    excluirLancamento(t.id)
                  }
                }}
                className="rounded-lg p-2 text-content-faint transition-colors hover:bg-surface-2 hover:text-expense"
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <LancarDespesa aberto={nova} onFechar={() => setNova(false)} />
      <BaixarLancamento tx={baixando} onFechar={() => setBaixando(null)} />
    </div>
  )
}
