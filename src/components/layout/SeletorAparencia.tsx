import { useRef, type KeyboardEvent } from 'react'
import { Check, Moon, Sun, type LucideIcon } from 'lucide-react'
import { Icone } from '@/components/ui/Icone'
import { Rotulo } from '@/components/ui/Rotulo'
import type { Theme } from '@/context/ThemeContext'
import { useTrocaDeTema } from './ThemeToggle'
import { cn } from '@/lib/utils'

/*
 * DUAS OPÇÕES COM NOME, NÃO INTERRUPTOR.
 *
 * Um grupo de rádio de duas opções: o que existe e o que está valendo. A
 * opção marcada é NEUTRA (P5: aba, filtro e escolha ativos nunca são ouro):
 * fundo s2, borda de controle, texto t1 600 e o visto. Controle isolado, então
 * a cor transiciona em 150ms (8.4). 40px com ponteiro fino ≥1024; 44 no toque.
 *
 * O mesmo desenho serve à densidade (SeletorDensidade).
 */

export interface OpcaoComMarca<T extends string> {
  valor: T
  rotulo: string
  icone: LucideIcon
}

export function OpcoesComMarca<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  className,
}: {
  rotulo: string
  valor: T
  opcoes: OpcaoComMarca<T>[]
  aoMudar: (v: T) => void
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Teclado de radiogroup: uma parada de Tab, setas trocam e já escolhem.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = opcoes.length
    let alvo = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') alvo = (i + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') alvo = (i - 1 + n) % n
    else if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = n - 1
    if (alvo < 0) return
    e.preventDefault()
    aoMudar(opcoes[alvo].valor)
    refs.current[alvo]?.focus()
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Rotulo as="span">{rotulo}</Rotulo>
      <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-2 gap-2">
        {opcoes.map((o, i) => {
          const marcada = o.valor === valor
          return (
            <button
              key={o.valor}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={marcada}
              tabIndex={marcada ? 0 : -1}
              onClick={() => aoMudar(o.valor)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`${cn(
                'flex h-11 min-w-0 items-center gap-2 rounded-controle border px-3 transition-colors lg:[@media(pointer:fine)]:h-10',
                marcada
                  ? 'border-fio-controle bg-s2 font-semibold text-t1'
                  : 'border-fio-linha text-t2 hover:bg-linha-hover hover:text-t1 active:bg-linha-press',
              )} text-texto-titulo`}
            >
              <Icone icone={o.icone} tamanho={16} className={marcada ? 'text-t1' : 'text-t3'} />
              <span className="min-w-0 flex-1 truncate text-left">{o.rotulo}</span>
              {marcada && <Icone icone={Check} tamanho={16} className="shrink-0 text-t1" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const OPCOES: OpcaoComMarca<Theme>[] = [
  { valor: 'light', rotulo: 'Claro', icone: Sun },
  { valor: 'dark', rotulo: 'Escuro', icone: Moon },
]

/** Aparência: a troca passa pela coreografia de 8.3 (view transition). */
export function SeletorAparencia({ className }: { className?: string }) {
  const { tema, trocar } = useTrocaDeTema()
  return <OpcoesComMarca rotulo="Aparência" valor={tema} opcoes={OPCOES} aoMudar={trocar} className={className} />
}
