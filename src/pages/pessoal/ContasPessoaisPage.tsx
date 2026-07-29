import { useMemo, useState } from 'react'
import { Landmark, Plus, Pencil } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountModal } from '@/features/accounts/AccountModal'
import { ACCOUNT_TYPE_LABEL, treasurySummary } from '@/lib/treasury'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Account } from '@/types'

/**
 * Contas da PESSOA FÍSICA — banco, caixinha e cartão do Rafael.
 *
 * Tela própria de propósito: as contas das empresas vivem em `/contas` e não
 * podem se misturar com estas. Foi a confusão entre os dois cadastros que
 * motivou a separação dos espaços.
 */
export function ContasPessoaisPage() {
  const { accounts, personalTransactions, transfers, personalCompany } = useAppData()
  const [editando, setEditando] = useState<Account | null>(null)
  const [aberto, setAberto] = useState(false)

  const minhas = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )
  const resumo = useMemo(
    () => treasurySummary(minhas, personalTransactions, transfers),
    [minhas, personalTransactions, transfers],
  )

  function novo() {
    setEditando(null)
    setAberto(true)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Cartao
          label="Disponível"
          valor={resumo.available}
          tom="positive"
          nota="soma de todas as contas"
        />
        <Cartao label="Fatura do cartão" valor={-resumo.cardDebt} tom="negative" nota="dívida em aberto" />
        <Cartao
          label="Sobra livre"
          valor={resumo.available - resumo.cardDebt}
          tom={resumo.available - resumo.cardDebt >= 0 ? 'neutral' : 'negative'}
          nota="disponível menos a fatura"
        />
      </div>

      <Section
        title="Minhas contas"
        subtitle={`${minhas.length} cadastrada(s)`}
        action={
          <Button size="sm" variant="secondary" onClick={novo}>
            <Plus className="h-4 w-4" />
            Nova conta
          </Button>
        }
      >
        {minhas.length === 0 ? (
          <EmptyState
            icon={<Landmark className="h-7 w-7" />}
            title="Nenhuma conta pessoal"
            description="Cadastre seu banco, sua caixinha de investimento e seu cartão de crédito para o painel calcular saldo, reserva e fatura."
            action={<Button onClick={novo}>Cadastrar conta</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {resumo.balances.map((b) => (
              <li key={b.account.id} className="flex items-center gap-3 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                  style={{ backgroundColor: b.account.color }}
                >
                  {b.account.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{b.account.name}</p>
                  <p className="truncate text-xs text-content-faint">
                    {ACCOUNT_TYPE_LABEL[b.account.type]}
                    {b.account.bank && ` · ${b.account.bank}`}
                    {b.account.type === 'credit_card' && b.account.card_due_day != null &&
                      ` · vence dia ${b.account.card_due_day}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'tnum text-sm font-semibold',
                      b.balance < 0 ? 'text-expense' : 'text-content',
                    )}
                  >
                    {formatCurrency(b.balance)}
                  </p>
                  <p className="text-[10px] text-content-faint">
                    desde {formatDateShort(b.account.opening_date)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditando(b.account)
                    setAberto(true)
                  }}
                  className="shrink-0 rounded-lg p-2 text-content-faint transition-colors hover:bg-surface-2 hover:text-content"
                  aria-label={`Editar ${b.account.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {aberto && (
        <AccountModal
          key={editando?.id ?? 'nova'}
          open={aberto}
          editing={editando}
          escopo="pessoal"
          onClose={() => {
            setAberto(false)
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

function Cartao({
  label,
  valor,
  tom,
  nota,
}: {
  label: string
  valor: number
  tom: 'positive' | 'negative' | 'neutral'
  nota: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-xs text-content-faint">{label}</p>
      <p
        className={cn(
          'tnum text-lg font-bold',
          tom === 'positive' ? 'text-income' : tom === 'negative' ? 'text-expense' : 'text-content',
        )}
      >
        {formatCurrency(valor)}
      </p>
      <p className="text-[10px] text-content-faint">{nota}</p>
    </div>
  )
}
