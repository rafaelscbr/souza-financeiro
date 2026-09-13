import { createContext, useContext, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * ONDE UMA LISTA ESTÁ.
 *
 * "Nem tudo é card" (seção 5): borda, fundo, raio e sombra dizem "objeto
 * separado", e caixa dentro de caixa dentro de caixa é o que o guia proíbe.
 * Uma Lista solta na página é um objeto e ganha a `list-surface`; a mesma
 * Lista dentro de um Painel já está sobre uma superfície e deve ser só linhas.
 * Em vez de cada tela lembrar de trocar uma prop, o Painel avisa por contexto.
 *
 *   solta    fora de qualquer painel: a Lista desenha a própria superfície.
 *   painel   direto no Painel, sem padding em volta: linhas com px próprio.
 *   sangria  dentro do corpo com padding da Secao: a Lista vaza até a borda
 *            do painel, para o hover e o fio da linha irem de ponta a ponta.
 *   plano    dentro de folha ou formulário, sem painel: linhas quase sem recuo.
 */
export type Superficie = 'solta' | 'painel' | 'sangria' | 'plano'

export const SuperficieContext = createContext<Superficie>('solta')

export function useSuperficie(): Superficie {
  return useContext(SuperficieContext)
}

/*
 * O PAINEL (seção 8): superfície lisa com grão, borda de 1px e sombra de card.
 * Sem degradê: ajuste do Rafael de 12/09, que vale acima do princípio 4.
 *
 * `dourado` troca a borda por Areia (sem filete nem brilho, ajuste de 12/09). É o
 * único bloco dourado da tela (princípio 2), reservado ao número que carrega
 * o julgamento. Se dois painéis da mesma tela pedirem `dourado`, um deles
 * está errado.
 */
export function Painel({
  children,
  dourado,
  className,
}: {
  children: ReactNode
  dourado?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[14px] border border-line surface-premium shadow-card',
        dourado && 'gold-edge gold-glow-tl',
        className,
      )}
    >
      <SuperficieContext.Provider value="painel">{children}</SuperficieContext.Provider>
    </section>
  )
}

/*
 * O título de painel (seções 6 e 8): ícone + rótulo, com o `extra` à direita.
 * Sem filete (ajuste do Rafael de 12/09): o ícone dá memória de lugar e o
 * rótulo diz o assunto. `tom` é aceito e ignorado, para as telas não quebrarem.
 */
export function PainelTitulo({
  titulo,
  icone: Icone,
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
    <div className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
      {titulo && Icone ? <Icone size={15} strokeWidth={1.6} className="shrink-0 text-t3" aria-hidden /> : null}
      <div className="min-w-0 flex-1">
        {titulo ? (
          <h2 className="font-label text-[11px] uppercase tracking-[0.14em] text-t4">{titulo}</h2>
        ) : null}
        {descricao && <div className={cn('text-[11px] text-t4', titulo ? 'mt-0.5' : undefined)}>{descricao}</div>}
      </div>
      {extra && <div className="ml-auto shrink-0">{extra}</div>}
    </div>
  )
}
