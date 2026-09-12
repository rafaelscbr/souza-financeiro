import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, Handshake, Home, KeyRound, LogOut, User, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { TrocarSenha } from '@/auth/TrocarSenha'
import { useCorretor } from './CorretorData'
import { Simbolo } from '@/components/marca/Marca'
import { ComposicaoProvider } from '@/components/composicao/Composicao'
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
 * uma visita e outra, muitas vezes no sol. Daí o piso de 12px em tudo, alvos de
 * 44px e estado dito por forma antes de cor.
 *
 * Sem navegador de mês no topo: o que ele quer saber é "quanto tenho a
 * receber", não "como foi maio".
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
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  const primeiroNome = (profile?.name ?? '').split(' ')[0]

  return (
    <ComposicaoProvider>
      <div className="min-h-screen bg-papel">
        <header className="sticky top-0 z-30 border-b border-line bg-surface pt-safe">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Simbolo className="h-8 w-8 shrink-0 text-content" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-base font-semibold text-content">
                  {primeiroNome ? `Olá, ${primeiroNome}` : 'Suas comissões'}
                </p>
                <p className="assinatura sem-ponto mt-0.5">Souza Imobiliária</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {anosDisponiveis.length > 1 && (
                <Select
                  aria-label="Ano"
                  value={String(ano)}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className="h-toque w-24 text-base"
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
                className="flex h-toque w-toque items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
                aria-label="Seu perfil"
              >
                <User className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="mx-auto hidden max-w-2xl gap-1 px-5 pb-2 sm:flex" aria-label="Navegação">
            {MENU.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-toque items-center gap-2 rounded-xl px-3 text-base font-medium transition-colors',
                    isActive
                      ? 'bg-action-soft font-semibold text-action-soft-ink'
                      : 'text-content-muted hover:bg-surface-2 hover:text-content',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-2xl px-5 py-5 pb-28 sm:pb-10">
          {carregando ? (
            <FullPageLoader label="Carregando suas vendas…" />
          ) : erro ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-sm text-base text-content-muted">{erro}</p>
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
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-safe sm:hidden"
          aria-label="Navegação principal"
        >
          {MENU.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-toque flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
                  isActive ? 'font-semibold text-action-soft-ink' : 'text-content-faint',
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
            <div className="absolute inset-0 bg-marca-navy/60" onClick={() => setPerfil(false)} />
            <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl bg-surface p-5 pb-safe sm:inset-x-auto sm:right-5 sm:top-16 sm:w-80 sm:rounded-3xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-content">
                    {profile?.name ?? 'Corretor'}
                  </p>
                  <p className="truncate text-sm text-content-faint">{email}</p>
                </div>
                <button
                  onClick={() => setPerfil(false)}
                  className="-mr-2 -mt-1.5 flex h-toque w-toque shrink-0 items-center justify-center rounded-lg text-content-muted"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex min-h-toque items-center justify-between rounded-lg bg-surface-2 px-3.5">
                <span className="text-base text-content-muted">Tema</span>
                <ThemeToggle />
              </div>
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => {
                  setPerfil(false)
                  setTrocandoSenha(true)
                }}
              >
                <KeyRound className="h-4 w-4" />
                Trocar minha senha
              </Button>
              <p className="mt-2 text-sm text-content-faint">
                Esqueceu? A imobiliária redefine para você.
              </p>
              <Button variant="secondary" className="mt-3 w-full" onClick={() => sair()}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        )}

        <TrocarSenha aberto={trocandoSenha} onFechar={() => setTrocandoSenha(false)} />
      </div>
    </ComposicaoProvider>
  )
}
