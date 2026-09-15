import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Botão (docs/souza-os-fundamentos.md, 7.8 e 8.3 "Pressionar").
 *
 * Quatro variantes, quatro tamanhos. O primário é LISO: brand-fill, sem
 * degradê e sem halo; um por camada. Perigo nunca é chapado.
 * Carregando: o rótulo fica, o Loader2 de 16 entra no lugar do ícone, a
 * largura trava e o botão anuncia aria-busy.
 */
export type ButtonVariante = 'primario' | 'secundario' | 'fantasma' | 'perigo'
export type ButtonTamanho = 'sm' | 'md' | 'lg' | 'icone'

/** DEPRECADO — apagar na limpeza final: nomes antigos, traduzidos em `VARIANTE_LEGADA`. */
export type ButtonVariantLegado = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
/** DEPRECADO — apagar na limpeza final: `icon` vira `icone`. */
export type ButtonSizeLegado = 'icon'

export type ButtonVariant = ButtonVariante | ButtonVariantLegado
export type ButtonSize = ButtonTamanho | ButtonSizeLegado

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ícone lucide à esquerda do rótulo (16, stroke 1.6). Carregando, dá lugar ao Loader2. */
  icone?: LucideIcon
  /** O banco ainda não respondeu: desabilita, `aria-busy`, rótulo visível, largura travada. */
  carregando?: boolean
}

// DEPRECADO — apagar na limpeza final (quando as telas passarem os nomes novos).
const VARIANTE_LEGADA: Record<ButtonVariantLegado, ButtonVariante> = {
  primary: 'primario',
  secondary: 'secundario',
  outline: 'secundario',
  ghost: 'fantasma',
  danger: 'perigo',
  success: 'secundario',
}

const variantes: Record<ButtonVariante, string> = {
  primario: 'bg-brand-fill text-brand-fill-text font-heading hover:bg-brand-fill-hover',
  secundario: 'border border-fio-controle bg-surface text-t1 hover:bg-linha-hover',
  fantasma: 'text-t2 hover:bg-linha-hover hover:text-t1',
  perigo: 'border border-error-line bg-surface text-error-ink hover:bg-linha-hover',
}

/*
 * Tamanho de letra FORA do cn(): o tailwind-merge sem configuração lê
 * `text-botao` como cor e apagaria `text-t1` (ou o contrário).
 */
const tipo: Record<ButtonVariante, string> = {
  primario: 'text-botao',
  secundario: 'text-botao-secundario',
  fantasma: 'text-botao-secundario',
  perigo: 'text-botao-secundario',
}

/*
 * sm 32 / md 40 / lg 44 / icone 32 no computador. Abaixo de 1024 ou com toque,
 * todo botão tem no mínimo 44 (a media de 7.8).
 */
const TOQUE = 'max-lg:min-h-11 [@media(pointer:coarse)]:min-h-11'
const tamanhos: Record<ButtonTamanho, string> = {
  sm: cn('h-8 gap-2 px-3', TOQUE),
  md: cn('h-10 gap-2 px-4', TOQUE),
  lg: 'h-11 gap-2 px-5',
  icone: 'size-11 shrink-0 lg:size-8 [@media(pointer:coarse)]:size-11',
}

/* Cor em 150ms na curva da casa; pressionar em 100ms. Só as propriedades que mudam. */
const TRANSICAO: CSSProperties = {
  transitionProperty: 'color, background-color, border-color, transform',
  transitionDuration: 'var(--dur-micro), var(--dur-micro), var(--dur-micro), var(--dur-toque)',
  transitionTimingFunction: 'var(--curva-cor)',
}

/*
 * `type="button"` por padrão: enviar um <form> é sempre escolha escrita.
 * Foco: o contorno global de 5.5 (2px brand, offset 2), sem anel próprio.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primario',
      size = 'md',
      type = 'button',
      icone: Icone,
      carregando = false,
      disabled,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const variante: ButtonVariante =
      variant in VARIANTE_LEGADA ? VARIANTE_LEGADA[variant as ButtonVariantLegado] : (variant as ButtonVariante)
    const tamanho: ButtonTamanho = size === 'icon' ? 'icone' : size

    if (import.meta.env.DEV && tamanho === 'icone' && !props['aria-label']) {
      console.error('Button tamanho "icone" precisa de aria-label (7.8).')
    }

    /* Largura travada enquanto carrega: mede antes de trocar o ícone. */
    const interno = useRef<HTMLButtonElement | null>(null)
    const [larguraTravada, setLarguraTravada] = useState<number | null>(null)
    const ligarRef = useCallback(
      (el: HTMLButtonElement | null) => {
        interno.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      },
      [ref],
    )
    useLayoutEffect(() => {
      if (carregando && interno.current) setLarguraTravada(interno.current.offsetWidth)
      if (!carregando) setLarguraTravada(null)
    }, [carregando])

    const giro = <Loader2 aria-hidden size={16} strokeWidth={1.6} className="shrink-0 animate-spin" />

    return (
      <button
        ref={ligarRef}
        type={type}
        disabled={disabled || carregando}
        aria-busy={carregando || undefined}
        data-variante={variante}
        style={{ ...TRANSICAO, ...(larguraTravada ? { minWidth: larguraTravada } : null), ...style }}
        className={`${tipo[variante]} ${cn(
          'relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-controle',
          'enabled:active:scale-[.98]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          variantes[variante],
          tamanhos[tamanho],
          className,
        )}`}
        {...props}
      >
        {tamanho === 'icone' ? (
          carregando ? giro : Icone ? <Icone aria-hidden size={16} strokeWidth={1.6} className="shrink-0" /> : children
        ) : (
          <>
            {carregando ? giro : Icone && <Icone aria-hidden size={16} strokeWidth={1.6} className="shrink-0" />}
            {children}
          </>
        )}
      </button>
    )
  },
)
Button.displayName = 'Button'
