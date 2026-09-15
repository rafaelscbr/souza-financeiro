import { type ReactNode } from 'react'
import { type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * Badge (7.7): contagem. Pílula de 20px de altura, largura mínima 20, algarismo
 * tabular. Neutro por padrão; `risco` quando a contagem é de algo vencido;
 * `zero` apaga a tinta para t-meta.
 */
export interface BadgeProps {
  children: ReactNode
  risco?: boolean
  zero?: boolean
  className?: string
  /** DEPRECADO — apagar na limpeza final. Só 'risco' tem efeito (vira `risco`). */
  tom?: Tom
  /** DEPRECADO — apagar na limpeza final. Sem efeito: badge não tem ponto decorativo (7.14). */
  ponto?: boolean
}

export function Badge({ children, risco, zero, className, tom }: BadgeProps) {
  const emRisco = risco || tom === 'risco'
  return (
    <span
      data-badge
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-1 font-label text-chip num',
        emRisco ? 'bg-error-bg text-error-ink' : 'bg-s2 text-t2',
        zero && 'text-t-meta',
        className,
      )}
    >
      {children}
    </span>
  )
}
