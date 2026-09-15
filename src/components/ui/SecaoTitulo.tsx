import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icone } from './Icone'
import { type Tom } from './tom'

/*
 * DEPRECADO — apagar na limpeza final. Use `Cartao.Cabecalho` (7.1) ou, dentro
 * de painel e modal, `<section>` com `titulo-secao` (5.4).
 *
 * Título de bloco em formulário, folha e composição: ícone 16 + título
 * `titulo-secao` + descrição `texto-meta` a 4px. `tom` é aceito e ignorado.
 */
export function SecaoTitulo({
  titulo,
  icone,
  descricao,
}: {
  titulo: ReactNode
  icone?: LucideIcon
  tom?: Tom
  descricao?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {icone && (
        <span className="flex h-6 items-center text-t3">
          <Icone icone={icone} tamanho={16} />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-heading text-t1 text-titulo-secao">{titulo}</h3>
        {descricao && <div className="text-t-meta text-texto-meta">{descricao}</div>}
      </div>
    </div>
  )
}
