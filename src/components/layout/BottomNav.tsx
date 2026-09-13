import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, MoreHorizontal, X } from 'lucide-react'
import { Rotulo } from '@/components/ui/Rotulo'
import { useArmadilhaDeFoco } from '@/components/ui/SidePanel'
import { ContadorNav, OpcoesDaConta, type UsuarioDaCasca } from './NavRail'
import { estaAtivo, type ItemNav } from './navegacao'
import { cn } from '@/lib/utils'

/*
 * A BARRA DO POLEGAR (docs/souza-os.md, seção 6), abaixo de lg.
 *
 * Os destinos do dia a dia e um "Mais" com o resto e a conta. Sem botão
 * flutuante: registrar venda e lançar despesa moram no CTA do cabeçalho de
 * cada tela, e um FAB por cima da lista repetiria o mesmo botão tapando a
 * última linha, justamente a que a pessoa rolou até ali para ver.
 *
 * O item ativo tem fundo tonalizado atrás do ícone, e o ícone em Areia: o
 * mesmo par de sinais do trilho, para as duas navegações lerem igual.
 */

export interface BottomNavProps {
  /** Até cinco destinos, na ordem da lista de navegação. */
  destinos: ItemNav[]
  /** O que não coube no polegar. Pode ser vazio: o "Mais" ainda leva à conta. */
  mais: ItemNav[]
  usuario: UsuarioDaCasca
  aoBuscar: () => void
  aoTrocarSenha: () => void
  aoSair: () => void
}

function Pilula({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'relative flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150',
        ativo ? 'bg-nav-active-bg text-brand' : 'text-nav-muted',
      )}
    >
      {children}
    </span>
  )
}

const ITEM =
  'flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-0.5 pb-1.5 pt-2 text-[11px] font-medium leading-none transition-colors duration-150'

export function BottomNav({ destinos, mais, usuario, aoBuscar, aoTrocarSenha, aoSair }: BottomNavProps) {
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const folhaRef = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => setAberto(false), [])
  useArmadilhaDeFoco(aberto, folhaRef, fechar)

  useEffect(() => setAberto(false), [pathname])

  // O "Mais" acende quando a tela aberta é uma das que moram nele.
  const maisAtivo = mais.some((i) => estaAtivo(pathname, i))
  const contadorMais = mais.reduce((s, i) => s + (i.contador ?? 0), 0)
  const tomMais = mais.find((i) => (i.contador ?? 0) > 0)?.tomContador

  const depoisDeFechar = (acao: () => void) => () => {
    setAberto(false)
    acao()
  }

  return (
    <>
      <nav
        aria-label="Principal"
        className="nav-bg-blur fixed inset-x-0 bottom-0 z-30 border-t border-nav-line pb-safe lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl">
          {destinos.map((item) => {
            const Icone = item.icone
            return (
              <li key={item.para} className="min-w-0 flex-1">
                <NavLink to={item.para} end={item.fim} className={ITEM}>
                  {({ isActive }) => (
                    <>
                      <Pilula ativo={isActive}>
                        <Icone size={20} strokeWidth={1.6} aria-hidden />
                        {item.contador ? (
                          <span className="absolute -right-1 -top-1 flex">
                            <ContadorNav item={item} compacto />
                          </span>
                        ) : null}
                      </Pilula>
                      <span className={cn('max-w-full truncate', isActive ? 'text-nav-active-text' : 'text-nav-text')}>
                        {item.rotulo}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setAberto(true)}
              aria-haspopup="dialog"
              aria-expanded={aberto}
              className={ITEM}
            >
              <Pilula ativo={maisAtivo || aberto}>
                <MoreHorizontal size={20} strokeWidth={1.6} aria-hidden />
                {contadorMais > 0 && (
                  <span className="absolute -right-1 -top-1 flex">
                    <ContadorNav
                      item={{ para: '', rotulo: 'Mais', icone: MoreHorizontal, contador: contadorMais, tomContador: tomMais }}
                      compacto
                    />
                  </span>
                )}
              </Pilula>
              <span className={maisAtivo || aberto ? 'text-nav-active-text' : 'text-nav-text'}>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {aberto &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div aria-hidden className="overlay-entra absolute inset-0 bg-black/40" onClick={fechar} />
            <div
              ref={folhaRef}
              role="dialog"
              aria-modal="true"
              aria-label="Mais"
              tabIndex={-1}
              className="modal-surface absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-[20px] pb-safe shadow-modal outline-none animate-[painelSobe_280ms_cubic-bezier(0.16,1,0.3,1)_backwards]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-1.5">
                <Rotulo as="h2">Mais</Rotulo>
                <button
                  type="button"
                  onClick={fechar}
                  aria-label="Fechar"
                  className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-t3 transition-colors duration-150 hover:bg-s3/50 hover:text-t1"
                >
                  <X size={18} strokeWidth={1.6} aria-hidden />
                </button>
              </div>

              {mais.length > 0 && (
                <ul className="p-1.5">
                  {mais.map((item) => {
                    const Icone = item.icone
                    return (
                      <li key={item.para}>
                        <NavLink
                          to={item.para}
                          end={item.fim}
                          onClick={fechar}
                          className={({ isActive }) =>
                            cn(
                              'flex h-12 items-center gap-3 rounded-lg px-2.5 text-[15px] transition-colors duration-150',
                              isActive ? 'bg-nav-active-bg font-medium text-t1' : 'text-t2 hover:bg-s3/50',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icone
                                size={18}
                                strokeWidth={1.6}
                                aria-hidden
                                className={cn('shrink-0', isActive ? 'text-brand' : 'text-t4')}
                              />
                              <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                              <ContadorNav item={item} />
                              <ChevronRight size={16} strokeWidth={1.6} aria-hidden className="shrink-0 text-t4" />
                            </>
                          )}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className={cn(mais.length > 0 && 'border-t border-line')}>
                <OpcoesDaConta
                  usuario={usuario}
                  aoBuscar={depoisDeFechar(aoBuscar)}
                  aoTrocarSenha={depoisDeFechar(aoTrocarSenha)}
                  aoSair={depoisDeFechar(aoSair)}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
