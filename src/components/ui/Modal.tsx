import { type ReactNode } from 'react'
import { SidePanel } from './SidePanel'

/*
 * DEPRECADO — apagar na limpeza final (Fase 4: "Modal.tsx apagado").
 *
 * Formulário e detalhe abrem em `SidePanel` (7.10); confirmação é
 * `ConfirmDialog` (7.11), o único modal. Este arquivo só mantém a API antiga
 * (open, onClose, title, description, footer, largura) para quem ainda o usa:
 * auth/TrocarSenha, admin/RegistrarVenda, admin/pages/Config,
 * admin/pages/Corretores e admin/pages/Venda. A pele, o véu, a entrada, a
 * saída, a trava de foco e a rolagem são as do SidePanel. `className` é
 * ignorado.
 */
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** `padrao` = painel md (480). `largo` = painel lg (672). */
  largura?: 'padrao' | 'largo'
  /** DEPRECADO: sem efeito. */
  className?: string
}

export function Modal({ open, onClose, title, description, children, footer, largura = 'padrao' }: ModalProps) {
  return (
    <SidePanel
      aberto={open}
      aoFechar={onClose}
      titulo={title}
      subtitulo={description}
      rodape={footer}
      largura={largura === 'largo' ? 'lg' : 'md'}
    >
      {children}
    </SidePanel>
  )
}
