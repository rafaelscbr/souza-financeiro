import type { LucideIcon } from 'lucide-react'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * Ícone sempre dentro de um bloco tonalizado, nunca solto (seção 8).
 *
 * O bloco é o que faz o ícone ler como sinal e não como enfeite: fundo e
 * borda do tom dizem o assunto antes de a pessoa ler o texto ao lado. Os três
 * tamanhos são os do guia, e o traço é 1.6 em todos, para que o ícone pequeno
 * não pareça mais pesado que o grande.
 */
const TAMANHOS = {
  sm: { caixa: 'h-7 w-7 rounded-[9px]', icone: 13 },
  md: { caixa: 'h-9 w-9 rounded-[11px]', icone: 16 },
  lg: { caixa: 'h-11 w-11 rounded-[14px]', icone: 19 },
} as const

export function IconeTom({
  icone: Icone,
  tom = 'neutro',
  tamanho = 'md',
  className,
}: {
  icone: LucideIcon
  tom?: Tom
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const t = TAMANHOS[tamanho]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border',
        t.caixa,
        TOM[tom].fundo,
        TOM[tom].borda,
        TOM[tom].texto,
        className,
      )}
      aria-hidden
    >
      <Icone size={t.icone} strokeWidth={1.6} />
    </span>
  )
}
