import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, X, Sparkles } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'sgf.setupDismissed'

interface Step {
  id: string
  label: string
  hint: string
  done: boolean
  to: string
  cta: string
}

/**
 * Guia de primeiros passos. Some sozinho quando tudo está configurado —
 * um checklist que fica para sempre vira ruído, não ajuda.
 */
export function SetupChecklist() {
  const { businessCompanies, accounts, transactions, treasuryReady } = useAppData()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const steps = useMemo<Step[]>(
    () => [
      {
        id: 'accounts',
        label: 'Cadastrar suas contas',
        hint: 'Informe o saldo que existe hoje em cada banco. É daí que o sistema parte.',
        done: !treasuryReady || accounts.length > 0,
        to: '/contas',
        cta: 'Cadastrar conta',
      },
      {
        id: 'tax',
        label: 'Configurar a alíquota de imposto',
        hint: 'Sem ela, o lucro na tela aparece maior do que o real.',
        done: businessCompanies.every((c) => c.tax_rate != null),
        to: '/relatorios',
        cta: 'Configurar',
      },
      {
        id: 'tx',
        label: 'Fazer o primeiro lançamento',
        hint: 'Uma comissão, uma despesa — os painéis se montam a partir daqui.',
        done: transactions.length > 0,
        to: '/lancamentos',
        cta: 'Lançar',
      },
    ],
    [businessCompanies, accounts, transactions, treasuryReady],
  )

  const pending = steps.filter((s) => !s.done)
  if (dismissed || pending.length === 0) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sem localStorage o checklist só reaparece na próxima sessão
    }
  }

  return (
    <div className="rounded-2xl border border-emerald/20 bg-emerald-soft/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-dark" />
          <h2 className="text-sm font-bold text-content">
            Primeiros passos · {steps.length - pending.length} de {steps.length}
          </h2>
        </div>
        <button
          onClick={dismiss}
          className="rounded-lg p-1 text-content-faint transition-colors hover:bg-surface-2 hover:text-content"
          aria-label="Dispensar guia de primeiros passos"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2.5">
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-dark" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-content-faint" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  s.done ? 'text-content-faint line-through' : 'text-content',
                )}
              >
                {s.label}
              </p>
              {!s.done && <p className="text-xs text-content-muted">{s.hint}</p>}
            </div>
            {!s.done && (
              <Link
                to={s.to}
                className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-emerald-dark shadow-card transition-colors hover:bg-emerald hover:text-white"
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-content-muted">
        Não sabe o que significa algum termo?{' '}
        <Link to="/ajuda" className="font-medium text-emerald-dark hover:underline">
          Veja o glossário
        </Link>
        .
      </p>
    </div>
  )
}
