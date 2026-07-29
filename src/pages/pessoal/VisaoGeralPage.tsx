import { useMemo, useState } from 'react'
import { Wallet, TrendingDown, PiggyBank, Sparkles, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppData } from '@/context/AppDataContext'
import { KpiCard } from '@/components/ui/KpiCard'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { VitalsPanel } from '@/features/personal/VitalsPanel'
import { PersonalTrendChart } from '@/features/dashboard/Charts'
import { SurvivalPanel } from '@/features/personal/SurvivalPanel'
import { PersonalTransactionModal } from '@/features/personal/PersonalTransactionModal'
import { PersonalRow } from '@/features/personal/PersonalRow'
import { SettleModal } from '@/features/transactions/SettleModal'
import { cardPayables, cardSummary } from '@/lib/cards'
import { activeInstallments, recurringSpend } from '@/lib/insights'
import { personalVitals } from '@/lib/personal'
import { nextObligations, survival } from '@/lib/survival'
import { inMonth, isOwnerPayout, lastNMonths, personalSummary } from '@/lib/finance'
import { formatCurrency, formatMonthShort, formatMonthYear, toDateOnly } from '@/lib/format'
import type { Transaction } from '@/types'

/**
 * A tela que abre o módulo pessoal. Responde três perguntas, nesta ordem:
 * quanto tempo eu aguento, como foi o mês, e o que aconteceu.
 *
 * Tudo que é aprofundamento (categorias, cartão, patrimônio) virou tela
 * própria — empilhar doze painéis aqui era o que deixava a página confusa.
 */
