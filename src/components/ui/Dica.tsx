import { type ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import { Icone } from './Icone'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * DICA (Fase 4; 5.2 nível 1a): a regra não óbvia escrita na tela.
 *
 * Sub-bloco dentro da caixa: fundo `s2`, sem borda, sem sombra, raio de caixa,
 * `px-4 py-3`, ícone 16. O tom pinta só o ícone (tinta `*-ink`); o texto é
 * `texto-corrido` em t2, lido como explicação e não como alerta. Não leva
 * `data-caixa` (7.11).
 */
export interface DicaProps {
  children: ReactNode
  /** Tom do ícone. Padrão `info`: explicar uma regra é informação. */
  tom?: Tom
  className?: string
}

export function Dica({ children, tom = 'info', className }: DicaProps) {
  return (
    <div data-dica className={cn('flex items-start gap-3 rounded-caixa bg-s2 px-4 py-3', className)}>
      {/* O ícone de 16 fica no meio da primeira linha de 22px. */}
      <span className="flex h-5 shrink-0 items-center">
        <Icone icone={Lightbulb} tamanho={16} className={TOM[tom].texto} />
      </span>
      <div className="min-w-0 max-w-[62ch] flex-1 text-texto-corrido text-t2">{children}</div>
    </div>
  )
}
