import type { LucideIcon } from 'lucide-react'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * Ícone dentro de um bloco tonalizado (7.14): o tom diz o assunto antes da
 * leitura. Três tamanhos e só estes: sm 28 (glifo 14), md 36 (glifo 16),
 * lg 44 (glifo 20). Traço 1.6 em todos. Raio `controle` (5.3).
 */
const TAMANHOS = {
  sm: { caixa: 'h-7 w-7', glifo: 14 },
  md: { caixa: 'h-9 w-9', glifo: 16 },
  lg: { caixa: 'h-11 w-11', glifo: 20 },
} as const

export interface IconeTomProps {
  icone: LucideIcon
  tom?: Tom
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
}

export function IconeTom({ icone: Glifo, tom = 'neutro', tamanho = 'md', className }: IconeTomProps) {
  const t = TAMANHOS[tamanho]
  return (
    <span
      data-icone-tom
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-controle border',
        t.caixa,
        TOM[tom].fundo,
        TOM[tom].borda,
        TOM[tom].texto,
        className,
      )}
      aria-hidden
    >
      <Glifo size={t.glifo} strokeWidth={1.6} focusable="false" />
    </span>
  )
}
