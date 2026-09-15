import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/*
 * CARREGANDO (7.13). Esqueleto com a FORMA REAL do que vem.
 *
 * Blocos `bg-s2 rounded-badge` com pulso de opacidade (`.esqueleto`, 8.2),
 * sem shimmer e sem `background-image`. O pulso é o único movimento infinito
 * permitido e só existe debaixo de `aria-busy="true"` (8.4); com movimento
 * reduzido para e fica em opacidade .7 (8.5).
 *
 * Aparece só se o banco demorar mais de 300ms: a tela usa
 * `useAtraso(300, carregando)` e, antes disso, reserva a altura vazia. Se já
 * havia dado (troca de mês), o conteúdo antigo fica com `opacity .6` e
 * `aria-busy`, sem esqueleto.
 */
export function Esqueleto({ className }: { className?: string }) {
  return <span className={cn('esqueleto block h-3 w-full rounded-badge bg-s2', className)} aria-hidden />
}

/**
 * Uma linha de lista carregando, na geometria da `.linha` (7.2): goteira 28,
 * título 14px a 40%, meta 12px a 25%, valor 96×16 à direita, mesma
 * `min-height` e o mesmo recuo (que vem da `.lista` com `data-contexto`).
 * Não é `<li>`: a `.lista` é grade de `div`.
 */
export function LinhaEsqueleto({ goteira = true }: { goteira?: boolean }) {
  const colunas = { '--colunas': goteira ? '28px minmax(0,1fr) var(--col-valor)' : 'minmax(0,1fr) var(--col-valor)' } as CSSProperties
  return (
    <div className="linha" data-linha aria-hidden style={colunas}>
      {goteira && (
        <span data-coluna="goteira">
          <Esqueleto className="h-7 w-7" />
        </span>
      )}
      <span data-coluna="texto" className="flex min-w-0 flex-col gap-2">
        <span data-coluna="titulo" className="flex items-center">
          <Esqueleto className="h-3.5 w-2/5" />
        </span>
        <span data-coluna="meta" className="flex items-center">
          <Esqueleto className="h-3 w-1/4" />
        </span>
      </span>
      <span data-coluna="valor" className="flex justify-end justify-self-end">
        <Esqueleto className="h-4 w-24" />
      </span>
    </div>
  )
}

/**
 * Linhas carregando SEM caixa própria, para o corpo de um cartão ou painel que
 * já é a caixa. `contexto` diz de onde vem o recuo (7.2): `'cartao'` ou
 * `'sobreposicao'`.
 */
export function ListaCarregando({
  linhas = 4,
  goteira = true,
  contexto = 'cartao',
  rotulo = 'Carregando…',
}: {
  linhas?: number
  goteira?: boolean
  contexto?: 'cartao' | 'sobreposicao'
  rotulo?: string
}) {
  return (
    <div className="lista" data-contexto={contexto} data-com-goteira={goteira ? '' : undefined} aria-busy="true" aria-live="polite">
      <span className="sr-only">{rotulo}</span>
      {Array.from({ length: linhas }).map((_, i) => (
        <LinhaEsqueleto key={i} goteira={goteira} />
      ))}
    </div>
  )
}
