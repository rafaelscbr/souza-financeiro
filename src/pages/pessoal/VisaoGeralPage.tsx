import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { CashflowChart, PersonalTrendChart } from '@/features/dashboard/Charts'
import { PersonalRecurringPrompt } from '@/features/personal/PersonalRecurringPrompt'
import { personalCashflow } from '@/lib/cashflow'
import { ownerReceivables } from '@/lib/commissions'
import { activeInstallments, businessShareOfCardDebt, cardIdsOf, recurringSpend } from '@/lib/insights'
import { cardSummary } from '@/lib/cards'
import { personalVitals } from '@/lib/personal'
import { survival } from '@/lib/survival'
import { lastNMonths } from '@/lib/finance'
import { formatCurrency, formatDateShort, formatMonthShort, parseDateOnly, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

const FAIXA = {
  critico: { icon: ShieldAlert, cor: 'text-expense', bg: 'bg-expense/10', barra: '#DC2626' },
  atencao: { icon: Shield, cor: 'text-pending', bg: 'bg-pending/10', barra: '#B45309' },
  saudavel: { icon: ShieldCheck, cor: 'text-income', bg: 'bg-income/10', barra: '#059669' },
} as const

/**
 * A tela que abre o módulo pessoal, em quatro blocos e nesta ordem:
 *
 *  1. ONDE ESTOU     — saldo líquido e por quanto tempo ele dura
 *  2. PARA ONDE VOU  — entradas × saídas mês a mês, com o saldo cruzando o zero
 *  3. O QUE VEM AÍ   — os próximos 30 dias, o horizonte real de decisão
 *  4. COMO ESTOU INDO— a série histórica, que diz se está melhorando
 *
 * Nada aqui é estimado: as saídas vêm das faturas e das contas lançadas, as
 * entradas do que as empresas devem com data. Quanto mais ele lançar, mais a
 * projeção acerta — e ele vê isso acontecer, que é o melhor incentivo.
 *
 * O que era aprofundamento saiu daqui: extrato vai em Gastos, fatura em Cartão,
 * bens em Patrimônio. Doze painéis empilhados era o que deixava a tela ilegível.
 */
export function VisaoGeralPage() {
  const {
    personalTransactions, businessTransactions, personalAssets, personalCompany,
    accounts, transfers, period, regime,
  } = useAppData()

  const hoje = toDateOnly(new Date())
  const contasPF = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )

  const vitals = useMemo(
    () => personalVitals(personalTransactions, businessTransactions, contasPF, transfers, period, regime),
    [personalTransactions, businessTransactions, contasPF, transfers, period, regime],
  )

  const compromisso = useMemo(() => {
    const rec = recurringSpend(personalTransactions, lastNMonths(period, 6), regime)
    const parc = activeInstallments(personalTransactions, hoje)
    return rec.monthlyTotal + parc.reduce((s, p) => s + p.monthly, 0)
  }, [personalTransactions, period, regime, hoje])

  const aReceber = useMemo(
    () => ownerReceivables(businessTransactions, hoje),
    [businessTransactions, hoje],
  )

  const empresaNoCartao = useMemo(() => {
    const cartoes = contasPF.filter((a) => a.is_active && a.type === 'credit_card')
    if (cartoes.length === 0) return 0
    const ciclo = cardSummary(cartoes[0], personalTransactions, transfers, hoje).open.cycleMonth
    return businessShareOfCardDebt(
      personalTransactions,
      cardIdsOf(accounts, personalCompany?.id),
      ciclo,
      hoje,
    )
  }, [contasPF, personalTransactions, transfers, hoje, accounts, personalCompany])

  const folego = useMemo(
    () =>
      survival({
        liquid: vitals.liquid,
        livingCostAvg: vitals.livingCostAvg,
        fixedCommitment: compromisso,
        assets: personalAssets,
        receipts: aReceber.map((r) => ({ date: r.date, amount: r.amount })),
        businessOnCard: empresaNoCartao,
        today: hoje,
      }),
    [vitals, compromisso, personalAssets, aReceber, empresaNoCartao, hoje],
  )

  const fluxo = useMemo(
    () =>
      personalCashflow({
        liquid: vitals.liquid,
        personalTransactions,
        businessTransactions,
        accounts: contasPF,
        transfers,
        today: hoje,
        months: 8,
      }),
    [vitals.liquid, personalTransactions, businessTransactions, contasPF, transfers, hoje],
  )

  // Os próximos 30 dias — o horizonte em que ele realmente decide alguma coisa.
  const trintaDias = useMemo(() => {
    const limite = new Date(Date.parse(hoje) + 30 * 864e5).toISOString().slice(0, 10)
    const itens = fluxo.months
      .flatMap((m) => m.items)
      .filter((i) => i.date <= limite)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
    const entra = itens.filter((i) => i.kind === 'in').reduce((s, i) => s + i.amount, 0)
    const sai = itens.filter((i) => i.kind === 'out').reduce((s, i) => s + i.amount, 0)
    return { itens, entra, sai, saldo: vitals.liquid + entra - sai }
  }, [fluxo, hoje, vitals.liquid])

  const serie = useMemo(
    () =>
      vitals.series
        .filter((p) => p.inflow > 0 || p.outflow > 0)
        .map((p) => ({
          label: formatMonthShort(p.date),
          renda: p.inflow,
          custo: p.livingCost,
          sobra: p.surplus,
        })),
    [vitals.series],
  )

  if (personalTransactions.length === 0 && contasPF.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="Suas finanças pessoais começam aqui"
        description="Cadastre suas contas e lance seus gastos. O que as empresas te pagam entra sozinho."
      />
    )
  }

  const f = FAIXA[folego.faixa]
  const Icone = f.icon
  const metaPct =
    folego.runwayMonths != null ? Math.min(1, folego.runwayMonths / folego.targetMonths) : 0

  return (
    <div className="space-y-5">
      <PersonalRecurringPrompt />

      {/* 1 ───────────────────────────────────────────── ONDE ESTOU */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-4">
          <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', f.bg, f.cor)}>
            <Icone className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-content-faint">Disponível hoje</p>
            <p className={cn('tnum text-3xl font-bold', vitals.liquid >= 0 ? 'text-content' : 'text-expense')}>
              {formatCurrency(vitals.liquid)}
            </p>
            <p className="mt-0.5 text-xs text-content-muted">
              contas menos a fatura do cartão
              {empresaNoCartao > 0 && (
                <> · {formatCurrency(empresaNoCartao)} da fatura é da imobiliária</>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-wide text-content-faint">Sem receber nada</p>
            <p className={cn('tnum text-xl font-bold', f.cor)}>
              {folego.runwayMonths == null
                ? '—'
                : folego.runwayMonths < 1
                  ? `${folego.runwayDays} dias`
                  : `${folego.runwayMonths.toFixed(1).replace('.', ',')} meses`}
            </p>
            <p className="text-[11px] text-content-faint">o piso, se tudo atrasar</p>
          </div>
          <div className="rounded-xl border border-income/25 bg-income/5 px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-wide text-content-faint">Com o contratado</p>
            <p className="tnum text-xl font-bold text-income">
              {folego.withReceipts?.months == null
                ? 'mais de 24 meses'
                : `${folego.withReceipts.months.toFixed(1).replace('.', ',')} meses`}
            </p>
            <p className="text-[11px] text-content-faint">
              {formatCurrency(folego.withReceipts?.incoming ?? 0)} a receber
            </p>
          </div>
        </div>

        {folego.runwayMonths != null && (
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="text-content-muted">Reserva: meta de {folego.targetMonths} meses</span>
              <span className="tnum text-content-faint">{Math.round(metaPct * 100)}%</span>
            </div>
            <Progress value={metaPct} color={f.barra} />
          </div>
        )}
      </section>

      {/* 2 ──────────────────────────────────────────── PARA ONDE VOU */}
      <Section
        title="Previsão de caixa"
        subtitle={`${formatCurrency(fluxo.totalIn)} entrando e ${formatCurrency(fluxo.totalOut)} saindo nos próximos ${fluxo.months.length} meses`}
      >
        <CashflowChart
          data={fluxo.months.map((m) => ({
            label: formatMonthShort(parseDateOnly(`${m.month}-01`)),
            entrada: m.inflow,
            saida: -m.outflow,
            saldo: m.balance,
          }))}
        />
        {fluxo.breaksAt && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-expense/8 px-3.5 py-2.5 text-xs text-content-muted">
            <ArrowDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-expense" />
            <span>
              O saldo fica negativo em{' '}
              <strong className="text-content">
                {formatMonthShort(parseDateOnly(`${fluxo.breaksAt}-01`))}
              </strong>
              {fluxo.lowest && (
                <>
                  {' '}
                  e chega ao pior ponto em{' '}
                  {formatMonthShort(parseDateOnly(`${fluxo.lowest.month}-01`))}, com{' '}
                  {formatCurrency(fluxo.lowest.balance)}
                </>
              )}
              . A projeção conta só o que já está contratado — venda nova muda isto.
            </span>
          </p>
        )}
      </Section>

      {/* 3 ──────────────────────────────────────────── O QUE VEM AÍ */}
      <Section
        title="Próximos 30 dias"
        subtitle={`Saldo ao fim: ${formatCurrency(trintaDias.saldo)}`}
        action={
          <Link
            to="/pessoal/receber"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline"
          >
            A receber
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-income/8 px-3.5 py-2.5">
            <p className="flex items-center gap-1 text-[11px] text-content-faint">
              <ArrowUpRight className="h-3 w-3 text-income" />
              Entra
            </p>
            <p className="tnum text-lg font-bold text-income">{formatCurrency(trintaDias.entra)}</p>
          </div>
          <div className="rounded-xl bg-expense/8 px-3.5 py-2.5">
            <p className="flex items-center gap-1 text-[11px] text-content-faint">
              <ArrowDownRight className="h-3 w-3 text-expense" />
              Sai
            </p>
            <p className="tnum text-lg font-bold text-expense">{formatCurrency(trintaDias.sai)}</p>
          </div>
        </div>

        {trintaDias.itens.length === 0 ? (
          <p className="text-sm text-content-muted">Nada previsto para os próximos 30 dias.</p>
        ) : (
          <ul className="divide-y divide-line">
            {trintaDias.itens.map((i, n) => (
              <li key={`${i.label}-${i.date}-${n}`} className="flex items-center gap-3 py-2.5">
                <span className="tnum w-12 shrink-0 text-xs text-content-muted">
                  {formatDateShort(i.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-content">{i.label}</span>
                <span
                  className={cn(
                    'tnum shrink-0 text-sm font-semibold',
                    i.kind === 'in' ? 'text-income' : 'text-expense',
                  )}
                >
                  {i.kind === 'in' ? '+' : '−'} {formatCurrency(i.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 4 ─────────────────────────────────────────── COMO ESTOU INDO */}
      <Section title="Como você está indo" subtitle="Entrou, custou e sobrou, mês a mês">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Mini rotulo="Custo de vida" valor={formatCurrency(vitals.livingCostAvg)} nota="média/mês" />
          <Mini
            rotulo="Compromisso fixo"
            valor={formatCurrency(folego.fixedCommitment)}
            nota={`${Math.round(folego.fixedShare * 100)}% do custo`}
          />
          <Mini
            rotulo="Taxa de poupança"
            valor={vitals.savingsRateAvg != null ? `${Math.round(vitals.savingsRateAvg * 100)}%` : '—'}
            nota="do que entra"
          />
        </div>
        {serie.length > 1 ? (
          <PersonalTrendChart data={serie} />
        ) : (
          <p className="flex items-start gap-2 text-sm text-content-muted">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
            Ainda faltam meses com movimento para a série fazer sentido. Ela aparece sozinha
            conforme você for lançando.
          </p>
        )}
      </Section>
    </div>
  )
}

function Mini({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-content-faint">{rotulo}</p>
      <p className="tnum text-sm font-bold text-content">{valor}</p>
      <p className="text-[10px] text-content-faint">{nota}</p>
    </div>
  )
}
