import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOM, type Tom } from './tom'

export interface Aba<T extends string = string> {
  id: T
  rotulo: string
  icone?: LucideIcon
  contador?: number
  /**
   * Tom do contador quando o número é status (ex.: vencidas em `risco`).
   * Sem tom, o contador é neutro. Zero ignora o tom: zero nunca é vermelho.
   */
  tomContador?: Tom
}

export interface AbasProps<T extends string> {
  abas: Aba<T>[]
  ativa: T
  aoMudar: (id: T) => void
  /** Nome do grupo para o leitor de tela ("Seções de Ajustes"). */
  rotuloAcessivel: string
  /**
   * Base dos ids. Passe a mesma para <PainelAba> e as abas ganham
   * `aria-controls` apontando para o painel certo.
   */
  idBase?: string
  /**
   * `automatica` (padrão): a seta já troca a aba, bom quando o conteúdo está na
   * memória. `manual`: a seta só move o foco e Enter/Espaço troca, para aba que
   * busca no banco a cada troca e não deve disparar consulta a cada seta.
   */
  ativacao?: 'automatica' | 'manual'
  className?: string
}

const idDaAba = (base: string, id: string) => `${base}-aba-${id}`
const idDoPainel = (base: string, id: string) => `${base}-painel-${id}`

/*
 * Abas (Souza OS, seção 8): sublinhado Areia na ativa, ícone + rótulo +
 * contador opcional.
 *
 * O sublinhado é `bg-brand` e não `bg-brand-fill`: é um traço, que a seção 3
 * trata como borda, e o --brand do tema claro (#A8791A) passa de 3:1 sobre o
 * Papel, onde o Areia puro some. É o único sinal dourado da aba; o ícone e o
 * texto da ativa só sobem para --t1.
 *
 * Teclado completo, como pede o guia: a lista é UMA parada de Tab (entra na
 * aba ativa), as setas circulam, Home e End vão às pontas.
 *
 * A régua rola na horizontal quando não cabe (cinco abas num celular), e quem
 * rola é ela, nunca a página. Por rolar, ela recorta o que passa da borda: o
 * contorno de foco entra 2px para dentro da aba para não ser cortado.
 */
export function Abas<T extends string>({
  abas,
  ativa,
  aoMudar,
  rotuloAcessivel,
  idBase,
  ativacao = 'automatica',
  className,
}: AbasProps<T>) {
  const idGerado = useId()
  const base = idBase ?? idGerado
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const temAtiva = abas.some((a) => a.id === ativa)

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = abas.length
    let alvo: number | null = null
    if (e.key === 'ArrowRight') alvo = (i + 1) % n
    else if (e.key === 'ArrowLeft') alvo = (i - 1 + n) % n
    else if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = n - 1
    if (alvo === null) return
    e.preventDefault()
    refs.current[alvo]?.focus()
    if (ativacao === 'automatica') aoMudar(abas[alvo].id)
  }

  return (
    <div
      role="tablist"
      aria-label={rotuloAcessivel}
      aria-orientation="horizontal"
      className={cn('flex items-end gap-1 overflow-x-auto border-b border-line', className)}
    >
      {abas.map((aba, i) => {
        const ativo = aba.id === ativa
        const Icone = aba.icone
        return (
          <button
            key={aba.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={idDaAba(base, aba.id)}
            aria-selected={ativo}
            aria-controls={idBase ? idDoPainel(idBase, aba.id) : undefined}
            // "Vencidas, 3": sem a vírgula o leitor de tela lê "Vencidas3".
            aria-label={aba.contador != null ? `${aba.rotulo}, ${aba.contador}` : undefined}
            tabIndex={ativo || (!temAtiva && i === 0) ? 0 : -1}
            onClick={() => aoMudar(aba.id)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cn(
              'group relative inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3 text-sm font-medium',
              'transition-colors duration-150 focus-visible:outline-offset-[-2px]',
              ativo ? 'text-t1' : 'text-t3 hover:text-t1',
            )}
          >
            {Icone && (
              <Icone
                aria-hidden
                strokeWidth={1.6}
                className={cn(
                  'h-[15px] w-[15px] shrink-0 transition-colors duration-150',
                  ativo ? 'text-t2' : 'text-t4 group-hover:text-t3',
                )}
              />
            )}
            <span>{aba.rotulo}</span>
            {aba.contador != null && <Contador valor={aba.contador} tom={aba.tomContador} />}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand transition-opacity duration-150',
                ativo ? 'opacity-100' : 'opacity-0',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

/*
 * O contador é contexto, não manchete: 11px semibold tabular. Neutro por
 * padrão; com tom só quando o número é status. Zero fica esmaecido (--t4 sem
 * fundo, ainda legível em AA) e nunca herda o tom: "0 vencidas" é boa notícia.
 */
function Contador({ valor, tom }: { valor: number; tom?: Tom }) {
  const zero = valor === 0
  const cores = zero ? 'text-t4' : tom ? cn(TOM[tom].fundo, TOM[tom].texto) : 'bg-s3/60 text-t3'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold leading-none tabular-nums',
        cores,
      )}
    >
      {valor.toLocaleString('pt-BR')}
    </span>
  )
}

/**
 * O conteúdo de uma aba. Use a mesma `idBase` passada às <Abas> para que a aba
 * e o painel se apontem (aria-controls / aria-labelledby).
 */
export function PainelAba({
  idBase,
  aba,
  children,
  className,
}: {
  idBase: string
  aba: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="tabpanel"
      id={idDoPainel(idBase, aba)}
      aria-labelledby={idDaAba(idBase, aba)}
      // Focável para quem chega de teclado cair no conteúdo com um Tab depois da aba.
      tabIndex={0}
      className={cn('focus-visible:outline-offset-4', className)}
    >
      {children}
    </div>
  )
}
