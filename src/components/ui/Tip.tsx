import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Explicação curta ancorada a um indicador ou campo.
 * Abre no clique (funciona no toque) e também no hover do desktop.
 *
 * Para a regra que a tela inteira precisa mostrar escrita, o componente é a
 * `Dica` (caixa com Lightbulb, seção 8). O Tip é o "o que é isso?" de UM número,
 * que só aparece para quem pergunta.
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
      {/*
       * O ícone desenhado tem 14px, mas o alvo tem 40px (seção 12). A margem
       * negativa devolve o espaço, para o gatilho não empurrar o rótulo ao lado.
       */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="-m-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-t4 transition-colors duration-150 hover:bg-s3/50 hover:text-t2"
      >
        <HelpCircle aria-hidden strokeWidth={1.6} className="h-3.5 w-3.5" />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'overlay-entra absolute top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-[14px] p-3 text-left text-[13px] font-normal normal-case leading-relaxed tracking-normal text-t3 shadow-dropdown modal-surface',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </span>
      )}
    </span>
  )
}
