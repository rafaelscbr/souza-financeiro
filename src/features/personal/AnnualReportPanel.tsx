import { useMemo, useState } from 'react'
import { FileText, ChevronDown } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Select } from '@/components/ui/Field'
import { Tip } from '@/components/ui/Tip'
import { annualReport } from '@/lib/personal'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Consolidado do ano por categoria. Não substitui a declaração, mas põe no
 * mesmo lugar o que o contador sempre pede — e que ninguém lembra em abril:
 * quanto veio como pró-labore (tributável) e quanto como distribuição de
 * lucros (isenta), mais o gasto do ano por categoria.
 */
export function AnnualReportPanel() {
  const { personalTransactions, businessTransactions, period, regime } = useAppData()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(period.getFullYear())

  const years = useMemo(() => {
    const found = new Set<number>([new Date().getFullYear()])
    for (const t of personalTransactions) found.add(Number(t.competence_date.slice(0, 4)))
    return [...found].filter((y) => y > 2000).sort((a, b) => b - a)
  }, [personalTransactions])

  const report = useMemo(
    () => annualReport(personalTransactions, businessTransactions, year, regime),
    [personalTransactions, businessTransactions, year, regime],
  )

  const hasData =
    report.proLabore > 0 ||
    report.distribution > 0 ||
    report.otherIncome > 0 ||
    report.totalExpenses > 0
  if (!hasData && !open) return null

  return (
    <Section
      title="Resumo do ano"
      subtitle="Apoio à declaração de imposto de renda"
      action={
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline"
        >
          {open ? 'Fechar' : 'Abrir'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      }
    >
      {!open ? (
        <p className="text-sm text-content-muted">
          Rendimentos tributáveis e isentos separados, mais o gasto do ano por categoria.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-content-muted" />
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Ano do relatório"
              className="h-9 w-32 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>

          {/* Rendimentos */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
              Rendimentos recebidos
              <Tip label="Por que separar">
                Pró-labore é rendimento <strong className="text-content">tributável</strong> e vai
                na ficha de rendimentos com retenção. Distribuição de lucros é{' '}
                <strong className="text-content">isenta</strong> e vai em outra ficha. Trocar as
                duas é erro clássico de declaração.
              </Tip>
            </h3>
            <ul className="divide-y divide-line">
              <Row label="Pró-labore" sub="Tributável" value={report.proLabore} />
              <Row label="Distribuição de lucros" sub="Isento" value={report.distribution} />
              {report.otherIncome > 0 && (
                <Row label="Outras receitas pessoais" sub="Conferir com o contador" value={report.otherIncome} />
              )}
            </ul>
          </div>

          {/* Gastos */}
          {report.expensesByCategory.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-content">Gastos por categoria</h3>
              <ul className="divide-y divide-line">
                {report.expensesByCategory.map((r) => (
                  <li key={r.category} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-content">{r.category}</span>
                      <span className="text-[11px] text-content-faint">
                        {r.months} {r.months === 1 ? 'mês' : 'meses'} · média{' '}
                        {formatCurrency(r.total / r.months)}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-sm font-semibold text-content">
                      {formatCurrency(r.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Totais */}
          <div className="space-y-1 rounded-xl border border-line bg-surface-2/50 p-3.5 text-sm">
            <Total label="Total de gastos" value={report.totalExpenses} />
            <Total label="Investido no ano" value={report.invested} />
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
              <span className="font-medium text-content">Sobrou no ano</span>
              <span
                className={cn(
                  'tnum font-bold',
                  report.net >= 0 ? 'text-income' : 'text-expense',
                )}
              >
                {formatCurrency(report.net)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-content-faint">
            Este resumo organiza o que você lançou — não substitui a orientação do seu contador.
          </p>
        </div>
      )}
    </Section>
  )
}

function Row({ label, sub, value }: { label: string; sub: string; value: number }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm text-content">{label}</span>
        <span className="text-[11px] text-content-faint">{sub}</span>
      </span>
      <span className="tnum shrink-0 text-sm font-semibold text-content">
        {formatCurrency(value)}
      </span>
    </li>
  )
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-content-muted">{label}</span>
      <span className="tnum font-semibold text-content">{formatCurrency(value)}</span>
    </div>
  )
}
