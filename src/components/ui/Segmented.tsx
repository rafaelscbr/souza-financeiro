import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface SegmentedOption<T extends string> {
  value: T
  label: string
  activeClass?: string
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel?: string
  className?: string
}

/*
 * Escolha única entre poucas opções que cabem lado a lado ("Saiu / Entrou",
 * "Claro / Escuro").
 *
 * O selecionado é preenchido em --brand-fill com --brand-fill-text, a receita
 * que a seção 3 dá para todo controle preenchido (botão, aba ativa, chip
 * selecionado). É a mesma cor da pílula ativa dos Filtros rápidos: as duas são
 * "qual destes vale agora", e ler a mesma pergunta com duas cores seria
 * inventar significado. Além da cor, o selecionado ganha peso e o leitor de
 * tela ouve aria-checked: cor sozinha nunca comunica status.
 *
 * Teclado de radiogroup: o grupo é UMA parada de Tab (entra no selecionado) e
 * as setas andam e escolhem, circulando. Home e End vão às pontas.
 *
 * Cada botão é filho direto do grupo e tem 40px (alvo mínimo da seção 12);
 * quem precisa de 44px no celular usa `className="[&>button]:h-toque"`.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const temSelecionado = options.some((o) => o.value === value)

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = options.length
    let alvo: number | null = null
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        alvo = (i + 1) % n
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        alvo = (i - 1 + n) % n
        break
      case 'Home':
        alvo = 0
        break
      case 'End':
        alvo = n - 1
        break
    }
    if (alvo === null) return
    e.preventDefault()
    refs.current[alvo]?.focus()
    onChange(options[alvo].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-0.5 rounded-lg border border-line-input bg-s2 p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt, i) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (!temSelecionado && i === 0) ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cn(
              'h-10 min-w-0 truncate rounded-md px-3 text-[13px] font-medium',
              'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand/40',
              active
                ? (opt.activeClass ?? 'bg-brand-fill font-semibold text-brand-fill-text shadow-card')
                : 'text-t3 hover:bg-s3/50 hover:text-t1',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
