import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * Rótulo de dado (6.1, token `rotulo`): Inter 11/16, 500, 0.14em, MAIÚSCULAS,
 * cor t-meta. Só para rótulo de dado, cabeçalho de coluna e grupo do trilho;
 * nunca título de cartão (esse é `titulo-secao`).
 */
export function Rotulo({
  children,
  className,
  as: Tag = 'p',
}: {
  children: ReactNode
  className?: string
  as?: 'p' | 'span' | 'h2' | 'h3' | 'dt'
}) {
  return <Tag className={cn('font-label text-rotulo uppercase text-t-meta', className)}>{children}</Tag>
}
