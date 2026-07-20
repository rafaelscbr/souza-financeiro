import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  ArrowRightLeft,
  PieChart,
  Target,
  Flag,
  Calculator,
  Landmark,
  BookOpen,
  Users,
  Wallet,
  Plus,
  LogOut,
  Lock,
} from 'lucide-react'
import { formatMonthYear } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppDataContext'
import { TransactionComposerProvider, useComposer } from '@/features/transactions/TransactionComposer'
import { ScopeSwitcher } from './ScopeSwitcher'
import { PeriodNav } from './PeriodNav'
import { RegimeSwitch } from './RegimeSwitch'
import { Button } from '@/components/ui/Button'
import { FullPageLoader } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: Receipt, end: false },
  { to: '/contas', label: 'Contas', icon: Landmark, end: false },
  { to: '/fluxo', label: 'A receber e a pagar', icon: ArrowRightLeft, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: PieChart, end: false },
  { to: '/simulador', label: 'Simulador', icon: Calculator, end: false },
  { to: '/objetivos', label: 'Objetivos', icon: Target, end: false },
  { to: '/metas', label: 'Orçamento', icon: Flag, end: false },
  { to: '/contatos', label: 'Contatos', icon: Users, end: false },
]
// Área pessoal e ajuda (separadas do bloco de negócios)
const PERSONAL_NAV = { to: '/pessoal', label: 'Pessoal', icon: Wallet, end: false }
const HELP_NAV = { to: '/ajuda', label: 'Ajuda', icon: BookOpen, end: false }
// Barra inferior do mobile: só os cinco de uso diário — mais que isso
// vira alvo pequeno demais para o polegar.
const MOBILE_PATHS = ['/', '/lancamentos', '/contas', '/fluxo', '/relatorios']
const MOBILE_NAV = MOBILE_PATHS.map((p) => NAV.find((n) => n.to === p)!).filter(Boolean)

export function AppShell() {
  return (
    <TransactionComposerProvider>
      <ShellLayout />
    </TransactionComposerProvider>
  )
}

function ShellLayout() {
  const { signOut } = useAuth()
  const { openNew } = useComposer()
  const isPersonal = useLocation().pathname === '/pessoal'

  return (
    <div className="min-h-screen bg-base lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-5 lg:flex">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald">
            <span className="text-lg font-extrabold text-white">S</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-content">Souza Group</p>
            <p className="text-xs text-content-faint">Finance</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Navegação principal">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <div className="my-2 border-t border-line" />
          <NavItem {...PERSONAL_NAV} />
          <NavItem {...HELP_NAV} />
        </nav>

        <button
          onClick={() => signOut()}
          className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </aside>

      {/* Coluna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md pt-safe">
          <div className="flex items-center justify-between px-4 py-3 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald">
                <span className="text-base font-extrabold text-white">S</span>
              </div>
              <span className="text-sm font-bold text-content">Souza Group</span>
            </div>
            <div className="flex items-center gap-1">
              <NavLink
                to="/pessoal"
                className={({ isActive }) =>
                  cn(
                    'rounded-lg p-2 transition-colors',
                    isActive ? 'text-emerald' : 'text-content-muted hover:bg-surface-2',
                  )
                }
                aria-label="Pessoal"
              >
                <Wallet className="h-5 w-5" />
              </NavLink>
              <NavLink
                to="/ajuda"
                className={({ isActive }) =>
                  cn(
                    'rounded-lg p-2 transition-colors',
                    isActive ? 'text-emerald' : 'text-content-muted hover:bg-surface-2',
                  )
                }
                aria-label="Ajuda"
              >
                <BookOpen className="h-5 w-5" />
              </NavLink>
              <NavLink
                to="/contatos"
                className={({ isActive }) =>
                  cn(
                    'rounded-lg p-2 transition-colors',
                    isActive ? 'text-emerald' : 'text-content-muted hover:bg-surface-2',
                  )
                }
                aria-label="Contatos"
              >
                <Users className="h-5 w-5" />
              </NavLink>
              <button
                onClick={() => signOut()}
                className="rounded-lg p-2 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
                aria-label="Sair"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-4 pb-3 lg:flex-row lg:items-center lg:justify-between lg:py-3">
            {isPersonal ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-content">
                <Wallet className="h-4 w-4 text-content-muted" />
                Finanças pessoais
              </div>
            ) : (
              <ScopeSwitcher />
            )}
            <div className="flex items-center justify-between gap-2">
              <RegimeSwitch />
              <PeriodNav />
              {!isPersonal && (
                <Button size="sm" className="hidden lg:inline-flex" onClick={() => openNew()}>
                  <Plus className="h-4 w-4" />
                  Novo
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 lg:pb-8">
          <DataBoundary>
            <ClosedPeriodBanner />
            <Outlet />
          </DataBoundary>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/95 backdrop-blur-md pb-safe lg:hidden"
        aria-label="Navegação principal"
      >
        {MOBILE_NAV.map((item) => (
          <BottomNavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* FAB mobile (só no lado empresarial; Pessoal tem seu próprio botão) */}
      {!isPersonal && (
        <button
          onClick={() => openNew()}
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald text-white shadow-pop transition-transform active:scale-95 lg:hidden"
          aria-label="Novo lançamento"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

/** Aviso de mês fechado — editar um período conferido merece atenção. */
function ClosedPeriodBanner() {
  const { isPeriodClosed, period } = useAppData()
  if (!isPeriodClosed) return null

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-content-faint" />
      <p className="text-sm text-content-muted">
        <strong className="text-content">{formatMonthYear(period)} está fechado.</strong> Os números
        deste mês já foram conferidos. Alterar agora muda relatórios que você pode ter enviado —
        reabra em Relatórios se realmente precisar.
      </p>
    </div>
  )
}

function DataBoundary({ children }: { children: React.ReactNode }) {
  const { loading, error, refresh } = useAppData()
  if (loading) return <FullPageLoader />
  if (error)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-content-muted">{error}</p>
        <Button variant="secondary" onClick={() => refresh()}>
          Tentar novamente
        </Button>
      </div>
    )
  return <>{children}</>
}

function NavItem({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-emerald-soft text-emerald-dark' : 'text-content-muted hover:bg-surface-2 hover:text-content',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  )
}

function BottomNavItem({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
          isActive ? 'text-emerald-dark' : 'text-content-faint',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  )
}
