import { useMemo, useState } from 'react'
import {
  Landmark,
  PlusCircle,
  ArrowLeftRight,
  Database,
  AlertTriangle,
  Pencil,
  Trash2,
  Wallet,
  PiggyBank,
  Banknote,
  TrendingUp,
  CreditCard,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tip } from '@/components/ui/Tip'
import { AccountModal } from '@/features/accounts/AccountModal'
import { TransferModal } from '@/features/accounts/TransferModal'
import { AccountStatement } from '@/features/accounts/AccountStatement'
import { treasurySummary, ACCOUNT_TYPE_LABEL } from '@/lib/treasury'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Account, AccountType } from '@/types'

const TYPE_ICON: Record<AccountType, typeof Wallet> = {
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  investment: TrendingUp,
  credit_card: CreditCard,
}

export function ContasPage() {
  const {
    accounts,
    transfers,
    transactions,
    treasuryReady,
    scopeCompanyId,
    activeCompany,
    deleteAccount,
  } = useAppData()

  const [accountModal, setAccountModal] = useState(false)
  const [transferModal, setTransferModal] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [openStatement, setOpenStatement] = useState<string | null>(null)

  // Contas seguem o escopo do topo, como todo o resto do app.
  const scoped = useMemo(
    () => accounts.filter((a) => scopeCompanyId === null || a.company_id === scopeCompanyId),
    [accounts, scopeCompanyId],
  )

  const summary = useMemo(
    () => treasurySummary(scoped, transactions, transfers),
    [scoped, transactions, transfers],
  )

  if (!treasuryReady) {
    return (
      <div className="animate-fade-in space-y-5">
        <Header />
        <EmptyState
          icon={<Database className="h-8 w-8" />}
          title="Falta aplicar a migração da tesouraria"
          description="As contas precisam de duas tabelas novas no Supabase. Abra o SQL Editor, cole o conteúdo de supabase/migrations/002_tesouraria.sql e clique em Run. Depois recarregue esta tela."
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-3">
        <Header />
        <div className="flex shrink-0 gap-2">
          {scoped.length >= 2 && (
            <Button size="sm" variant="secondary" onClick={() => setTransferModal(true)}>
              <ArrowLeftRight className="h-4 w-4" />
              <span className="hidden sm:inline">Transferir</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setAccountModal(true)
            }}
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Nova conta</span>
          </Button>
        </div>
      </div>

      {scoped.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-8 w-8" />}
          title="Cadastre sua primeira conta"
          description="Uma conta é onde o dinheiro fica de verdade: Banco do Brasil, Nubank, a caixinha em espécie. Informe o saldo que existe hoje e, daí em diante, o sistema acompanha cada entrada e saída — igual ao aplicativo do seu banco."
          action={
            <Button
              onClick={() => {
                setEditing(null)
                setAccountModal(true)
              }}
            >
              <PlusCircle className="h-4 w-4" />
              Cadastrar conta
            </Button>
          }
        />
      ) : (
        <>
          {/* Saldo consolidado */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-content-faint">
                Saldo total {activeCompany ? `· ${activeCompany.name}` : 'do grupo'}
              </span>
              <Tip label="Como o saldo é calculado" align="start">
                Saldo inicial de cada conta, mais tudo que <strong className="text-content">já
                foi recebido</strong>, menos tudo que <strong className="text-content">já foi
                pago</strong>. Contas a receber e a pagar não entram — compromisso não é
                dinheiro em conta.
              </Tip>
            </div>
            <p
              className={cn(
                'tnum mt-1 text-3xl font-bold',
                summary.total >= 0 ? 'text-content' : 'text-expense',
              )}
            >
              {formatCurrency(summary.total)}
            </p>
            <p className="mt-1 text-xs text-content-faint">
              {summary.balances.length} {summary.balances.length === 1 ? 'conta' : 'contas'}
            </p>
          </div>

          {/* Movimento sem conta */}
          {summary.unassignedCount > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-pending/25 bg-pending/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
              <div className="text-sm text-content-muted">
                <p>
                  <strong className="text-content">
                    {summary.unassignedCount}{' '}
                    {summary.unassignedCount === 1 ? 'lançamento liquidado' : 'lançamentos liquidados'}
                  </strong>{' '}
                  ainda não têm conta definida, somando{' '}
                  <strong className="text-content">{formatCurrency(summary.unassigned)}</strong>.
                </p>
                <p className="mt-1 text-xs">
                  Eles ficam de fora do saldo acima de propósito — somá-los daria um total que não
                  corresponde a banco nenhum. Edite cada lançamento e escolha a conta para
                  incorporá-los.
                </p>
              </div>
            </div>
          )}

          {/* Contas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {summary.balances.map((b) => {
              const Icon = TYPE_ICON[b.account.type]
              return (
                <div
                  key={b.account.id}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-card"
                  style={{ borderLeft: `4px solid ${b.account.color}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${b.account.color}1A`, color: b.account.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-content">
                          {b.account.name}
                        </p>
                        <p className="truncate text-[11px] text-content-faint">
                          {ACCOUNT_TYPE_LABEL[b.account.type]}
                          {b.account.bank && ` · ${b.account.bank}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        onClick={() => {
                          setEditing(b.account)
                          setAccountModal(true)
                        }}
                        className="rounded-lg p-1.5 text-content-faint hover:bg-surface-2 hover:text-content"
                        aria-label={`Editar ${b.account.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (b.movements > 0) return
                          void deleteAccount(b.account.id)
                        }}
                        disabled={b.movements > 0}
                        title={
                          b.movements > 0
                            ? 'Conta com movimento não pode ser excluída — desative-a na edição'
                            : 'Excluir conta'
                        }
                        className="rounded-lg p-1.5 text-content-faint hover:bg-surface-2 hover:text-expense disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-content-faint"
                        aria-label={`Excluir ${b.account.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p
                    className={cn(
                      'tnum mt-3 text-2xl font-bold',
                      b.balance >= 0 ? 'text-content' : 'text-expense',
                    )}
                  >
                    {formatCurrency(b.balance)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-content-faint">
                    <span>Inicial {formatCurrency(b.opening)}</span>
                    <span className="text-income">+{formatCurrency(b.inflow)}</span>
                    <span className="text-expense">−{formatCurrency(b.outflow)}</span>
                    {b.transfersNet !== 0 && (
                      <span>Transf. {formatCurrency(b.transfersNet)}</span>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      setOpenStatement(openStatement === b.account.id ? null : b.account.id)
                    }
                    className="mt-3 text-xs font-medium text-emerald hover:underline"
                  >
                    {openStatement === b.account.id ? 'Fechar extrato' : 'Ver extrato'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Extrato */}
          {openStatement && (
            <AccountStatement
              account={scoped.find((a) => a.id === openStatement)!}
              onClose={() => setOpenStatement(null)}
            />
          )}

          {/* Transferências recentes */}
          {transfers.length > 0 && (
            <Section
              title="Transferências"
              subtitle="Dinheiro movido entre suas contas — não afeta receita nem despesa"
              bodyClassName="pt-1"
            >
              <ul className="divide-y divide-line">
                {transfers.slice(0, 8).map((t) => {
                  const from = accounts.find((a) => a.id === t.from_account_id)
                  const to = accounts.find((a) => a.id === t.to_account_id)
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <ArrowLeftRight className="h-4 w-4 shrink-0 text-content-faint" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-content">
                          {from?.name ?? '—'} → {to?.name ?? '—'}
                        </p>
                        {t.description && (
                          <p className="truncate text-xs text-content-faint">{t.description}</p>
                        )}
                      </div>
                      <span className="tnum shrink-0 text-sm font-semibold text-content">
                        {formatCurrency(t.amount)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
        </>
      )}

      <AccountModal
        open={accountModal}
        editing={editing}
        onClose={() => {
          setAccountModal(false)
          setEditing(null)
        }}
      />
      <TransferModal
        open={transferModal}
        accounts={scoped}
        onClose={() => setTransferModal(false)}
      />
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold text-content">
        Contas
        <Tip label="Para que serve esta tela" align="start">
          Aqui mora o seu dinheiro de verdade. Cadastre cada banco, a caixinha em espécie e os
          investimentos com o saldo que existe hoje — daí em diante o sistema acompanha e o
          número passa a bater com o extrato.
        </Tip>
      </h1>
      <p className="text-sm text-content-faint">Onde o dinheiro está, agora</p>
    </div>
  )
}
