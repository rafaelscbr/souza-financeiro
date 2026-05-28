import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Building2, BarChart3, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Sidebar } from './Sidebar'

const mobileNav = [
  { label: 'Início', icon: LayoutDashboard, to: '/', end: true },
  { label: 'Vendas', icon: TrendingUp, to: '/vendas', end: false },
  { label: 'Imóveis', icon: Building2, to: '/empreendimentos', end: false },
  { label: 'Relatórios', icon: BarChart3, to: '/relatorios', end: false },
]

export function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      {menuOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-72 md:hidden animate-in slide-in-from-left">
          <Sidebar onClose={() => setMenuOpen(false)} />
        </div>
      )}

      {/* Bottom Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border md:hidden">
        <div className="flex items-stretch h-16">
          {mobileNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn('p-1 rounded-lg', isActive && 'bg-primary/10')}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
          >
            <div className="p-1 rounded-lg">
              <MoreHorizontal className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </>
  )
}
