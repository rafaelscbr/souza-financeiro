import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { type Tom } from './tom'

/*
 * Título de bloco dentro de formulário longo ou folha (seção 8): ícone +
 * rótulo + descrição de 11px. Divide o formulário em blocos com nome sem
 * desenhar caixa dentro de caixa. Sem filete (ajuste do Rafael de 12/09);
 * `tom` é aceito e ignorado.
 */
export function SecaoTitulo({
  titulo,
  icone: Icone,
  descricao,
}: {
  titulo: ReactNode
  icone?: LucideIcon
  tom?: Tom
  descricao?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {Icone && <Icone size={15} strokeWidth={1.6} className="shrink-0 text-t3" aria-hidden />}
      <div className="min-w-0">
        <h3 className="font-label text-[11px] uppercase leading-4 tracking-[0.14em] text-t4">{titulo}</h3>
        {descricao && <div className="mt-0.5 text-[11px] text-t4">{descricao}</div>}
      </div>
    </div>
  )
}
