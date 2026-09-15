import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

/*
 * DEPRECADO — apagar na limpeza final.
 * Quem ainda usa: admin/RegistrarVenda, admin/ReceberParcela,
 * admin/LancarDespesa, admin/pages/Receber, admin/pages/Relatorios,
 * admin/pages/Config, kit/Kit. Substituto: `FiltrosRapidos` (faixa) ou
 * escolha no formulário com a mesma pintura.
 *
 * Enquanto vive, pinta como os filtros neutros (5.5, 7.15): inativo
 * `bg-surface border-fio-linha text-t2`, ativo `bg-s2 border-fio-controle
 * text-t1 font-semibold`, raio de controle, 44px (régua do formulário),
 * pressionar em `linha-press`. Nunca brand-fill.
 */
interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** DEPRECADO — ignorado: o ativo é sempre neutro (P5). */
  activeClass?: string
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel?: string
  className?: string
}

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
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') alvo = (i + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') alvo = (i - 1 + n) % n
    else if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = n - 1
    if (alvo === null) return
    e.preventDefault()
    refs.current[alvo]?.focus()
    onChange(options[alvo].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-2', className)}
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
            className={`text-texto-titulo ${cn(
              'h-11 min-w-0 select-none truncate rounded-controle border px-3',
              'transition-colors duration-micro ease-cor active:bg-linha-press',
              active
                ? 'border-fio-controle bg-s2 font-semibold text-t1'
                : 'border-fio-linha bg-surface text-t2 hover:text-t1',
            )}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
