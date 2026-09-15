import { useRef, type KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { classeContador } from './Abas'

export interface FiltroRapido<T extends string = string> {
  id: T
  rotulo: string
  /** Quantos itens o filtro mostra. Omitido, o item não tem contador. */
  contador?: number
  icone?: LucideIcon
  /** O porquê do filtro, no `title` (ex.: "já recebido da construtora e não repassado"). */
  dica?: string
}

export interface FiltrosRapidosProps<T extends string> {
  filtros: FiltroRapido<T>[]
  ativo: T
  aoMudar: (id: T) => void
  /** Nome do grupo para o leitor de tela ("Filtrar comissões"). */
  rotuloAcessivel: string
  className?: string
}

/*
 * Filtros rápidos (docs/souza-os-fundamentos.md, 7.15, 5.5 e 8.3).
 *
 * Item `inline-flex items-center gap-2 px-3 rounded-controle border
 * texto-titulo` + Badge (7.7). NEUTRO, nunca brand-fill: inativo `bg-surface
 * border-fio-linha text-t2`; ativo `bg-s2 border-fio-controle text-t1
 * font-semibold`. O fundo do ativo NÃO desliza: entra por `::before` com
 * opacidade em 150ms (os filhos são `relative` para ficar sobre ele). Pressionar: `linha-press`, sem escala.
 *
 * `role="radiogroup"` + `role="radio"`/`aria-checked`: uma parada de Tab,
 * setas andam e escolhem, Home/End vão às pontas.
 * Altura da faixa: 44 abaixo de 1024 ou com toque, 40 com ponteiro fino ≥1024.
 */
export function FiltrosRapidos<T extends string>({
  filtros,
  ativo,
  aoMudar,
  rotuloAcessivel,
  className,
}: FiltrosRapidosProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const temAtivo = filtros.some((f) => f.id === ativo)

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = filtros.length
    let alvo: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') alvo = (i + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') alvo = (i - 1 + n) % n
    else if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = n - 1
    if (alvo === null) return
    e.preventDefault()
    refs.current[alvo]?.focus()
    aoMudar(filtros[alvo].id)
  }

  return (
    <div
      role="radiogroup"
      aria-label={rotuloAcessivel}
      data-rolagem
      className={cn('flex items-center gap-2 overflow-x-auto', className)}
    >
      {filtros.map((f, i) => {
        const selecionado = f.id === ativo
        const Icone = f.icone
        return (
          <button
            key={f.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selecionado}
            aria-label={f.contador != null ? `${f.rotulo}, ${f.contador}` : undefined}
            tabIndex={selecionado || (!temAtivo && i === 0) ? 0 : -1}
            title={f.dica}
            onClick={() => aoMudar(f.id)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={`text-texto-titulo ${cn(
              'relative inline-flex h-11 shrink-0 select-none items-center gap-2 whitespace-nowrap rounded-controle border bg-surface px-3',
              'lg:[@media(pointer:fine)]:h-10',
              'transition-colors duration-micro ease-cor',
              "before:absolute before:inset-0 before:rounded-controle before:bg-s2 before:content-['']",
              'before:transition-opacity before:duration-micro before:ease-cor active:before:bg-linha-press active:before:opacity-100',
              selecionado
                ? 'border-fio-controle font-semibold text-t1 before:opacity-100'
                : 'border-fio-linha text-t2 before:opacity-0 hover:text-t1',
            )}`}
          >
            {Icone && <Icone aria-hidden size={16} strokeWidth={1.6} className="relative shrink-0" />}
            <span className="relative">{f.rotulo}</span>
            {f.contador != null && (
              <span aria-hidden className={`relative ${classeContador(f.contador)}`}>
                {f.contador.toLocaleString('pt-BR')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
