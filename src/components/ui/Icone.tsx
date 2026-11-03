import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Ícone (7.14): o único caminho para desenhar um lucide.
 *
 * Folha Clara: traço 2 até 16px (para não sumir) e 1,8 acima. Tamanho por
 * contexto, e só estes:
 *   12  chip
 *   16  padrão: linha, botão, menu
 *   18  barra do topo
 *   20  barra de baixo, aviso
 *   22  estado vazio
 *
 * Todo ícone significa algo. Sem `rotulo`, ele é reforço da palavra ao lado e
 * sai da árvore de acessibilidade; com `rotulo`, ele é a informação.
 */
export type TamanhoIcone = 12 | 16 | 18 | 20 | 22

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
      strokeWidth={tamanho <= 16 ? 2 : 1.8}
      className={cn('shrink-0', className)}
      aria-hidden={rotulo ? undefined : true}
      aria-label={rotulo}
      role={rotulo ? 'img' : undefined}
      focusable="false"
    />
  )
}
