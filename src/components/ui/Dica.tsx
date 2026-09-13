import { type ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * A dica escrita na tela (princípio 11): a regra não óbvia vira texto, em vez
 * de morar na cabeça de quem montou o sistema. Ex.: "previsão não entra no
 * devido". Tom padrão `info`, porque explicar uma regra é informação neutra,
 * não alerta.
 *
 * O tom pinta a caixa e a lâmpada; o texto fica em `text-t2`, que é a cor de
 * corpo, para a explicação ser lida como explicação e não como aviso.
 */
export function Dica({ children, tom = 'info' }: { children: ReactNode; tom?: Tom }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-[14px] border px-3.5 py-2.5', TOM[tom].fundo, TOM[tom].borda)}>
      <Lightbulb size={13} strokeWidth={1.6} className={cn('mt-[3px] shrink-0', TOM[tom].texto)} aria-hidden />
      <div className="min-w-0 text-[13px] leading-relaxed text-t2">{children}</div>
    </div>
  )
}
