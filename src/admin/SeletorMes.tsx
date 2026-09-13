import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAdmin } from './AdminData'
import { formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * O NAVEGADOR DE MÊS do administrador.
 *
 * Saiu do cabeçalho da casca para virar peça que a tela põe nas ações do
 * PageLayout: só as telas que dependem do mês mostram o mês. Quem lê e muda o
 * mês continua sendo o AdminData; aqui não há estado nenhum.
 *
 * Alvos de 40px (seção 12). No meio, o nome do mês volta para o mês atual; o
 * leitor de tela ouve o mês novo a cada seta (aria-live), porque a seta sozinha
 * não diz onde se chegou.
 */
export function SeletorMes({ className }: { className?: string }) {
  const { mes, mesAnterior, mesSeguinte, irParaMes } = useAdmin()
  const agora = new Date()
  const noMesAtual = mes.getFullYear() === agora.getFullYear() && mes.getMonth() === agora.getMonth()
  const nome = formatMonthYear(mes)

  const seta =
    'flex w-10 shrink-0 items-center justify-center text-t3 transition-colors duration-150 hover:bg-s2 hover:text-t1'

  return (
    <div
      role="group"
      aria-label="Mês"
      className={cn(
        'inline-flex h-10 items-stretch overflow-hidden rounded-lg border border-line bg-surface shadow-card',
        className,
      )}
    >
      <button type="button" onClick={mesAnterior} aria-label="Mês anterior" className={seta}>
        <ChevronLeft size={16} strokeWidth={1.6} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => irParaMes(new Date())}
        title={noMesAtual ? 'Mês atual' : 'Voltar para o mês atual'}
        aria-label={noMesAtual ? `${nome}, mês atual` : `${nome}. Voltar para o mês atual`}
        className="flex min-w-[8.5rem] flex-1 items-center justify-center gap-2 border-x border-line px-3 text-[13px] font-semibold text-t1 transition-colors duration-150 hover:bg-s2"
      >
        <CalendarDays size={14} strokeWidth={1.6} aria-hidden className="hidden text-t4 sm:block" />
        <span aria-live="polite" className="whitespace-nowrap tabular-nums">
          {nome}
        </span>
      </button>
      <button type="button" onClick={mesSeguinte} aria-label="Mês seguinte" className={seta}>
        <ChevronRight size={16} strokeWidth={1.6} aria-hidden />
      </button>
    </div>
  )
}
