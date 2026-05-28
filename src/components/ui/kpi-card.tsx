import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from './card'
import { cn, formatCurrency, formatPercent, formatNumber } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: number
  format?: 'currency' | 'percent' | 'number'
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple'
  subtitle?: string
  loading?: boolean
}

const colorMap = {
  blue: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
  green: 'text-green-500 bg-green-50 dark:bg-green-950/40',
  red: 'text-red-500 bg-red-50 dark:bg-red-950/40',
  amber: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
  purple: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40',
}

export function KpiCard({
  label,
  value,
  format = 'currency',
  change,
  changeLabel,
  icon,
  color = 'blue',
  subtitle,
  loading,
}: KpiCardProps) {
  const formatted =
    format === 'currency'
      ? formatCurrency(value)
      : format === 'percent'
        ? formatPercent(value)
        : formatNumber(value)

  const changePositive = change !== undefined && change > 0
  const changeNegative = change !== undefined && change < 0

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 md:p-5">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-7 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-muted-foreground font-medium">{label}</p>
              {icon && (
                <div className={cn('p-2 rounded-lg shrink-0', colorMap[color])}>
                  {icon}
                </div>
              )}
            </div>

            <p className="text-2xl font-bold text-foreground mt-1 tracking-tight">{formatted}</p>

            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}

            {change !== undefined && (
              <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', {
                'text-green-600 dark:text-green-400': changePositive,
                'text-red-500 dark:text-red-400': changeNegative,
                'text-muted-foreground': change === 0,
              })}>
                {changePositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : changeNegative ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                <span>
                  {change > 0 ? '+' : ''}{formatPercent(change, 1)} {changeLabel ?? 'vs mês anterior'}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