export function VisaoGeralPage() {
  const {
    personalTransactions, businessTransactions, personalAssets, personalCompany, personalReady,
    categories, accounts, transfers, period, regime, deleteTransaction, deleteGroup,
  } = useAppData()

  const [editando, setEditando] = useState<Transaction | null>(null)
  const [editAberto, setEditAberto] = useState(false)
  const [baixando, setBaixando] = useState<Transaction | null>(null)

  const contasPF = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )
  const resumo = useMemo(
    () => personalSummary(personalTransactions, businessTransactions, period, regime),
    [personalTransactions, businessTransactions, period, regime],
  )
  const vitals = useMemo(
    () => personalVitals(personalTransactions, businessTransactions, contasPF, transfers, period, regime),
    [personalTransactions, businessTransactions, contasPF, transfers, period, regime],
  )

  // Compromisso fixo = recorrente estável + parcelas ainda por cair.
  const compromisso = useMemo(() => {
    const meses = lastNMonths(period, 6)
    const rec = recurringSpend(personalTransactions, meses, regime)
    const parc = activeInstallments(personalTransactions, toDateOnly(new Date()))
    return rec.monthlyTotal + parc.reduce((s, p) => s + p.monthly, 0)
  }, [personalTransactions, period, regime])

  const faturas = useMemo(() => {
    if (!personalReady || !personalCompany) return []
    const cartoes = accounts.filter(
      (a) => a.is_active && a.company_id === personalCompany.id && a.type === 'credit_card',
    )
    return cardPayables(cartoes.map((c) => cardSummary(c, personalTransactions, transfers))).filter(
      (p) => p.state !== 'future',
    )
  }, [personalReady, personalCompany, accounts, personalTransactions, transfers])

  const folego = useMemo(
    () =>
      survival({
        liquid: vitals.liquid,
        livingCostAvg: vitals.livingCostAvg,
        fixedCommitment: compromisso,
        assets: personalAssets,
      }),
    [vitals, compromisso, personalAssets],
  )

  const proximas = useMemo(
    () =>
      nextObligations([
        ...faturas.map((f) => ({
          label: `Fatura ${f.account.name}`,
          amount: f.amount,
          date: f.dueDate,
        })),
        ...personalTransactions
          .filter((t) => t.status === 'pending')
          .map((t) => ({
            label: t.description || t.category,
            amount: t.amount,
            date: t.due_date ?? t.competence_date,
          })),
      ]),
    [faturas, personalTransactions],
  )

  // A série já vem calculada nos vitals — aqui é só dar forma de gráfico.
  const serieGrafico = useMemo(
    () =>
      vitals.series.map((p) => ({
        label: formatMonthShort(p.date),
        renda: p.inflow,
        custo: p.livingCost,
        sobra: p.surplus,
      })),
    [vitals.series],
  )

  const doMes = useMemo(
    () =>
      personalTransactions
        .filter((t) => inMonth(t, period, regime))
        .sort((a, b) =>
          (a.settled_date ?? a.due_date ?? a.competence_date) <
          (b.settled_date ?? b.due_date ?? b.competence_date)
            ? 1
            : -1,
        ),
    [personalTransactions, period, regime],
  )
  const retiradas = useMemo(
    () => businessTransactions.filter((t) => isOwnerPayout(t) && inMonth(t, period, regime)),
    [businessTransactions, period, regime],
  )

  if (doMes.length === 0 && retiradas.length === 0 && contasPF.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="Suas finanças pessoais começam aqui"
        description="Cadastre suas contas e lance seus gastos. O que as empresas te pagam entra sozinho como entrada."
      />
    )
  }

  return (
    <div className="space-y-5">
      <SurvivalPanel s={folego} proximas={proximas} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Entradas"
          value={formatCurrency(resumo.inflow)}
          tone="positive"
          icon={<Wallet className="h-4 w-4" />}
          hint={
            resumo.inflowFromBusiness > 0
              ? `Das empresas: ${formatCurrency(resumo.inflowFromBusiness)}`
              : undefined
          }
        />
        <KpiCard
          label="Saídas"
          value={formatCurrency(resumo.outflow)}
          tone="negative"
          icon={<TrendingDown className="h-4 w-4" />}
          hint={
            resumo.businessPaid > 0
              ? `${formatCurrency(resumo.businessPaid)} são da empresa`
              : undefined
          }
        />
        <KpiCard
          label="Sobra"
          value={formatCurrency(resumo.surplus)}
          tone={resumo.surplus >= 0 ? 'positive' : 'negative'}
          icon={<PiggyBank className="h-4 w-4" />}
          hint={resumo.surplus < 0 ? 'Gastou mais do que entrou' : 'Disponível pra poupar'}
        />
        <KpiCard
          label="Investido/Poupado"
          value={formatCurrency(resumo.invested)}
          tone="accent"
          icon={<PiggyBank className="h-4 w-4" />}
        />
      </div>

      <VitalsPanel vitals={vitals} />

      {serieGrafico.length > 1 && (
        <Section
          title="Sua história mês a mês"
          subtitle="O que entrou, o que a vida custou e o que sobrou"
        >
          <PersonalTrendChart data={serieGrafico} />
        </Section>
      )}

      <Section
        title="Movimentações do mês"
        subtitle={`${doMes.length + retiradas.length} registros · ${formatMonthYear(period)}`}
        action={
          <Link
            to="/pessoal/gastos"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline"
          >
            Ver análise
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <ul className="divide-y divide-line">
          {doMes.slice(0, 12).map((t) => (
            <PersonalRow
              key={t.id}
              tx={t}
              categoryIcon={
                categories.find(
                  (c) => c.company_id === personalCompany?.id && c.name === t.category && c.kind === t.kind,
                )?.icon ?? null
              }
              onEdit={() => {
                setEditando(t)
                setEditAberto(true)
              }}
              onSettle={t.status === 'pending' ? () => setBaixando(t) : undefined}
              onDelete={() => (t.group_id ? deleteGroup(t.group_id) : deleteTransaction(t.id))}
            />
          ))}
        </ul>
        {doMes.length > 12 && (
          <p className="pt-3 text-center text-xs text-content-faint">
            mostrando 12 de {doMes.length} — as demais estão em Gastos
          </p>
        )}
      </Section>

      <PersonalTransactionModal
        open={editAberto}
        onClose={() => {
          setEditAberto(false)
          setEditando(null)
        }}
        editing={editando}
      />
      <SettleModal tx={baixando} onClose={() => setBaixando(null)} />
    </div>
  )
}
