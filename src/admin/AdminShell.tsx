import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Handshake, ArrowDownCircle, ArrowUpCircle, Receipt, Users,
  PieChart, Settings, MoreHorizontal, Plus, LogOut, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useAdmin } from './AdminData'
import { RegistrarVenda } from './RegistrarVenda'
import { LancarDespesa } from './LancarDespesa'
import { Simbolo } from '@/components/marca/Marca'
import { ComposicaoProvider } from '@/components/composicao/Composicao'
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
 *
 * A marca aqui é o símbolo de verdade: moldura de traço fino com o "S", no
 * raio percentual de 24%, que é o único jeito de ele parecer o mesmo objeto a
 * 32px e a 80px. No lugar dele havia um ícone de prédio de biblioteca.
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

/** Marca + nome, como aparece no topo. */
function Marcador({ compacto }: { compacto?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Simbolo className={cn('shrink-0 text-content', compacto ? 'h-7 w-7' : 'h-9 w-9')} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-base font-semibold text-content">Souza Imobiliária</p>
        {!compacto && <p className="assinatura sem-ponto mt-0.5">Financeiro</p>}
      </div>
    </div>
  )
}

export function AdminShell() {
  const { sair, profile } = useAuth()
  const { carregando, erro, recarregar, mes, mesAnterior, mesSeguinte, irParaMes, receber, pagar, atencao } = useAdmin()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mais, setMais] = useState(false)
  const [novaVenda, setNovaVenda] = useState(false)
  const [novaDespesa, setNovaDespesa] = useState(false)

  /*
   * Dois contadores com significados diferentes, e por isso duas cores
   * diferentes: vencido é promessa quebrada (crítico), comissão liberada é
   * trabalho esperando um humano (o ouro da marca). Antes os dois eram âmbar,
   * o que fazia "alguém está esperando" parecer "algo deu errado".
   */
  const vencidos = receber.filter((i) => i.overdue).length
  const esperando = pagar.filter((i) => i.overdue || (i.kind === 'comissao' && i.released)).length

  return (
    <ComposicaoProvider>
      <div className="min-h-screen bg-papel lg:flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
          <div className="mb-7 px-2">
            <Marcador />
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Navegação principal">
            {MENU.map((item) => (
              <ItemMenu
                key={item.to}
                {...item}
                badge={item.to === '/receber' ? vencidos : item.to === '/pagar' ? esperando : undefined}
                tom={item.to === '/receber' ? 'critico' : 'ouro'}
              />
            ))}
          </nav>

          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={() => sair()}
              className="flex min-h-toque flex-1 items-center gap-2.5 rounded-lg px-3 text-base font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-surface pt-safe">
            <div className="flex items-center justify-between gap-3 px-5 py-2.5">
              <div className="lg:hidden">
                <Marcador compacto />
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* Setas de 44px. Eram 28px — abaixo do piso de toque. */}
                <div className="flex items-center rounded-lg border border-line">
                  <button
                    onClick={mesAnterior}
                    className="flex h-toque w-10 items-center justify-center rounded-l-lg text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
                    aria-label="Mês anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => irParaMes(new Date())}
                    className="min-w-[8rem] px-1 text-base font-semibold text-content"
                    title="Voltar para o mês atual"
                  >
                    {formatMonthYear(mes)}
                  </button>
                  <button
                    onClick={mesSeguinte}
                    className="flex h-toque w-10 items-center justify-center rounded-r-lg text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
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

          <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-5 pb-28 lg:px-8 lg:pb-10">
            {carregando ? (
              <FullPageLoader label="Carregando a imobiliária…" />
            ) : erro ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-md text-base text-content-muted">{erro}</p>
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
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-safe lg:hidden"
          aria-label="Navegação principal"
        >
          {MENU.filter((m) => NO_POLEGAR.includes(m.to)).map((item) => (
            <ItemBarra
              key={item.to}
              {...item}
              badge={item.to === '/receber' ? vencidos : item.to === '/pagar' ? esperando : undefined}
              tom={item.to === '/receber' ? 'critico' : 'ouro'}
            />
          ))}
          <button
            onClick={() => setMais(true)}
            className="flex min-h-toque flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium text-content-faint"
          >
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        </nav>

        {/* A ação principal do celular. Uma só: registrar venda. */}
        {!carregando && !erro && (
          <div className="fixed bottom-24 right-5 z-30 flex flex-col items-end gap-2 lg:hidden">
            <button
              onClick={() => setNovaDespesa(true)}
              className="flex h-toque items-center gap-1.5 rounded-lg border border-rule bg-surface px-4 text-base font-semibold text-content shadow-pop"
            >
              <Receipt className="h-4 w-4" />
              Despesa
            </button>
            <button
              onClick={() => setNovaVenda(true)}
              className="flex h-14 items-center gap-2 rounded-lg bg-action px-5 text-base font-bold text-action-ink shadow-pop"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              Venda
            </button>
          </div>
        )}

        {mais && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-marca-navy/60" onClick={() => setMais(false)} />
            <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl bg-surface p-5 pb-safe">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-lg font-semibold text-content">Mais</p>
                <button
                  onClick={() => setMais(false)}
                  className="-mr-2 flex h-toque w-toque items-center justify-center rounded-lg text-content-muted"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ul className="divide-y divide-line">
                {MENU.filter((m) => !NO_POLEGAR.includes(m.to)).map((item) => (
                  <li key={item.to}>
                    <button
                      onClick={() => {
                        setMais(false)
                        navigate(item.to)
                      }}
                      className="flex min-h-toque w-full items-center gap-3 py-2.5 text-left text-base font-medium text-content"
                    >
                      <item.icon className="h-5 w-5 text-content-muted" />
                      {item.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => sair()}
                    className="flex min-h-toque w-full items-center gap-3 py-2.5 text-left text-base font-medium text-content-muted"
                  >
                    <LogOut className="h-5 w-5" />
                    Sair{profile?.name ? ` · ${profile.name}` : ''}
                  </button>
                </li>
              </ul>
              {atencao.length > 0 && (
                <p className="mt-3 border-t border-rule pt-3 text-sm text-content-muted">
                  {atencao.length === 1
                    ? '1 item precisando de atenção no Início.'
                    : `${atencao.length} itens precisando de atenção no Início.`}
                </p>
              )}
            </div>
          </div>
        )}

        <RegistrarVenda aberto={novaVenda} onFechar={() => setNovaVenda(false)} />
        <LancarDespesa aberto={novaDespesa} onFechar={() => setNovaDespesa(false)} />
      </div>
    </ComposicaoProvider>
  )
}

/*
 * O contador é um NÚMERO com rótulo acessível, não um pontinho.
 * "3 itens vencidos" é o que um leitor de tela deve ouvir; um disco de 8px
 * sem texto não diz nada a ninguém que não esteja vendo a tela.
 */
function Contador({ n, tom }: { n: number; tom: 'critico' | 'ouro' }) {
  return (
    <span
      className={cn(
        'cifra min-w-5 rounded-full px-1.5 text-center text-xs font-bold',
        tom === 'critico' ? 'bg-critical-field text-critical-ink' : 'bg-seal text-seal-ink',
      )}
    >
      {n}
    </span>
  )
}

function ItemMenu({
  to,
  label,
  icon: Icon,
  end,
  badge,
  tom = 'ouro',
}: {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  badge?: number
  tom?: 'critico' | 'ouro'
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-toque items-center gap-2.5 rounded-lg px-3 text-base font-medium transition-colors',
          isActive
            ? 'bg-action-soft font-semibold text-action-soft-ink'
            : 'text-content-muted hover:bg-surface-2 hover:text-content',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <>
          <Contador n={badge} tom={tom} />
          <span className="sr-only">
            {tom === 'critico'
              ? `${badge} ${badge === 1 ? 'item vencido' : 'itens vencidos'}`
              : `${badge} ${badge === 1 ? 'item esperando' : 'itens esperando'}`}
          </span>
        </>
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
  tom = 'ouro',
}: {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  badge?: number
  tom?: 'critico' | 'ouro'
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-toque flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors',
          isActive ? 'font-semibold text-action-soft-ink' : 'text-content-faint',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
      {badge ? (
        <>
          <span className="absolute right-[16%] top-1">
            <Contador n={badge} tom={tom} />
          </span>
          <span className="sr-only">
            {tom === 'critico'
              ? `${badge} ${badge === 1 ? 'item vencido' : 'itens vencidos'}`
              : `${badge} ${badge === 1 ? 'item esperando' : 'itens esperando'}`}
          </span>
        </>
      ) : null}
    </NavLink>
  )
}
