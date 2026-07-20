import { useMemo, useState } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Segmented } from '@/components/ui/Segmented'
import { Tip } from '@/components/ui/Tip'
import { dreSeries, type DreColumn } from '@/lib/indicators'
import { taxRateOf } from '@/lib/finance'
import { formatCurrency, formatMonthShort, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

type View = 'value' | 'vertical'

interface Line {
  label: string
  pick: (c: DreColumn) => number
  emphasis?: boolean
  negative?: boolean
}

const LINES: Line[] = [
  { label: 'Receita bruta', pick: (c) => c.revenue },
  { label: '(−) Impostos', pick: (c) => -c.taxes, negative: true },
  { label: '(−) Comissões', pick: (c) => -c.costOfSale, negative: true },
  { label: 'Lucro bruto', pick: (c) => c.grossProfit, emphasis: true },
  { label: '(−) Operacionais', pick: (c) => -c.operatingExpense, negative: true },
  { label: '(−) Variáveis', pick: (c) => -c.variableExpense, negative: true },
  { label: 'Lucro líquido', pick: (c) => c.netProfit, emphasis: true },
]

/**
 * DRE de 12 meses lado a lado. Um período isolado esconde tendência —
 * é aqui que um custo subindo mês a mês fica visível antes de virar
 * problema.
 */
export function DreComparative() {
  const { businessTransactions, businessCompanies, scopeCompanyId, period } = useAppData()
  const [view, setView] = useState<View>('value')

  const columns = useMemo(
    () =>
      dreSeries(
        businessTransactions,
        scopeCompanyId,
        period,
        scopeCompanyId ? taxRateOf(businessCompanies, scopeCompanyId) : null,
        12,
      ),
    [businessTransactions, scopeCompanyId, period, businessCompanies],
  )

  // Meses totalmente zerados não ajudam a ler tendência e comem largura.
  const active = columns.filter((c) => c.revenue !== 0 || c.netProfit !== 0)
  const shown = active.length > 0 ? active : columns.slice(-6)

  return (
    <Section
      title="DRE mês a mês"
      subtitle={`Últimos ${shown.length} meses com movimento`}
      action={
        <div className="flex items-center gap-2">
          <Tip label="Diferença entre valor e análise vertical">
            <strong className="text-content">Valor</strong> mostra os reais de cada linha.
            <span className="mt-1.5 block">
              <strong className="text-content">% da receita</strong> mostra quanto cada linha
              consome do faturamento. É a leitura que revela problema: se a comissão era 45% e
              virou 58% da receita, tem algo errado na negociação — mesmo que o valor absoluto
              tenha subido só porque você vendeu mais.
            </span>
          </Tip>
          <Segmented
            className="w-auto"
            ariaLabel="Modo de leitura"
            value={view}
            onChange={setView}
            options={[
              { value: 'value', label: 'Valor' },
              { value: 'vertical', label: '% receita' },
            ]}
          />
        </div>
      }
      bodyClassName="pt-1"
    >
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: `${8 + shown.length * 6}rem` }}>
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-content-faint">
              <th className="sticky left-0 bg-surface px-2 py-2 text-left font-medium">Linha</th>
              {shown.map((c) => (
                <th key={c.label} className="px-2 py-2 text-right font-medium">
                  {formatMonthShort(c.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {LINES.map((line) => (
              <tr key={line.label} className={cn(line.emphasis && 'bg-surface-2/40')}>
                <td
                  className={cn(
                    'sticky left-0 whitespace-nowrap px-2 py-2',
                    line.emphasis
                      ? 'bg-surface-2/40 font-semibold text-content'
                      : 'bg-surface text-content-muted',
                  )}
                >
                  {line.label}
                </td>
                {shown.map((c) => {
                  const value = line.pick(c)
                  const pct = c.revenue !== 0 ? value / c.revenue : 0
                  return (
                    <td
                      key={c.label}
                      className={cn(
                        'tnum whitespace-nowrap px-2 py-2 text-right',
                        line.emphasis && 'font-semibold',
                        value < 0
                          ? 'text-expense'
                          : line.emphasis
                            ? 'text-content'
                            : 'text-content-muted',
                      )}
                    >
                      {view === 'value'
                        ? formatCurrency(value)
                        : c.revenue === 0
                          ? '—'
                          : formatPercent(pct, 0)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
