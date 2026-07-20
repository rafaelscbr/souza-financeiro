import { useMemo, useState } from 'react'
import { Lock, Unlock, ShieldCheck } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Tip } from '@/components/ui/Tip'
import { firstDayOfMonth } from '@/lib/finance'
import { formatDate, formatMonthYear } from '@/lib/format'

/**
 * Fechamento de mês. Sem ele, um relatório emitido hoje pode não bater com
 * o mesmo relatório emitido amanhã — e é a primeira coisa que um contador
 * ou auditor pergunta.
 */
export function PeriodClosingPanel() {
  const {
    periodClosings,
    costCentersReady,
    period,
    scopeCompanyId,
    activeCompany,
    closePeriod,
    reopenPeriod,
  } = useAppData()

  const [busy, setBusy] = useState(false)
  const month = firstDayOfMonth(period)

  const closing = useMemo(
    () =>
      periodClosings.find(
        (c) => c.month === month && (c.company_id === scopeCompanyId || c.company_id === null),
      ),
    [periodClosings, month, scopeCompanyId],
  )

  if (!costCentersReady) return null

  const scopeName = activeCompany ? activeCompany.name : 'todas as empresas'

  async function toggle() {
    setBusy(true)
    try {
      if (closing) await reopenPeriod(closing.id)
      else await closePeriod(scopeCompanyId, month)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Fechamento do mês"
      subtitle={`${formatMonthYear(period)} · ${scopeName}`}
      action={
        <Tip label="Para que serve fechar o mês">
          Fechar registra que os números daquele mês foram conferidos e estão finalizados. O
          sistema passa a avisar antes de qualquer alteração.
          <span className="mt-1.5 block">
            É o que garante que um relatório emitido hoje continue batendo com o mesmo relatório
            emitido daqui a seis meses — e a primeira coisa que um contador pergunta.
          </span>
        </Tip>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {closing ? (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-healthy/12 text-healthy">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-content">Mês fechado</p>
                <p className="text-xs text-content-faint">
                  Conferido em {formatDate(closing.closed_at.slice(0, 10))}
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-content-faint">
                <Unlock className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-content">Mês aberto</p>
                <p className="text-xs text-content-faint">
                  Feche quando terminar de conferir os lançamentos
                </p>
              </div>
            </>
          )}
        </div>

        <Button
          size="sm"
          variant={closing ? 'secondary' : 'primary'}
          onClick={toggle}
          disabled={busy}
        >
          {closing ? (
            <>
              <Unlock className="h-4 w-4" />
              Reabrir
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Fechar mês
            </>
          )}
        </Button>
      </div>
    </Section>
  )
}
