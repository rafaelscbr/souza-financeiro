import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Section({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface shadow-card', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-content">{title}</h2>
          {subtitle && <p className="text-xs text-content-faint">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={cn('px-5 pb-5', bodyClassName)}>{children}</div>
    </section>
  )
}
