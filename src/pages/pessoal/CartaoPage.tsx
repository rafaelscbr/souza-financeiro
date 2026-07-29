import { useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardPanel } from '@/features/personal/CardPanel'
import { Section } from '@/components/ui/Section'
import { InvoiceForecastChart } from '@/features/dashboard/Charts'
import { cardSummary } from '@/lib/cards'
import { formatMonthShort, parseDateOnly, toDateOnly } from '@/lib/format'

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

  const dados = useMemo(() => {
    const cartoes = accounts.filter(
      (a) => a.is_active && a.company_id === personalCompany?.id && a.type === 'credit_card',
    )
    const porCiclo = new Map<string, number>()
    for (const c of cartoes) {
      for (const f of cardSummary(c, personalTransactions, transfers).invoices) {
        if (f.cycleMonth < hoje.slice(0, 8) + '01') continue
        porCiclo.set(f.cycleMonth, (porCiclo.get(f.cycleMonth) ?? 0) + f.total)
      }
    }
    return [...porCiclo.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(0, 12)
      .map(([ciclo, valor], i) => ({
        label: formatMonthShort(parseDateOnly(ciclo)),
        valor: Math.round(valor * 100) / 100,
        futura: i > 0,
      }))
  }, [accounts, personalTransactions, transfers, personalCompany, hoje])

  if (dados.length < 2) return null
  return (
    <Section
      title="Próximas faturas"
      subtitle="Quanto já está comprometido em cada mês pelas parcelas em curso"
    >
      <InvoiceForecastChart data={dados} />
    </Section>
  )
}
