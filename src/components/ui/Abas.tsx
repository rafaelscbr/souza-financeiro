import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tom } from './tom'

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
  /** Base dos ids; passe a mesma para <PainelAba> e as abas ganham `aria-controls`. */
  idBase?: string
  /** `automatica` (padrão): a seta troca a aba. `manual`: a seta só move o foco; Enter/Espaço troca. */
  ativacao?: 'automatica' | 'manual'
  className?: string
}

const idDaAba = (base: string, id: string) => `${base}-aba-${id}`
const idDoPainel = (base: string, id: string) => `${base}-painel-${id}`

/*
 * Abas (docs/souza-os-fundamentos.md, 7.15, 5.5 e 8.3 "Aba ativa").
 *
 * Item `px-3 texto-titulo text-t2`; ativa `text-t1 font-semibold` com
 * sublinhado de 2px em t1, sem raio, na base da fileira (`border-b
 * fio-linha`). NEUTRA: nada de ouro (P5). O sublinhado é UM elemento que
 * desliza por `translateX` + `scaleX` em 200ms `curva-entra`.
 * Altura da faixa: 44 abaixo de 1024 ou com toque, 40 com ponteiro fino ≥1024.
 * Pressionar: fundo `linha-press`, sem escala.
 */

/* Badge de contagem (7.7). Tamanho de letra fora do cn() (tailwind-merge). */
// eslint-disable-next-line react-refresh/only-export-components
export function classeContador(valor: number, tom?: Tom) {
  if (valor === 0) return 'text-chip num inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-t-meta'
  const cor =
    tom === 'risco'
      ? 'bg-error-bg text-error-ink'
      : tom === 'atencao'
        ? 'bg-warning-bg text-warning-ink'
        : tom === 'sucesso'
          ? 'bg-success-bg text-success-ink'
          : tom === 'info'
            ? 'bg-info-bg text-info-ink'
            : 'bg-s2 text-t2'
  return `text-chip num inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 ${cor}`
}

function Contador({ valor, tom }: { valor: number; tom?: Tom }) {
  return (
    <span aria-hidden className={classeContador(valor, tom)}>
      {valor.toLocaleString('pt-BR')}
    </span>
  )
}

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
  const lista = useRef<HTMLDivElement | null>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const temAtiva = abas.some((a) => a.id === ativa)

  /* Posição do sublinhado: medida da aba ativa. A 1ª colocação não desliza. */
  const [trilho, setTrilho] = useState<{ x: number; largura: number; deslizar: boolean } | null>(null)
  const chaves = abas.map((a) => `${a.id}:${a.rotulo}:${a.contador ?? ''}`).join('|')
  const medir = useCallback(() => {
    const i = abas.findIndex((a) => a.id === ativa)
    const el = refs.current[i]
    if (!el) {
      setTrilho(null)
      return
    }
    const x = el.offsetLeft
    const largura = el.offsetWidth
    setTrilho((antes) =>
      antes && antes.x === x && antes.largura === largura ? antes : { x, largura, deslizar: antes !== null },
    )
    // `chaves` e não `abas`: a tela passa um array novo a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaves, ativa])

  useLayoutEffect(() => {
    medir()
  }, [medir])

  useLayoutEffect(() => {
    const el = lista.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => medir())
    ro.observe(el)
    return () => ro.disconnect()
  }, [medir])

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
      ref={lista}
      role="tablist"
      aria-label={rotuloAcessivel}
      aria-orientation="horizontal"
      data-rolagem
      className={cn('relative flex items-stretch overflow-x-auto border-b border-fio-linha', className)}
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
            className={`text-texto-titulo ${cn(
              'inline-flex h-11 shrink-0 select-none items-center gap-2 whitespace-nowrap px-3',
              'lg:[@media(pointer:fine)]:h-10',
              'transition-colors duration-micro ease-cor active:bg-linha-press',
              ativo ? 'font-semibold text-t1' : 'text-t2 hover:text-t1',
            )}`}
          >
            {Icone && <Icone aria-hidden size={16} strokeWidth={1.6} className="shrink-0" />}
            <span>{aba.rotulo}</span>
            {aba.contador != null && <Contador valor={aba.contador} tom={aba.tomContador} />}
          </button>
        )
      })}
      <span
        aria-hidden
        data-sublinhado
        className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-t1"
        style={{
          opacity: trilho ? 1 : 0,
          transform: trilho ? `translateX(${trilho.x}px) scaleX(${trilho.largura})` : undefined,
          transition: trilho?.deslizar ? 'transform var(--dur-pagina) var(--curva-entra)' : 'none',
        }}
      />
    </div>
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
    <div role="tabpanel" id={idDoPainel(idBase, aba)} aria-labelledby={idDaAba(idBase, aba)} tabIndex={0} className={className}>
      {children}
    </div>
  )
}
