import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * Chip de status (seção 8). Só o que exige decisão ganha moldura: situação,
 * vencido, alerta. Categoria, conta e origem são contexto e leem como texto.
 *
 * Cor sozinha nunca comunica status (princípio 3), por isso o chip carrega
 * ícone e palavra junto com o tom.
 */
export function Chip({
  tom,
  icone: Icone,
  children,
  className,
}: {
  tom: Tom
  icone?: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] font-semibold',
        TOM[tom].fundo,
        TOM[tom].borda,
        TOM[tom].texto,
        className,
      )}
    >
      {Icone && <Icone size={11} strokeWidth={1.6} className="shrink-0" aria-hidden />}
      {children}
    </span>
  )
}
