import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * O rótulo de dado (seção 4): pequeno, maiúsculo e discreto.
 *
 * Hierarquia é tamanho, não negrito. O rótulo diz o que o número é e sai da
 * frente; quem decide a ação é o número grande ao lado. `text-t4` é o menor
 * contraste permitido para informação, então o rótulo nunca desce disso.
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
  return (
    <Tag className={cn('font-label text-[11px] uppercase tracking-[0.14em] text-t4', className)}>{children}</Tag>
  )
}
