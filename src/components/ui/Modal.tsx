import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** `folha` = ocupa a largura toda no celular (padrão). `largo` = mais espaço no desktop. */
  largura?: 'padrao' | 'largo'
  className?: string
}

/**
 * Diálogo. Folha inferior no celular, painel centrado no computador.
 *
 * O que mudou: agora existe ARMADILHA DE FOCO. O modal anterior punha o foco
 * no painel e soltava — dois Tab e o teclado estava navegando a página atrás,
 * invisível, sob o fundo escurecido. Também passa a devolver o foco ao
 * elemento que o abriu, e a se anunciar por `aria-labelledby`, não por um
 * rótulo duplicado.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  largura = 'padrao',
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const origemRef = useRef<HTMLElement | null>(null)
  const tid = useId()

  useEffect(() => {
    if (!open) return
    origemRef.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const painel = panelRef.current
      if (!painel) return
      const itens = Array.from(painel.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (itens.length === 0) {
        e.preventDefault()
        painel.focus()
        return
      }
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      const ativo = document.activeElement
      if (!e.shiftKey && (ativo === ultimo || !painel.contains(ativo))) {
        e.preventDefault()
        primeiro.focus()
      } else if (e.shiftKey && (ativo === primeiro || !painel.contains(ativo))) {
        e.preventDefault()
        ultimo.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Foco no primeiro elemento útil, não no painel: quem abre "Receber
    // parcela" quer digitar, não apertar Tab.
    const t = setTimeout(() => {
      const painel = panelRef.current
      const alvo =
        painel?.querySelector<HTMLElement>('[data-foco-inicial]') ??
        painel?.querySelector<HTMLElement>(FOCAVEIS) ??
        painel
      alvo?.focus()
    }, 20)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      clearTimeout(t)
      origemRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-marca-navy/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${tid}-t`}
        aria-describedby={description ? `${tid}-d` : undefined}
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-pop outline-none',
          'animate-slide-up rounded-t-3xl sm:animate-scale-in sm:rounded-3xl',
          largura === 'largo' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={`${tid}-t`} className="text-lg font-semibold text-content">
              {title}
            </h2>
            {description && (
              <p id={`${tid}-d`} className="mt-0.5 text-sm text-content-muted">
                {description}
              </p>
            )}
          </div>
          {/* 44x44: o fechar de 28px era menor que o piso de toque. */}
          <button
            onClick={onClose}
            className="-mr-2 -mt-1.5 flex h-toque w-toque shrink-0 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="border-t border-line p-4 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
