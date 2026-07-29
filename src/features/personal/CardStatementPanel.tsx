import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Building2, Receipt } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { CategoryBarChart } from '@/features/dashboard/Charts'
import { cardSummary } from '@/lib/cards'
import { BUSINESS_CATEGORY } from '@/lib/finance'
import { formatCurrency, formatDateShort, formatMonthYear, parseDateOnly, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

const COR_PADRAO = '#6366F1'
type Filtro = 'tudo' | 'meus' | 'empresa'

/**
 * O extrato da fatura, com o gasto da empresa marcado.
 *
 * A fatura que o banco manda é uma lista só, e nela o Meta Ads da imobiliária
 * parece um gasto do Rafael como qualquer outro. Aqui os dois lados aparecem
 * separados — e o gráfico de categorias mostra SÓ o que é dele, que é a
 * pergunta que ele faz ("no que eu gasto?").
 */
export function CardStatementPanel() {
  const { personalTransactions, personalCompany, accounts, transfers, categories } = useAppData()
  const hoje = toDateOnly(new Date())
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [indice, setIndice] = useState<number | null>(null)

  const cartao = useMemo(
    () =>
      accounts.find(
        (a) => a.is_active && a.company_id === personalCompany?.id && a.type === 'credit_card',
      ),
    [accounts, personalCompany],
  )

  const resumo = useMemo(
    () => (cartao ? cardSummary(cartao, personalTransactions, transfers, hoje) : null),
    [cartao, personalTransactions, transfers, hoje],
  )

  const cores = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) {
      if (c.company_id === personalCompany?.id && c.color) m.set(c.name, c.color)
    }
    return m
  }, [categories, personalCompany])

  if (!resumo || resumo.invoices.length === 0) return null

  // Começa na fatura aberta — é a que ele quer ver ao abrir a tela.
  const aberta = Math.max(0, resumo.invoices.findIndex((i) => i.state === 'open'))
  const atual = indice ?? aberta
  const fatura = resumo.invoices[atual]
  if (!fatura) return null

  const meus = fatura.items.filter((t) => t.category !== BUSINESS_CATEGORY)
  const daEmpresa = fatura.items.filter((t) => t.category === BUSINESS_CATEGORY)
  const soma = (l: Transaction[]) =>
    l.reduce((s, t) => s + (t.kind === 'income' ? -t.amount : t.amount), 0)

  const listados = filtro === 'meus' ? meus : filtro === 'empresa' ? daEmpresa : fatura.items

  // Categorias SÓ do que é gasto dele — a empresa distorceria o ranking.
  const porCategoria = (() => {
    const m = new Map<string, number>()
    for (const t of meus) {
      const v = t.kind === 'income' ? -t.amount : t.amount
      m.set(t.category, (m.get(t.category) ?? 0) + v)
    }
    return [...m.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, color: cores.get(name) ?? COR_PADRAO }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
  })()

  const abas: { chave: Filtro; rotulo: string; n: number }[] = [
    { chave: 'tudo', rotulo: 'Tudo', n: fatura.items.length },
    { chave: 'meus', rotulo: 'Meus gastos', n: meus.length },
    { chave: 'empresa', rotulo: 'Da imobiliária', n: daEmpresa.length },
  ]

  return (
    <div className="space-y-5">
      {porCategoria.length > 0 && (
        <Section
          title="No que você gastou"
          subtitle={`Só os seus gastos da fatura de ${formatMonthYear(parseDateOnly(fatura.cycleMonth))} — ${formatCurrency(soma(meus))}`}
        >
          <CategoryBarChart data={porCategoria} />
        </Section>
      )}

      <Section
        title="Extrato da fatura"
        subtitle={`${formatMonthYear(parseDateOnly(fatura.cycleMonth))} · vence ${formatDateShort(fatura.dueDate)}`}
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIndice(Math.max(0, atual - 1))}
              disabled={atual === 0}
              className="rounded-lg p-1.5 text-content-faint transition-colors hover:bg-surface-2 hover:text-content disabled:opacity-30"
              aria-label="Fatura anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIndice(Math.min(resumo.invoices.length - 1, atual + 1))}
              disabled={atual >= resumo.invoices.length - 1}
              className="rounded-lg p-1.5 text-content-faint transition-colors hover:bg-surface-2 hover:text-content disabled:opacity-30"
              aria-label="Próxima fatura"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        {/* Os três totais, sempre visíveis */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Total rotulo="Fatura" valor={fatura.total} />
          <Total rotulo="Seu gasto" valor={soma(meus)} tom="expense" />
          <Total rotulo="Da imobiliária" valor={soma(daEmpresa)} tom="muted" />
        </div>

        <div className="mb-2 flex gap-1 rounded-lg bg-surface-2 p-0.5">
          {abas.map((a) => (
            <button
              key={a.chave}
              onClick={() => setFiltro(a.chave)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                filtro === a.chave
                  ? 'bg-surface text-content shadow-sm'
                  : 'text-content-faint hover:text-content-muted',
              )}
            >
              {a.rotulo}
              <span className="ml-1 text-[10px] text-content-faint">{a.n}</span>
            </button>
          ))}
        </div>

        {listados.length === 0 ? (
          <p className="py-6 text-center text-sm text-content-muted">
            {filtro === 'empresa'
              ? 'Nenhum gasto da imobiliária nesta fatura.'
              : 'Nenhum lançamento nesta fatura.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {listados
              .slice()
              .sort((a, b) =>
                (a.settled_date ?? a.competence_date) > (b.settled_date ?? b.competence_date) ? -1 : 1,
              )
              .map((t) => {
                const empresa = t.category === BUSINESS_CATEGORY
                const estorno = t.kind === 'income'
                return (
                  <li
                    key={t.id}
                    className={cn('flex items-center gap-3 py-2.5', empresa && 'bg-surface-2/60')}
                  >
                    <span className="tnum w-11 shrink-0 text-center text-xs text-content-muted">
                      {formatDateShort(t.settled_date ?? t.competence_date)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-content">{t.description || t.category}</p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-content-faint">
                        {empresa && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-content/8 px-1 py-px text-[10px] font-semibold text-content-muted">
                            <Building2 className="h-2.5 w-2.5" />
                            imobiliária
                          </span>
                        )}
                        {!empresa && t.category}
                        {t.installment_index != null && t.installment_count != null && (
                          <span className="text-content-faint">
                            {t.installment_index}/{t.installment_count}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'tnum shrink-0 text-sm font-semibold',
                        estorno ? 'text-income' : empresa ? 'text-content-muted' : 'text-content',
                      )}
                    >
                      {estorno ? '+' : ''} {formatCurrency(t.amount)}
                    </span>
                  </li>
                )
              })}
          </ul>
        )}

        {daEmpresa.length > 0 && filtro === 'tudo' && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-content-muted">
            <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              As linhas em cinza são gastos da imobiliária que passaram no seu cartão. O banco cobra
              de você, mas o custo é dela — e ela te deve.
            </span>
          </p>
        )}
      </Section>
    </div>
  )
}

function Total({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string
  valor: number
  tom?: 'expense' | 'muted'
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-content-faint">{rotulo}</p>
      <p
        className={cn(
          'tnum text-sm font-bold',
          tom === 'expense' ? 'text-expense' : tom === 'muted' ? 'text-content-muted' : 'text-content',
        )}
      >
        {formatCurrency(valor)}
      </p>
    </div>
  )
}
