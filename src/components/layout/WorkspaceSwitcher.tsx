import { useNavigate } from 'react-router-dom'
import { WORKSPACES, type Workspace } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/**
 * A troca entre o financeiro das empresas e o pessoal.
 *
 * Fica no topo da navegação, antes de qualquer item de menu, porque não é um
 * filtro: é a resposta para "de quem é esse dinheiro". Enquanto os dois
 * conviviam no mesmo menu, a pergunta ficava implícita — e a tela, confusa.
 */
export function WorkspaceSwitcher({ current }: { current: Workspace }) {
  const navigate = useNavigate()

  return (
    <div
      className="flex gap-1 rounded-xl bg-surface-2 p-1"
      role="tablist"
      aria-label="Espaço financeiro"
    >
      {WORKSPACES.map((ws) => {
        const ativo = ws.id === current.id
        const Icon = ws.icon
        return (
          <button
            key={ws.id}
            role="tab"
            aria-selected={ativo}
            onClick={() => navigate(ws.home)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors',
              ativo
                ? 'bg-surface text-content shadow-sm'
                : 'text-content-faint hover:text-content-muted',
            )}
          >
            <Icon className="h-4 w-4" />
            {ws.label}
          </button>
        )
      })}
    </div>
  )
}
