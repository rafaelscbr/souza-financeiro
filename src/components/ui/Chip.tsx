import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icone } from './Icone'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * Chip (7.7): situação, nunca categoria. Sempre ícone + palavra, porque cor
 * sozinha não comunica estado. 24px de altura, raio `controle`, texto `chip`
 * na tinta `*-ink` do tom, ícone 12. Nunca trunca.
 *
 * Para situação de parcela use `ChipSituacao` (Situacao.tsx), que tira tom,
 * ícone e palavra do mapa único; este é o desenho.
 */
export interface ChipProps {
  tom: Tom
  /** Obrigatório no uso final (7.7). Opcional só na transição. */
  icone?: LucideIcon
  children: ReactNode
  className?: string
}

export function Chip({ tom, icone, children, className }: ChipProps) {
  if (import.meta.env.DEV && !icone) {
    console.error('[Chip] sem ícone: todo chip é ícone + palavra (7.7).')
  }
  return (
    <span
      data-chip
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-controle border px-2 font-label text-chip',
        TOM[tom].fundo,
        TOM[tom].borda,
        TOM[tom].texto,
        className,
      )}
    >
      {icone && <Icone icone={icone} tamanho={12} />}
      {children}
    </span>
  )
}
