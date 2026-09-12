import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Explicação curta ancorada a um indicador ou campo.
 * Abre no clique (funciona no toque) e também no hover do desktop.
 */
export function Tip({
  children,
  label = 'O que é isso?',
  align = 'end',
  className,
}: {
  children: ReactNode
  /** Descrição do gatilho para leitores de tela. */
  label?: string
  /** Lado em que a caixa se alinha — use `start` quando o gatilho fica à esquerda. */
  align?: 'start' | 'end'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span
      ref={wrapRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="-m-2.5 inline-flex h-toque w-toque items-center justify-center rounded-lg text-content-faint transition-colors hover:bg-surface-2 hover:text-content-muted"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute top-full z-50 mt-1.5 w-64 animate-scale-in rounded-lg border border-rule bg-surface p-3 text-left text-sm font-normal leading-relaxed text-content-muted shadow-pop',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </span>
      )}
    </span>
  )
}
