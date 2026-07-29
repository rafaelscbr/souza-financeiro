import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { PlusCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { PersonalQuickSheet } from '@/features/personal/PersonalQuickSheet'
import { Button } from '@/components/ui/Button'
import { workspaceOf } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/**
 * Casca do módulo pessoal.
 *
 * No desktop a sidebar já lista as telas; no celular ela não existe, então
 * estas abas roláveis fazem esse papel. E o botão de lançar fica aqui — em
 * TODAS as telas do pessoal —, porque registrar um gasto é a ação mais
 * frequente do módulo e não pode depender de voltar à visão geral.
 */
export function PessoalLayout() {
  const { pathname } = useLocation()
  const [novo, setNovo] = useState(false)
  const itens = workspaceOf('/pessoal').groups.flatMap((g) => g.items)

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">
            {itens.find((i) => i.to === pathname)?.label ?? 'Pessoal'}
          </h1>
          <p className="text-sm text-content-faint">Suas finanças, separadas das empresas</p>
        </div>
        <Button size="sm" onClick={() => setNovo(true)}>
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Lançar</span>
        </Button>
      </div>

      {/* Abas do celular — no desktop a sidebar já cumpre esse papel */}
      <nav
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden"
        aria-label="Seções do pessoal"
      >
        {itens.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={({ isActive }) =>
              cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-transparent bg-content text-white'
                  : 'border-line bg-surface text-content-muted',
              )
            }
          >
            {i.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />

      {/* FAB do celular — o lançamento em 3 toques não pode depender de rolar
          até o topo. No desktop o botão do cabeçalho já resolve. */}
      <button
        onClick={() => setNovo(true)}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald text-white shadow-pop transition-transform active:scale-95 lg:hidden"
        aria-label="Novo lançamento pessoal"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <PersonalQuickSheet open={novo} onClose={() => setNovo(false)} />
    </div>
  )
}
