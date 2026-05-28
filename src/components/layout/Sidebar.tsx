import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Building2, Users, ArrowDownCircle,
  ArrowUpCircle, Award, Calculator, PiggyBank, BarChart3, Settings,
  ChevronRight, DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Vendas', icon: TrendingUp, to: '/vendas' },
  { label: 'Empreendimentos', icon: Building2, to: '/empreendimentos' },
  { label: 'Corretores', icon: Users, to: '/corretores' },
  {
    label: 'Financeiro', icon: DollarSign, to: null,
    children: [
      { label: 'Contas a Receber', icon: ArrowDownCircle, to: '/receber' },
      { label: 'Contas a Pagar', icon: ArrowUpCircle, to: '/pagar' },
      { label: 'Comissões', icon: Award, to: '/comissoes' },
    ]
  },
  { label: 'Simulador VGL', icon: Calculator, to: '/simulador' },
  { label: 'Orçamentos', icon: PiggyBank, to: '/orcamentos' },
  { label: 'Relatórios', icon: BarChart3, to: '/relatorios' },
  { label: 'Configurações', icon: Settings, to: '/configuracoes' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">SF</span>
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm leading-none">Souza Financeiro</p>
          <p className="text-xs text-muted-foreground mt-0.5">Imobiliária</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          if (item.children) {
            const isGroupActive = item.children.some((c) => location.pathname === c.to)
            return (
              <div key={item.label} className="mb-1">
                <div className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium',
                  isGroupActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="ml-3 pl-3 border-l border-border mt-0.5 space-y-0.5">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )
                      }
                    >
                      <child.icon className="h-4 w-4 shrink-0" />
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-semibold">RS</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Rafael Souza</p>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
        </div>
      </div>
    </div>
  )
}
