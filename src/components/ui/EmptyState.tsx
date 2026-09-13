import { isValidElement, type ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'
import { EstadoVazio } from './Estados'

/*
 * Invólucro DEPRECADO de EstadoVazio, para as telas que ainda não migraram.
 *
 * As telas passam o ícone como elemento pronto (`<Handshake className="h-8
 * w-8" />`). O EstadoVazio quer o componente, para desenhar no tamanho e no
 * traço do guia e dentro do bloco tonalizado; então o componente é tirado do
 * elemento e o tamanho que a tela escolheu é descartado de propósito.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  const icone = isValidElement(icon) && typeof icon.type !== 'string' ? (icon.type as LucideIcon) : Inbox
  return <EstadoVazio icone={icone} titulo={title} descricao={description} acao={action} />
}
