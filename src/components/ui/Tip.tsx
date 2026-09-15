import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePresenca } from '@/lib/usePresenca'
import { Icone } from './Icone'

/**
 * TIP — o "o que é isso?" de UM número (5.2 nível 2, popover).
 *
 * Abre no clique (funciona no toque) e no hover do computador; Escape fecha e
 * devolve o foco ao gatilho. Caixa de sobreposição: `surface`, `fio-caixa`,
 * `shadow-dropdown`, raio de caixa, `z-popover`. Entra esmaecendo em 150ms e
 * sai em 180ms (`usePresenca`). Sem `data-caixa` (7.11).
 *
 * Para a regra que a tela inteira precisa mostrar escrita, use a `Dica`.
 */
const ENTRADA: CSSProperties = { animation: 'esmaeceEntra var(--dur-micro) linear backwards' }
const SAIDA: CSSProperties = { animation: 'esmaeceSai var(--dur-saida) linear both' }

export interface TipProps {
  children: ReactNode
  /** Descrição do gatilho para leitores de tela. */
  label?: string
  /** Lado em que a caixa se alinha — `start` quando o gatilho fica à esquerda. */
  align?: 'start' | 'end'
  className?: string
}

export function Tip({ children, label = 'O que é isso?', align = 'end', className }: TipProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const presenca = usePresenca(open, 180)

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      if (wrapRef.current?.contains(document.activeElement)) botaoRef.current?.focus()
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
      {/* O glifo tem 16px; o alvo, 40 no computador e 44 no toque. */}
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="inline-flex size-11 items-center justify-center rounded-controle text-t-meta transition-colors hover:bg-linha-hover hover:text-t1 active:bg-linha-press lg:size-10 [@media(pointer:coarse)]:size-11"
      >
        <Icone icone={HelpCircle} tamanho={16} />
      </button>

      {presenca.montado && (
        <span
          id={id}
          role="tooltip"
          data-popover
          {...presenca.props}
          style={presenca.estado === 'saindo' ? SAIDA : ENTRADA}
          className={cn(
            'absolute top-full z-popover mt-2 block w-64 max-w-[calc(100vw_-_32px)] rounded-caixa border border-fio-caixa bg-surface p-4 text-left text-texto-corrido normal-case tracking-normal text-t2 shadow-dropdown',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </span>
      )}
    </span>
  )
}
