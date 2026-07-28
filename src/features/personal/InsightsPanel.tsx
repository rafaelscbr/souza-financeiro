import { useMemo, useState } from 'react'
import {
  CreditCard,
  Store,
  Repeat,
  TrendingUp,
  TrendingDown,
  Lock,
  CircleSlash,
  CalendarClock,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/utils'
import { formatCurrency, formatMonthShort } from '@/lib/format'
import { lastNMonths, monthElapsedFraction } from '@/lib/finance'
import {
  activeInstallments,
  cardIdsOf,
  cardSpendByCategory,
  categoryTrends,
  fixedVsVariable,
  recurringSpend,
  spendingPace,
  topMerchants,
} from '@/lib/insights'
import { toDateOnly } from '@/lib/format'

const FALLBACK = '#6366F1'
const JANELA = 6 // meses olhados para trás nas análises

/**
 * Os relatórios que o extrato não dá: onde o cartão dói, com quem o dinheiro
 * fica, o que se repete todo mês, o que mudou contra o próprio normal e em que
 * ritmo o mês está indo.
 */
export function InsightsPanel({ livingCostAvg }: { livingCostAvg: number }) {
  const { personalTransactions, personalCompany, accounts, categories, period, regime } = useAppData()
  const [aba, setAba] = useState<'cartao' | 'lugares' | 'fixos'>('cartao')

  const meses = useMemo(() => lastNMonths(period, JANELA), [period])
  const anteriores = useMemo(() => meses.slice(0, -1), [meses])
  const cardIds = useMemo(() => cardIdsOf(accounts, personalCompany?.id), [accounts, personalCompany])

  const cores = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) {
      if (c.company_id === personalCompany?.id && c.color) m.set(c.name, c.color)
    }
    return m
  }, [categories, personalCompany])

  const noCartao = useMemo(
    () => cardSpendByCategory(personalTransactions, cardIds, meses, regime),
    [personalTransactions, cardIds, meses, regime],
  )
  const lugares = useMemo(
    () => topMerchants(personalTransactions, meses, regime),
    [personalTransactions, meses, regime],
  )
  const fixos = useMemo(
    () => recurringSpend(personalTransactions, meses, regime),
    [personalTransactions, meses, regime],
  )
  const tendencias = useMemo(
    () => categoryTrends(personalTransactions, period, anteriores, regime),
    [personalTransactions, period, anteriores, regime],
  )
  const ritmo = useMemo(
    () => spendingPace(personalTransactions, period, anteriores, monthElapsedFraction(period), regime),
    [personalTransactions, period, anteriores, regime],
  )
  const parcelamentos = useMemo(
    () => activeInstallments(personalTransactions, toDateOnly(new Date())),
    [personalTransactions],
  )
  const parceladoMensal = useMemo(
    () => parcelamentos.reduce((s, p) => s + p.monthly, 0),
    [parcelamentos],
  )
  const composicao = useMemo(
    () => fixedVsVariable(fixos.monthlyTotal + parceladoMensal, livingCostAvg),
    [fixos.monthlyTotal, parceladoMensal, livingCostAvg],
  )

  const cartaoTotal = noCartao.reduce((s, c) => s + c.total, 0)
  const periodoLabel = `${formatMonthShort(meses[0])} – ${formatMonthShort(meses[meses.length - 1])}`

  if (personalTransactions.length === 0) return null

  return (
    <div className="space-y-5">
      {/* ---------- ritmo do mês + composição do custo ---------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Ritmo do mês" subtitle="Como este mês está indo contra o seu normal">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="tnum text-2xl font-bold text-content">{formatCurrency(ritmo.spent)}</span>
              <span className="text-xs text-content-faint">
                {Math.round(ritmo.elapsed * 100)}% do mês
              </span>
            </div>
            <Progress value={ritmo.elapsed} color="#6366F1" />
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Mini label="Por dia" value={formatCurrency(ritmo.perDay)} />
              <Mini
                label="Fecha em"
                value={ritmo.projected != null ? formatCurrency(ritmo.projected) : '—'}
              />
              <Mini label="Seu normal" value={formatCurrency(ritmo.average)} />
            </dl>
            {ritmo.projected != null && ritmo.average > 0 && (
              <p
                className={cn(
                  'text-xs',
                  ritmo.projected > ritmo.average * 1.1 ? 'font-medium text-pending' : 'text-content-muted',
                )}
              >
                {ritmo.projected > ritmo.average * 1.1 ? (
                  <>
                    Nesse ritmo você fecha {formatCurrency(ritmo.projected - ritmo.average)} acima da
                    sua média.
                  </>
                ) : ritmo.projected < ritmo.average * 0.9 ? (
                  <>
                    Nesse ritmo você fecha {formatCurrency(ritmo.average - ritmo.projected)} abaixo da
                    sua média.
                  </>
                ) : (
                  <>Você está no seu ritmo de sempre.</>
                )}
              </p>
            )}
          </div>
        </Section>

        <Section title="Fixo × variável" subtitle="Quanto do seu custo dá para cortar">
          {livingCostAvg <= 0 ? (
            <p className="text-sm text-content-muted">Ainda sem custo de vida apurado.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="tnum text-2xl font-bold text-content">
                  {Math.round(composicao.fixedShare * 100)}%
                </span>
                <span className="text-xs text-content-faint">é compromisso fixo</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="bg-expense"
                  style={{ width: `${composicao.fixedShare * 100}%` }}
                  title="Fixo"
                />
                <div className="flex-1 bg-emerald/60" title="Variável" />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-center">
                <Mini label="Fixo/mês" value={formatCurrency(composicao.fixed)} icon={<Lock className="h-3 w-3" />} />
                <Mini label="Variável/mês" value={formatCurrency(composicao.variable)} />
              </dl>
              <p className="text-xs text-content-muted">
                {composicao.fixedShare >= 0.5
                  ? 'Mais da metade do seu custo não dá para cortar rápido — num mês fraco a margem de manobra é pequena.'
                  : 'Boa parte do seu custo é variável, o que dá espaço de manobra num mês fraco.'}
              </p>
            </div>
          )}
        </Section>
      </div>

      {/* ---------- o que mudou ---------- */}
      {tendencias.length > 0 && (
        <Section
          title="O que mudou neste mês"
          subtitle={`${formatMonthShort(period)} contra a média dos ${anteriores.length} meses anteriores`}
        >
          <ul className="space-y-2.5">
            {tendencias.slice(0, 6).map((t) => {
              const subiu = t.diff > 0
              return (
                <li key={t.category} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      subiu ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income',
                    )}
                  >
                    {subiu ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">{t.category}</p>
                    <p className="text-xs text-content-faint">
                      {formatCurrency(t.current)} · normal {formatCurrency(t.average)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'tnum shrink-0 text-sm font-semibold',
                      subiu ? 'text-expense' : 'text-income',
                    )}
                  >
                    {subiu ? '+' : '−'}
                    {formatCurrency(Math.abs(t.diff))}
                    {t.pct != null && (
                      <span className="ml-1 text-xs font-normal text-content-faint">
                        {subiu ? '+' : ''}
                        {Math.round(t.pct * 100)}%
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {/* ---------- abas: cartão · lugares · fixos ---------- */}
      <Section
        title="Para onde vai o dinheiro"
        subtitle={`Últimos ${meses.length} meses · ${periodoLabel}`}
        action={
          <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
            <Aba ativo={aba === 'cartao'} onClick={() => setAba('cartao')} icon={<CreditCard className="h-3 w-3" />}>
              Cartão
            </Aba>
            <Aba ativo={aba === 'lugares'} onClick={() => setAba('lugares')} icon={<Store className="h-3 w-3" />}>
              Lugares
            </Aba>
            <Aba ativo={aba === 'fixos'} onClick={() => setAba('fixos')} icon={<Repeat className="h-3 w-3" />}>
              Fixos
            </Aba>
          </div>
        }
      >
        {aba === 'cartao' &&
          (noCartao.length === 0 ? (
            <p className="text-sm text-content-muted">Nenhum gasto no cartão neste período.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-content-faint">
                {formatCurrency(cartaoTotal)} no cartão em {meses.length} meses ·{' '}
                {formatCurrency(cartaoTotal / meses.length)} por mês
              </p>
              {noCartao.map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="truncate font-medium text-content">{c.category}</span>
                    <span className="tnum shrink-0 text-content-muted">
                      {formatCurrency(c.total)}
                      <span className="ml-1.5 text-xs text-content-faint">
                        {Math.round(c.share * 100)}%
                      </span>
                    </span>
                  </div>
                  <Progress value={c.share} color={cores.get(c.category) ?? FALLBACK} />
                  <p className="mt-0.5 text-[11px] text-content-faint">
                    {c.count} {c.count === 1 ? 'compra' : 'compras'} ·{' '}
                    {formatCurrency(c.total / meses.length)}/mês
                  </p>
                </div>
              ))}
            </div>
          ))}

        {aba === 'lugares' &&
          (lugares.length === 0 ? (
            <p className="text-sm text-content-muted">Sem lançamentos no período.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lugares.map((l, i) => (
                <li key={l.merchant} className="flex items-center gap-3 py-2.5">
                  <span className="tnum w-5 shrink-0 text-center text-xs font-semibold text-content-faint">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">{l.merchant}</p>
                    <p className="truncate text-xs text-content-faint">
                      {l.category} · {l.count}× em {l.months}{' '}
                      {l.months === 1 ? 'mês' : 'meses'}
                      {l.count > 1 && ` · maior ${formatCurrency(l.biggest)}`}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-sm font-semibold text-content">
                    {formatCurrency(l.total)}
                  </span>
                </li>
              ))}
            </ul>
          ))}

        {aba === 'fixos' && (
          <div className="space-y-5">
            <div className="flex items-baseline gap-2">
              <span className="tnum text-2xl font-bold text-content">
                {formatCurrency(fixos.monthlyTotal + parceladoMensal)}
              </span>
              <span className="text-xs text-content-faint">
                de compromisso por mês
                {parceladoMensal > 0 && (
                  <> · {formatCurrency(parceladoMensal)} são parcelas que acabam</>
                )}
              </span>
            </div>

            {fixos.rows.length === 0 ? (
              <p className="text-sm text-content-muted">
                Nenhuma recorrência detectada ainda — são precisos ao menos 3 meses do mesmo
                estabelecimento.
              </p>
            ) : (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-faint">
                  Recorrentes · {formatCurrency(fixos.monthlyTotal)}/mês
                </p>
                <ul className="divide-y divide-line">
                  {fixos.rows.map((r) => (
                    <li key={r.merchant} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-content-muted">
                        <Repeat className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-content">{r.merchant}</p>
                        <p className="truncate text-xs text-content-faint">
                          {r.category} · apareceu em {r.months} meses
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-sm font-semibold text-content">
                        {formatCurrency(r.monthly)}
                        <span className="text-xs font-normal text-content-faint">/mês</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parcelamentos.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-faint">
                  Parcelamentos em curso · {formatCurrency(parceladoMensal)}/mês
                </p>
                <ul className="divide-y divide-line">
                  {parcelamentos.map((p) => (
                    <li key={`${p.label}-${p.endsAt}`} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-content-muted">
                        <CalendarClock className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-content">{p.label}</p>
                        <p className="truncate text-xs text-content-faint">
                          faltam {p.remaining} de {p.count} · termina em {mesAno(p.endsAt)} · restam{' '}
                          {formatCurrency(p.outstanding)}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-sm font-semibold text-content">
                        {formatCurrency(p.monthly)}
                        <span className="text-xs font-normal text-content-faint">/mês</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-content-faint">
                  Parcelamento tem data para acabar — é compromisso fixo que um dia devolve
                  fôlego ao seu orçamento.
                </p>
              </div>
            )}

            {fixos.ended.length > 0 && (
              <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-content-muted">
                  <CircleSlash className="h-3.5 w-3.5" />
                  Parou de sair
                </p>
                <ul className="space-y-1.5">
                  {fixos.ended.slice(0, 5).map((r) => (
                    <li key={r.merchant} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-content-muted">{r.merchant}</span>
                      <span className="tnum shrink-0 text-content-faint">
                        era {formatCurrency(r.monthly)}/mês
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-content-faint">
                  Aparecia todo mês e sumiu nos últimos dois — confira se foi cancelamento mesmo ou
                  cobrança que falhou.
                </p>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  )
}

/** 'YYYY-MM' → 'nov/26' (o mês em que a última parcela cai). */
function mesAno(ym: string): string {
  const [y, m] = ym.split('-')
  return `${formatMonthShort(new Date(Number(y), Number(m) - 1, 1))}/${y.slice(2)}`
}

function Mini({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1.5">
      <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-content-faint">
        {icon}
        {label}
      </dt>
      <dd className="tnum text-sm font-semibold text-content">{value}</dd>
    </div>
  )
}

function Aba({
  ativo,
  onClick,
  icon,
  children,
}: {
  ativo: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        ativo ? 'bg-surface text-content shadow-sm' : 'text-content-faint hover:text-content-muted',
      )}
    >
      {icon}
      {children}
    </button>
  )
}
