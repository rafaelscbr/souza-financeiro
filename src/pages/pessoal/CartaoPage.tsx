import { useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardPanel } from '@/features/personal/CardPanel'
import { CardStatementPanel } from '@/features/personal/CardStatementPanel'
import { Section } from '@/components/ui/Section'
import { StackedInvoiceChart } from '@/features/dashboard/Charts'
import { cardSummary } from '@/lib/cards'
import { cardIdsOf, invoiceSplit } from '@/lib/insights'
import { formatCurrency, formatMonthShort, parseDateOnly, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Faturas, limite e parcelas — tudo do cartão num lugar só. */
export function CartaoPage() {
  const { accounts, personalCompany, personalReady } = useAppData()
  const temCartao = useMemo(
    () =>
      accounts.some(
        (a) => a.is_active && a.company_id === personalCompany?.id && a.type === 'credit_card',
      ),
    [accounts, personalCompany],
  )

  if (!personalReady || !temCartao) {
    return (
      <EmptyState
        icon={<CreditCard className="h-8 w-8" />}
        title="Nenhum cartão cadastrado"
        description="Cadastre o cartão em Minhas contas para ver fatura, limite comprometido e as parcelas que ainda vão cair."
      />
    )
  }
  return (
    <div className="space-y-5">
      <ProximasFaturas />
      <CardPanel />
      <CardStatementPanel />
    </div>
  )
}

/**
 * As faturas que ainda vão fechar. O degrau que desce mostra em que mês cada
 * parcelamento termina — a informação que decide se dá para assumir mais uma
 * compra parcelada agora.
 */
function ProximasFaturas() {
  const { accounts, personalTransactions, transfers, personalCompany } = useAppData()
  const hoje = toDateOnly(new Date())

  const partes = useMemo(() => {
    const cartoes = accounts.filter(
      (a) => a.is_active && a.company_id === personalCompany?.id && a.type === 'credit_card',
    )
    if (cartoes.length === 0) return []
    const aberto = cardSummary(cartoes[0], personalTransactions, transfers, hoje).open.cycleMonth
    return invoiceSplit(personalTransactions, cardIdsOf(accounts, personalCompany?.id), aberto)
  }, [accounts, personalTransactions, transfers, personalCompany, hoje])

  if (partes.length < 2) return null

  const seuTotal = partes.reduce((s, p) => s + p.personal, 0)
  const empresaTotal = partes.reduce((s, p) => s + p.business, 0)
  const proxima = partes[0]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Cartao
          rotulo="Você paga"
          valor={proxima.personal}
          nota={`fatura de ${formatMonthShort(parseDateOnly(proxima.cycleMonth))}`}
          destaque
        />
        <Cartao rotulo="A imobiliária paga" valor={proxima.business} nota="a parte dela" cinza />
        <Cartao rotulo="Fatura cheia" valor={proxima.total} nota="o que o banco cobra" />
      </div>

      <Section
        title="Próximas faturas"
        subtitle={`${formatCurrency(seuTotal)} seus · ${formatCurrency(empresaTotal)} da imobiliária`}
      >
        <StackedInvoiceChart
          data={partes.map((p) => ({
            label: formatMonthShort(parseDateOnly(p.cycleMonth)),
            seu: p.personal,
            empresa: p.business,
          }))}
        />
        <p className="mt-2 text-xs text-content-muted">
          A barra cinza é a parte da imobiliária, que ela paga direto. Você desembolsa só a barra
          vermelha. Quando a PJ assumir o tráfego pago, a cinza some do seu cartão de vez.
        </p>
      </Section>
    </div>
  )
}

function Cartao({
  rotulo,
  valor,
  nota,
  destaque,
  cinza,
}: {
  rotulo: string
  valor: number
  nota: string
  destaque?: boolean
  cinza?: boolean
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-card">
      <p className="text-[11px] text-content-faint">{rotulo}</p>
      <p
        className={cn(
          'tnum text-base font-bold',
          destaque ? 'text-expense' : cinza ? 'text-content-muted' : 'text-content',
        )}
      >
        {formatCurrency(valor)}
      </p>
      <p className="text-[10px] text-content-faint">{nota}</p>
    </div>
  )
}
