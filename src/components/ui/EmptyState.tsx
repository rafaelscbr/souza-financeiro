import { isValidElement, type ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'
import { EstadoVazio } from './Estados'

/*
 * DEPRECADO — apagar na limpeza final (7.13: "Apagar EmptyState.tsx").
 * Use `EstadoVazio` de './Estados'. Ainda importam daqui: admin/pages/Pagar,
 * Inicio, Venda, Config, Corretores, Despesas, Relatorios, Receber;
 * corretor/pages/Inicio, MinhasVendas; kit/Kit.
 *
 * As telas antigas passam o ícone como elemento pronto; o componente é tirado
 * do elemento e o tamanho escolhido pela tela é descartado de propósito.
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
