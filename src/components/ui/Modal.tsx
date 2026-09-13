import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useArmadilhaDeFoco } from './SidePanel'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** `padrao` = diálogo estreito. `largo` = mais espaço no desktop. */
  largura?: 'padrao' | 'largo'
  className?: string
}

/**
 * Diálogo central. Folha inferior no celular, caixa centrada no computador.
 *
 * ATENÇÃO — NÃO É MAIS O PADRÃO. Pelo Souza OS (seções 1.10 e 8), edição e
 * detalhe abrem em `SidePanel`, à direita, com a tela de origem visível; modal
 * central é só para confirmação curta e destrutiva, e para isso existe o
 * `ConfirmDialog`. Este componente mantém a API antiga (open, onClose, title,
 * description, footer, largura) para os formulários que ainda o usam
 * continuarem compilando enquanto migram — só a pele mudou.
 *
 * A armadilha de foco é a mesma do painel: Tab não escapa para a página atrás,
 * Escape fecha só o diálogo do topo e o foco volta a quem abriu.
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
  const tid = useId()
  useArmadilhaDeFoco(open, panelRef, onClose)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/*
       * Véu um pouco mais fechado que o do painel (40% contra 25%): o modal
       * central interrompe de propósito, e o véu diz isso sem esconder a tela.
       */}
      <div aria-hidden className="overlay-entra absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${tid}-t`}
        aria-describedby={description ? `${tid}-d` : undefined}
        className={cn(
          'modal-surface relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden shadow-modal outline-none',
          'rounded-t-[20px] border-b-0 sm:rounded-[16px] sm:border-b',
          // Sobe 1.5rem no celular (a folha nasce do pé da tela); no desktop
          // entra com o slideUp de 10px. Só transform e opacity.
          'animate-[painelSobe_280ms_cubic-bezier(0.16,1,0.3,1)_backwards] sm:animate-[slideUp_240ms_cubic-bezier(0.16,1,0.3,1)_backwards]',
          largura === 'largo' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0 pt-1.5">
            <h2
              id={`${tid}-t`}
              className="font-heading text-base font-bold leading-snug tracking-[-0.015em] text-t1"
            >
              {title}
            </h2>
            {description && (
              <p id={`${tid}-d`} className="mt-0.5 text-[13px] leading-snug text-t3">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-t3 transition-colors duration-150 hover:bg-s3/60 hover:text-t1"
            aria-label="Fechar"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
