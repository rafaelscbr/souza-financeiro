import { cn } from '@/lib/utils'

/*
 * Carregando (seção 8): blocos `shimmer` com a FORMA REAL do conteúdo.
 *
 * O esqueleto antigo era um fio estático, com o argumento de que brilho sugere
 * atividade financeira. O guia da casa resolve a mesma preocupação por outro
 * caminho: o esqueleto tem a forma da linha que vai chegar (selo, título,
 * contexto, valor), então ninguém confunde carregando com um valor real, e
 * nunca há spinner solto. Com prefers-reduced-motion o brilho para.
 */
export function Esqueleto({ className }: { className?: string }) {
  return <span className={cn('shimmer block h-3 w-full rounded-md', className)} aria-hidden />
}

/**
 * Uma linha de lista carregando: selo, título, contexto, coluna do meio e o
 * valor alinhado à direita, na mesma geometria da `Linha`.
 */
export function LinhaEsqueleto({ recuo = 'px-4 sm:px-5' }: { recuo?: string }) {
  return (
    <li className={cn('flex items-center gap-3 border-b border-line py-3.5 last:border-0 sm:gap-4', recuo)} aria-hidden>
      <Esqueleto className="h-7 w-7 shrink-0 rounded-[9px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <Esqueleto className="h-3 max-w-[14rem]" />
        <Esqueleto className="h-2.5 max-w-[8rem]" />
      </span>
      <Esqueleto className="hidden h-5 w-20 shrink-0 rounded-lg md:block" />
      <Esqueleto className="h-3.5 w-20 shrink-0" />
    </li>
  )
}

/*
 * Linhas carregando SEM superfície própria, para caber dentro de um painel ou
 * seção que já é a superfície. Solta na página, use EsqueletoLista.
 */
export function ListaCarregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <ul aria-busy="true" aria-live="polite">
      <li className="sr-only">Carregando…</li>
      {Array.from({ length: linhas }).map((_, i) => (
        <LinhaEsqueleto key={i} />
      ))}
    </ul>
  )
}
