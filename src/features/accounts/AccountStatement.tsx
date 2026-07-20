import { useMemo } from 'react'
import { X, ArrowLeftRight } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { accountStatement } from '@/lib/treasury'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Account } from '@/types'

/**
 * Extrato conferível: uma linha por movimento, do mais antigo ao mais novo,
 * com saldo corrido. É o formato que permite bater com o extrato do banco.
 */
export function AccountStatement({ account, onClose }: { account: Account; onClose: () => void }) {
  const { transactions, transfers, accounts } = useAppData()

  const entries = useMemo(
    () => accountStatement(account, transactions, transfers, accounts),
    [account, transactions, transfers, accounts],
  )

  return (
    <Section
      title={`Extrato — ${account.name}`}
      subtitle={`Saldo inicial de ${formatCurrency(account.opening_balance)} em ${formatDateShort(account.opening_date)}`}
      action={
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-content-faint hover:bg-surface-2 hover:text-content"
          aria-label="Fechar extrato"
        >
          <X className="h-4 w-4" />
        </button>
      }
      bodyClassName="pt-1"
    >
      {entries.length === 0 ? (
        <p className="py-3 text-sm text-content-muted">
          Nenhum movimento nesta conta ainda. Ao registrar um lançamento como recebido ou pago,
          escolha esta conta e ele aparece aqui.
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-content-faint">
                <th className="px-2 py-2 font-medium">Data</th>
                <th className="px-2 py-2 font-medium">Descrição</th>
                <th className="px-2 py-2 text-right font-medium">Valor</th>
                <th className="px-2 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="px-2 py-2 text-xs text-content-faint">
                  {formatDateShort(account.opening_date)}
                </td>
                <td className="px-2 py-2 text-xs italic text-content-faint">Saldo inicial</td>
                <td className="px-2 py-2" />
                <td className="tnum px-2 py-2 text-right text-xs text-content-muted">
                  {formatCurrency(account.opening_balance)}
                </td>
              </tr>
              {entries.map((e) => (
                <tr key={`${e.kind}-${e.id}`}>
                  <td className="tnum px-2 py-2.5 text-xs text-content-muted">
                    {formatDateShort(e.date)}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {e.kind === 'transfer' && (
                        <ArrowLeftRight className="h-3 w-3 shrink-0 text-content-faint" />
                      )}
                      <span className="text-content">{e.description}</span>
                    </div>
                    <span className="text-[11px] text-content-faint">{e.category}</span>
                  </td>
                  <td
                    className={cn(
                      'tnum px-2 py-2.5 text-right font-semibold',
                      e.direction === 'in' ? 'text-income' : 'text-expense',
                    )}
                  >
                    {e.direction === 'in' ? '+' : '−'} {formatCurrency(e.amount)}
                  </td>
                  <td
                    className={cn(
                      'tnum px-2 py-2.5 text-right',
                      e.running >= 0 ? 'text-content-muted' : 'text-expense',
                    )}
                  >
                    {formatCurrency(e.running)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
