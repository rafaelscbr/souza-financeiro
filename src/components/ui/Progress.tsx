import { cn } from '@/lib/utils'

interface ProgressProps {
  /** 0..1 (será limitado a 100% na barra). */
  value: number
  className?: string
  barClassName?: string
  color?: string
}

export function Progress({ value, className, barClassName, color }: ProgressProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full bg-emerald transition-all duration-500', barClassName)}
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}
