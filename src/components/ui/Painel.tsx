import { createContext, useContext, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icone } from './Icone'
import { type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * DEPRECADO — apagar na limpeza final. Use `Cartao` (7.1).
 *
 * Mantido para as telas antigas (Vendas, Recebimentos, Assinatura,
 * FolhaDeLancamento) até a Fase 6, já com a borda e o recuo do documento:
 * caixa `rounded-caixa border-fio-caixa bg-surface shadow-card`, sem
 * `overflow-hidden`, e título com `px-recuo pt-recuo pb-3` (3.3).
 */

/*
 * DEPRECADO — apagar na limpeza final (junto com o SuperficieContext).
 * Onde uma Lista antiga está. Não há mais sangria: 'sangria' e 'painel' viram
 * `contexto="cartao"` na Lista; 'plano' vira `contexto="sobreposicao"`; 'solta'
 * faz a Lista desenhar a própria caixa.
 */
export type Superficie = 'solta' | 'painel' | 'sangria' | 'plano'

export const SuperficieContext = createContext<Superficie>('solta')

export function useSuperficie(): Superficie {
  return useContext(SuperficieContext)
}

export function Painel({
  children,
  dourado,
  className,
}: {
  children: ReactNode
  /** Borda `borda-ouro`. Um só por tela. */
  dourado?: boolean
  className?: string
}) {
  return (
    <section
      data-caixa=""
      className={cn(
        'relative flex min-w-0 flex-col rounded-caixa border bg-surface shadow-card',
        dourado ? 'border-borda-ouro' : 'border-fio-caixa',
        className,
      )}
    >
      <SuperficieContext.Provider value="painel">{children}</SuperficieContext.Provider>
    </section>
  )
}

/** DEPRECADO — apagar na limpeza final. Use `Cartao.Cabecalho`. `tom` é aceito e ignorado. */
export function PainelTitulo({
  titulo,
  icone,
  descricao,
  extra,
}: {
  titulo: ReactNode
  icone?: LucideIcon
  tom?: Tom
  descricao?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-3 px-recuo pb-3 pt-recuo">
      {titulo && icone ? (
        <span className="flex text-t3">
          <Icone icone={icone} tamanho={16} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {titulo ? <h2 className="font-heading text-t1 text-titulo-secao">{titulo}</h2> : null}
        {descricao && <div className="text-t-meta text-texto-meta">{descricao}</div>}
      </div>
      {extra && <div className="ms-auto flex shrink-0 items-center gap-3">{extra}</div>}
    </div>
  )
}
