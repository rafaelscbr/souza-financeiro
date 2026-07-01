import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { formatMonthYear } from '@/lib/format'
import { monthKey } from '@/lib/finance'
import { cn } from '@/lib/utils'

export function PeriodNav({ className }: { className?: string }) {
  const { period, goToPrevMonth, goToNextMonth, goToCurrentMonth } = useAppData()
  const isCurrent = monthKey(period) === monthKey(new Date())

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={goToPrevMonth}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        onClick={goToCurrentMonth}
        className="min-w-[8.5rem] rounded-lg px-2 py-1.5 text-center text-sm font-semibold text-content transition-colors hover:bg-surface-2"
        aria-label={`Mês em foco: ${formatMonthYear(period)}. Clique para voltar ao mês atual.`}
      >
        {formatMonthYear(period)}
      </button>

      <button
        onClick={goToNextMonth}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {!isCurrent && (
        <button
          onClick={goToCurrentMonth}
          className="ml-1 hidden items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content sm:inline-flex"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Hoje
        </button>
      )}
    </div>
  )
}
