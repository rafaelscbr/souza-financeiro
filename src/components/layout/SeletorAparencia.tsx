import { useRef, type KeyboardEvent } from 'react'
import { Check, Moon, Sun, type LucideIcon } from 'lucide-react'
import { Rotulo } from '@/components/ui/Rotulo'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

/*
 * DUAS OPÇÕES COM MARCA, NÃO INTERRUPTOR (docs/souza-os.md, seção 2).
 *
 * Um interruptor com sol e lua pergunta "ligado ou desligado?", e ninguém sabe
 * se o sol quer dizer "está claro" ou "clique para clarear". Duas opções com
 * nome e um visto na escolhida respondem as duas coisas de uma vez: o que
 * existe e o que está valendo.
 *
 * O mesmo desenho serve à densidade, então mora aqui e o SeletorDensidade usa.
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
    <div className={className}>
      <Rotulo as="span" className="mb-1.5 block">
        {rotulo}
      </Rotulo>
      <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-2 gap-1.5">
        {opcoes.map((o, i) => {
          const marcada = o.valor === valor
          const Icone = o.icone
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
              className={cn(
                'flex h-10 min-w-0 items-center gap-2 rounded-[10px] border px-2.5 text-[13px] transition-colors duration-150',
                marcada
                  ? 'border-brand/40 bg-brand-tint font-medium text-t1'
                  : 'border-nav-line text-t3 hover:bg-nav-hover hover:text-t1',
              )}
            >
              <Icone size={15} strokeWidth={1.6} aria-hidden className={marcada ? 'text-brand-text' : 'text-t4'} />
              <span className="min-w-0 flex-1 truncate text-left">{o.rotulo}</span>
              {marcada && <Check size={14} strokeWidth={1.6} aria-hidden className="shrink-0 text-brand-text" />}
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

export function SeletorAparencia({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return <OpcoesComMarca rotulo="Aparência" valor={theme} opcoes={OPCOES} aoMudar={setTheme} className={className} />
}
