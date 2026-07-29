import { useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardPanel } from '@/features/personal/CardPanel'

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
  return <CardPanel />
}
