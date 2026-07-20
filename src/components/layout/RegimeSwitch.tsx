import { useAppData } from '@/context/AppDataContext'
import { Tip } from '@/components/ui/Tip'
import { cn } from '@/lib/utils'
import type { Regime } from '@/types'

const OPTIONS: { value: Regime; label: string; short: string }[] = [
  { value: 'cash', label: 'Caixa', short: 'Caixa' },
  { value: 'accrual', label: 'Competência', short: 'Compet.' },
]

/**
 * Decide se os números da tela respondem "quanto entrou na conta" (caixa)
 * ou "quanto a empresa produziu" (competência). Fica sempre visível de
 * propósito: sem ele não dá para saber qual dos dois você está lendo.
 */
export function RegimeSwitch({ className }: { className?: string }) {
  const { regime, setRegime } = useAppData()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div
        className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
        role="radiogroup"
        aria-label="Regime de apuração"
      >
        {OPTIONS.map((o) => {
          const active = regime === o.value
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              onClick={() => setRegime(o.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                active
                  ? 'bg-white text-content shadow-card'
                  : 'text-content-muted hover:text-content',
              )}
            >
              <span className="hidden sm:inline">{o.label}</span>
              <span className="sm:hidden">{o.short}</span>
            </button>
          )
        })}
      </div>

      <Tip label="Diferença entre caixa e competência">
        <strong className="text-content">Caixa</strong> — “quanto entrou na conta neste mês”.
        Uma venda fechada em julho que só é paga em setembro aparece em{' '}
        <strong className="text-content">setembro</strong>. É o que você tem no bolso.
        <span className="mt-2 block">
          <strong className="text-content">Competência</strong> — “quanto a empresa produziu
          neste mês”. Essa mesma venda aparece em{' '}
          <strong className="text-content">julho</strong>, mês do contrato. É o que mede
          desempenho e serve para imposto.
        </span>
      </Tip>
    </div>
  )
}
