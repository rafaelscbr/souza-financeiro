import { useMemo } from 'react'
import { Scissors } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { formatCurrency } from '@/lib/format'
import { saleSplits, splitTotals } from '@/lib/commissions'
import { cn } from '@/lib/utils'

const DESTINOS = [
  { chave: 'tax', rotulo: 'Imposto', cor: '#57534E' },
  { chave: 'partner', rotulo: 'Parceiro', cor: '#B45309' },
  { chave: 'toOwner', rotulo: 'Rafael', cor: '#6366F1' },
  { chave: 'toCompany', rotulo: 'Imobiliária', cor: '#059669' },
] as const

/**
 * Para onde vai cada real das comissões.
 *
 * A tela de vendas mostra quanto foi vendido; esta mostra quanto **sobra**, e
 * para quem. São quatro destinos — governo, parceiro, dono e empresa — e sem
 * os quatro lado a lado a conta parece boa demais.
 */
export function CommissionSplitPanel({ companyId }: { companyId?: string | null }) {
  const { businessTransactions } = useAppData()

  const vendas = useMemo(() => {
    const todas = saleSplits(businessTransactions)
    return companyId ? todas.filter((v) => v.companyId === companyId) : todas
  }, [businessTransactions, companyId])

  const total = useMemo(() => splitTotals(vendas), [vendas])

  if (vendas.length === 0) return null

  return (
    <Section
      title="Para onde vai a comissão"
      subtitle={`${vendas.length} venda(s) · ${formatCurrency(total.gross)} de comissão bruta`}
    >
      <div className="space-y-5">
        {/* Barra do total, com os quatro destinos */}
        <div>
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
            {DESTINOS.map((d) => {
              const v = total[d.chave]
              const pct = total.gross > 0 ? (v / total.gross) * 100 : 0
              if (pct <= 0) return null
              return (
                <div
                  key={d.chave}
                  style={{ width: `${pct}%`, backgroundColor: d.cor }}
                  title={`${d.rotulo}: ${formatCurrency(v)}`}
                />
              )
            })}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {DESTINOS.map((d) => {
              const v = total[d.chave]
              const pct = total.gross > 0 ? Math.round((v / total.gross) * 100) : 0
              return (
                <div key={d.chave} className="rounded-xl bg-surface-2 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-content-faint">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.cor }} />
                    {d.rotulo}
                  </dt>
                  <dd className="tnum text-sm font-bold text-content">{formatCurrency(v)}</dd>
                  <dd className="text-[10px] text-content-faint">{pct}% do bruto</dd>
                </div>
              )
            })}
          </dl>
        </div>

        {/* Venda a venda */}
        <ul className="divide-y divide-line">
          {vendas.map((v) => (
            <li key={v.groupId} className="py-3">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-content">
                  {v.label}
                </span>
                <span className="tnum shrink-0 text-sm font-semibold text-content">
                  {formatCurrency(v.gross)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
                {DESTINOS.map((d) => {
                  const pct = v.gross > 0 ? (v[d.chave] / v.gross) * 100 : 0
                  if (pct <= 0) return null
                  return (
                    <div
                      key={d.chave}
                      style={{ width: `${pct}%`, backgroundColor: d.cor }}
                      title={`${d.rotulo}: ${formatCurrency(v[d.chave])}`}
                    />
                  )
                })}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-content-faint">
                {v.tax > 0 && <span>imposto {formatCurrency(v.tax)}</span>}
                {v.partner > 0 && <span>parceiro {formatCurrency(v.partner)}</span>}
                {v.toOwner > 0 && (
                  <span className="font-medium text-content-muted">
                    Rafael {formatCurrency(v.toOwner)}
                    {v.toOwnerAsBroker > 0 && v.toOwnerAsProfit > 0
                      ? ` (${formatCurrency(v.toOwnerAsBroker)} corretagem + ${formatCurrency(v.toOwnerAsProfit)} lucro)`
                      : v.toOwnerAsProfit > 0
                        ? ' (lucro)'
                        : ' (corretagem)'}
                  </span>
                )}
                <span
                  className={cn(
                    'font-medium',
                    v.toCompany > 0 ? 'text-income' : 'text-content-faint',
                  )}
                >
                  imobiliária {formatCurrency(v.toCompany)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-content-muted">
          <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Vendas em que o Rafael foi o corretor deixam pouco ou nada na empresa — a comissão dele
            é custo da venda. O que fica é o resultado real da operação depois de imposto, parceiro
            e corretagem.
          </span>
        </p>
      </div>
    </Section>
  )
}
