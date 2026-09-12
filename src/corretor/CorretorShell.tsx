import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Building2, CalendarDays, Handshake, Home, LogOut, User, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useCorretor } from './CorretorData'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { FullPageLoader } from '@/components/ui/Spinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Select } from '@/components/ui/Field'
import { cn } from '@/lib/utils'

/**
 * A casca do corretor: três destinos, nada para criar.
 *
 * Pensada para o celular primeiro — é de onde ele vai olhar, geralmente entre
 * uma visita e outra. Sem navegador de mês no topo: o que ele quer saber é
 * "quanto tenho a receber", não "como foi maio".
 */
const MENU = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/minhas-vendas', label: 'Vendas', icon: Handshake },
  { to: '/recebimentos', label: 'Recebimentos', icon: CalendarDays },
]

export function CorretorShell() {
  const { sair, profile, email } = useAuth()
  const { carregando, erro, recarregar, ano, anosDisponiveis, setAno } = useCorretor()
  const { pathname } = useLocation()
  const [perfil, setPerfil] = useState(false)

  const primeiroNome = (profile?.name ?? '').split(' ')[0]

  return (
    <div className="min-h-screen bg-base">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md pt-safe">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-imobiliaria">
              <Building2 className="h-4.5 w-4.5 text-brand-imobiliaria-accent" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-content">
                {primeiroNome ? `Olá, ${primeiroNome}` : 'Seus recebimentos'}
              </p>
              <p className="truncate text-xs text-content-faint">Souza Imobiliária</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {anosDisponiveis.length > 1 && (
              <Select
                aria-label="Ano"
                value={String(ano)}
                onChange={(e) => setAno(Number(e.target.value))}
                className="h-9 w-24 text-sm"
              >
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            )}
            <button
              onClick={() => setPerfil(true)}
              className="rounded-lg p-2 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
              aria-label="Seu perfil"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-3xl gap-1 px-4 pb-2 sm:flex" aria-label="Navegação">
          {MENU.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brandblue-soft text-brandblue' : 'text-content-muted hover:text-content',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-28 sm:pb-8">
        {carregando ? (
          <FullPageLoader label="Carregando suas vendas…" />
        ) : erro ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-content-muted">{erro}</p>
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

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-md pb-safe sm:hidden"
        aria-label="Navegação principal"
      >
        {MENU.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-brandblue' : 'text-content-faint',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {perfil && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPerfil(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-2xl bg-surface p-5 pb-safe sm:inset-x-auto sm:right-4 sm:top-16 sm:w-72 sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-content">{profile?.name ?? 'Corretor'}</p>
                <p className="truncate text-xs text-content-faint">{email}</p>
              </div>
              <button onClick={() => setPerfil(false)} className="rounded-lg p-1.5 text-content-muted" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
              <span className="text-sm text-content-muted">Tema</span>
              <ThemeToggle />
            </div>
            <p className="mt-3 text-xs text-content-faint">
              Para trocar a senha, saia e use "Esqueci minha senha" na tela de entrada.
            </p>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => sair()}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
