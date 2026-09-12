import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2, Home, Handshake, ArrowDownCircle, ArrowUpCircle, Receipt, Users,
  PieChart, Settings, MoreHorizontal, Plus, LogOut, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useAdmin } from './AdminData'
import { RegistrarVenda } from './RegistrarVenda'
import { LancarDespesa } from './LancarDespesa'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { FullPageLoader } from '@/components/ui/Spinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A casca do administrador.
 *
 * Oito itens no computador, cinco no polegar. Não há seletor de empresa, nem
 * de espaço pessoal, nem chave caixa/competência — as três coisas que faziam o
 * app antigo parecer um painel de controle de avião.
 */
const MENU = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/vendas', label: 'Vendas', icon: Handshake },
  { to: '/receber', label: 'Receber', icon: ArrowDownCircle },
  { to: '/pagar', label: 'Pagar', icon: ArrowUpCircle },
  { to: '/despesas', label: 'Despesas', icon: Receipt },
  { to: '/corretores', label: 'Corretores', icon: Users },
  { to: '/relatorios', label: 'Relatórios', icon: PieChart },
  { to: '/config', label: 'Configurações', icon: Settings },
]
const NO_POLEGAR = ['/', '/vendas', '/receber', '/pagar']

export function AdminShell() {
  const { sair, profile } = useAuth()
  const { carregando, erro, recarregar, mes, mesAnterior, mesSeguinte, irParaMes, receber, pagar, atencao } = useAdmin()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mais, setMais] = useState(false)
  const [novaVenda, setNovaVenda] = useState(false)
  const [novaDespesa, setNovaDespesa] = useState(false)

  const contadores: Record<string, number> = {
    '/receber': receber.filter((i) => i.overdue).length,
    '/pagar': pagar.filter((i) => i.overdue || (i.kind === 'comissao' && i.released)).length,
  }

  return (
    <div className="min-h-screen bg-base lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-imobiliaria">
            <Building2 className="h-5 w-5 text-brand-imobiliaria-accent" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-content">Souza Imobiliária</p>
            <p className="text-xs text-content-faint">Vendas e financeiro</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Navegação principal">
          {MENU.map((item) => (
            <ItemMenu key={item.to} {...item} badge={contadores[item.to]} />
          ))}
        </nav>

        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={() => sair()}
            className="flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md pt-safe">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-imobiliaria">
                <Building2 className="h-4 w-4 text-brand-imobiliaria-accent" />
              </div>
              <span className="text-sm font-bold text-content">Souza Imobiliária</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5">
                <button
                  onClick={mesAnterior}
                  className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-surface hover:text-content"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => irParaMes(new Date())}
                  className="min-w-[7.5rem] px-1 text-sm font-semibold text-content"
                >
                  {formatMonthYear(mes)}
                </button>
                <button
                  onClick={mesSeguinte}
                  className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-surface hover:text-content"
                  aria-label="Mês seguinte"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="lg:hidden">
                <ThemeToggle />
              </div>
              <Button size="sm" className="hidden lg:inline-flex" onClick={() => setNovaVenda(true)}>
                <Plus className="h-4 w-4" />
                Registrar venda
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 lg:pb-8">
          {carregando ? (
            <FullPageLoader label="Carregando a imobiliária…" />
          ) : erro ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-md text-content-muted">{erro}</p>
              <Button variant="secondary" onClick={() => recarregar()}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          )}
        </main>
      </div>

      {/* Barra do polegar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-md pb-safe lg:hidden"
        aria-label="Navegação principal"
      >
        {MENU.filter((m) => NO_POLEGAR.includes(m.to)).map((item) => (
          <ItemBarra key={item.to} {...item} badge={contadores[item.to]} />
        ))}
        <button
          onClick={() => setMais(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-content-faint"
        >
          <MoreHorizontal className="h-5 w-5" />
          Mais
        </button>
      </nav>

      {/* Ações principais no celular */}
      {!carregando && !erro && (
        <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2 lg:hidden">
          <button
            onClick={() => setNovaDespesa(true)}
            className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-content shadow-pop"
          >
            <Receipt className="h-4 w-4" />
            Despesa
          </button>
          <button
            onClick={() => setNovaVenda(true)}
            className="flex h-14 items-center gap-2 rounded-full bg-brand-imobiliaria px-5 text-sm font-bold text-white shadow-pop transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            Venda
          </button>
        </div>
      )}

      {mais && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMais(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-2xl bg-surface p-4 pb-safe">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-content">Mais</p>
              <button onClick={() => setMais(false)} className="rounded-lg p-2 text-content-muted" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MENU.filter((m) => !NO_POLEGAR.includes(m.to)).map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setMais(false)
                    navigate(item.to)
                  }}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-sm font-medium text-content"
                >
                  <item.icon className="h-5 w-5 text-content-muted" />
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => sair()}
                className="col-span-2 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-content-muted"
              >
                <LogOut className="h-5 w-5" />
                Sair{profile?.name ? ` (${profile.name})` : ''}
              </button>
            </div>
            {atencao.length > 0 && (
              <p className="mt-2 px-1 text-xs text-content-faint">
                {atencao.length} item(ns) precisando de atenção no Início.
              </p>
            )}
          </div>
        </div>
      )}

      <RegistrarVenda aberto={novaVenda} onFechar={() => setNovaVenda(false)} />
      <LancarDespesa aberto={novaDespesa} onFechar={() => setNovaDespesa(false)} />
    </div>
  )
}

function ItemMenu({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brandblue-soft text-brandblue'
            : 'text-content-muted hover:bg-surface-2 hover:text-content',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="tnum rounded-full bg-pending/15 px-1.5 py-0.5 text-[10px] font-bold text-pending">
          {badge}
        </span>
      ) : null}
    </NavLink>
  )
}

function ItemBarra({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
          isActive ? 'text-brandblue' : 'text-content-faint',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
      {badge ? (
        <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-pending" aria-hidden />
      ) : null}
    </NavLink>
  )
}
