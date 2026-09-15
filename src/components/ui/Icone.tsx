import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Ícone (7.14): o único caminho para desenhar um lucide.
 *
 * Traço 1.6 fixo em todo tamanho, para o ícone pequeno não pesar mais que o
 * grande. Tamanho por contexto, e só estes:
 *   12  chip
 *   16  padrão: linha, botão, título de cartão, navegação
 *   20  barra inferior, toast
 *
 * Todo ícone significa algo. Sem `rotulo`, ele é reforço da palavra ao lado e
 * sai da árvore de acessibilidade; com `rotulo`, ele é a informação.
 */
export type TamanhoIcone = 12 | 16 | 20

export interface IconeProps {
  icone: LucideIcon
  tamanho?: TamanhoIcone
  /** Texto para leitor de tela quando o ícone está sozinho. */
  rotulo?: string
  className?: string
}

export function Icone({ icone: Glifo, tamanho = 16, rotulo, className }: IconeProps) {
  return (
    <Glifo
      size={tamanho}
      strokeWidth={1.6}
      className={cn('shrink-0', className)}
      aria-hidden={rotulo ? undefined : true}
      aria-label={rotulo}
      role={rotulo ? 'img' : undefined}
      focusable="false"
    />
  )
}
