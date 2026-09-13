import { type ReactNode } from 'react'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * Badge (seção 8): marcação menor que o chip, para contagem e etiqueta curta.
 * O ponto opcional é o sinal que não depende de a pessoa ler a palavra.
 */
export function Badge({ tom, ponto, children }: { tom: Tom; ponto?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs',
        TOM[tom].fundo,
        TOM[tom].borda,
        TOM[tom].texto,
      )}
    >
      {ponto && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TOM[tom].ponto)} aria-hidden />}
      {children}
    </span>
  )
}
