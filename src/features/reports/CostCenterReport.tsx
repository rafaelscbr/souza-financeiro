import { useMemo, useState } from 'react'
import { Building, PlusCircle, Trash2 } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Tip } from '@/components/ui/Tip'
import { dreGroupOf } from '@/lib/finance'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

interface Row {
  id: string | null
  name: string
  developer: string | null
  revenue: number
  commission: number
  expense: number
  result: number
  margin: number
  deals: number
}

/**
 * Resultado por empreendimento. Responde qual produto dá lucro — a decisão
 * comercial mais cara de uma imobiliária, que até agora era tomada por
 * intuição porque o sistema não sabia separar.
 */
export function CostCenterReport({ scopedTx }: { scopedTx: Transaction[] }) {
  const { costCenters, costCentersReady, scopeCompanyId, businessCompanies, createCostCenter, deleteCostCenter } =
    useAppData()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [developer, setDeveloper] = useState('')
  const [companyId, setCompanyId] = useState(scopeCompanyId ?? businessCompanies[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string | null, Row>()

    const ensure = (id: string | null): Row => {
      const existing = map.get(id)
      if (existing) return existing
      const cc = id ? costCenters.find((c) => c.id === id) : null
      const row: Row = {
        id,
        name: cc?.name ?? 'Sem empreendimento',
        developer: cc?.developer ?? null,
        revenue: 0,
        commission: 0,
        expense: 0,
        result: 0,
        margin: 0,
        deals: 0,
      }
      map.set(id, row)
      return row
    }

    const counted = new Set<string>()

    for (const t of scopedTx) {
      const row = ensure(t.cost_center_id ?? null)
      const g = dreGroupOf(t)

      if (g === 'revenue') {
        row.revenue += t.amount
        // Parcelas da mesma venda são um negócio só.
        const key = `${row.id}|${t.group_id ?? t.id}`
        if (!counted.has(key)) {
          counted.add(key)
          row.deals += 1
        }
      } else if (g === 'cost_of_sale') {
        row.commission += t.amount
      } else if (g !== 'withdrawal') {
        row.expense += t.amount
      }
    }

    return [...map.values()]
      .map((r) => {
        const result = r.revenue - r.commission - r.expense
        return { ...r, result, margin: r.revenue > 0 ? result / r.revenue : 0 }
      })
      .filter((r) => r.revenue !== 0 || r.commission !== 0 || r.expense !== 0)
      .sort((a, b) => b.result - a.result)
  }, [scopedTx, costCenters])

  async function add() {
    if (!name.trim() || !companyId) return
    setSaving(true)
    try {
      await createCostCenter({
        company_id: companyId,
        name: name.trim(),
        developer: developer.trim() || null,
        is_active: true,
      })
      setName('')
      setDeveloper('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  if (!costCentersReady) {
    return (
      <Section title="Resultado por empreendimento" subtitle="Precisa da migração 003">
        <p className="text-sm text-content-muted">
          Aplique <code className="rounded bg-surface-3 px-1 text-xs">003_centro_custo_e_fechamento.sql</code>{' '}
          no SQL Editor do Supabase para separar o resultado por empreendimento.
        </p>
      </Section>
    )
  }

  return (
    <Section
      title="Resultado por empreendimento"
      subtitle="Qual produto realmente dá lucro"
      action={
        <div className="flex items-center gap-2">
          <Tip label="Como usar o resultado por empreendimento">
            Cadastre cada empreendimento que você trabalha e marque o empreendimento ao lançar a
            comissão e as despesas de marketing dele.
            <span className="mt-1.5 block">
              Um produto pode ter comissão alta e ainda assim dar prejuízo, se o custo de anúncio
              para vender aquela unidade for maior do que parece. É isso que esta tabela revela.
            </span>
          </Tip>
          <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        </div>
      }
      bodyClassName="pt-1"
    >
      {adding && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface-2/60 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do empreendimento"
            aria-label="Nome do empreendimento"
            autoFocus
          />
          <Input
            value={developer}
            onChange={(e) => setDeveloper(e.target.value)}
            placeholder="Construtora (opcional)"
            aria-label="Construtora"
          />
          <div className="flex gap-2">
            {businessCompanies.length > 1 && !scopeCompanyId && (
              <Select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                aria-label="Empresa"
              >
                {businessCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <Button size="sm" onClick={add} disabled={saving || !name.trim()} className="h-11">
              Criar
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="py-2 text-sm text-content-muted">
          Nenhum lançamento com empreendimento marcado no período. Cadastre um empreendimento acima
          e selecione-o ao lançar comissões e despesas.
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-content-faint">
                <th className="px-2 py-2 font-medium">Empreendimento</th>
                <th className="px-2 py-2 text-right font-medium">Vendas</th>
                <th className="px-2 py-2 text-right font-medium">Receita</th>
                <th className="px-2 py-2 text-right font-medium">Comissões</th>
                <th className="px-2 py-2 text-right font-medium">Despesas</th>
                <th className="px-2 py-2 text-right font-medium">Resultado</th>
                <th className="px-2 py-2 text-right font-medium">Margem</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id ?? 'none'}>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <Building
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          r.id ? 'text-content-faint' : 'text-content-faint/50',
                        )}
                      />
                      <div className="min-w-0">
                        <span
                          className={cn(
                            'block truncate font-medium',
                            r.id ? 'text-content' : 'italic text-content-faint',
                          )}
                        >
                          {r.name}
                        </span>
                        {r.developer && (
                          <span className="block truncate text-[11px] text-content-faint">
                            {r.developer}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-content-muted">{r.deals || '—'}</td>
                  <td className="tnum px-2 py-2.5 text-right text-income">
                    {formatCurrency(r.revenue)}
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-content-muted">
                    {formatCurrency(r.commission)}
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-content-muted">
                    {formatCurrency(r.expense)}
                  </td>
                  <td
                    className={cn(
                      'tnum px-2 py-2.5 text-right font-semibold',
                      r.result >= 0 ? 'text-content' : 'text-expense',
                    )}
                  >
                    {formatCurrency(r.result)}
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-content-muted">
                    {r.revenue > 0 ? formatPercent(r.margin, 0) : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {r.id && r.deals === 0 && (
                      <button
                        onClick={() => deleteCostCenter(r.id!)}
                        className="rounded-lg p-1.5 text-content-faint hover:bg-surface-2 hover:text-expense"
                        aria-label={`Excluir ${r.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
