import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  hint?: ReactNode
  icon?: ReactNode
  /** Cor do valor: 'positive' | 'negative' | 'neutral' | 'accent' */
  tone?: 'positive' | 'negative' | 'neutral' | 'accent'
  className?: string
}

const tones = {
  positive: 'text-income',
  negative: 'text-expense',
  neutral: 'text-content',
  accent: 'text-gold',
}

export function KpiCard({ label, value, hint, icon, tone = 'neutral', className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-content-faint">
          {label}
        </span>
        {icon && <span className="text-content-faint">{icon}</span>}
      </div>
      <p className={cn('tnum mt-2 text-2xl font-bold leading-tight sm:text-[1.7rem]', tones[tone])}>
        {value}
      </p>
      {hint && <div className="mt-1 text-xs text-content-muted">{hint}</div>}
    </div>
  )
}
