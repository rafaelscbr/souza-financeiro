import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  ChevronsUpDown,
  KeyRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { MarcaS } from '@/components/marca/Marca'
import { PopoverAvisos, type Aviso } from '@/components/shared/PopoverAvisos'
import { Rotulo } from '@/components/ui/Rotulo'
import { useArmadilhaDeFoco } from '@/components/ui/SidePanel'
import { TOM } from '@/components/ui/tom'
import { SeletorAparencia } from './SeletorAparencia'
import { SeletorDensidade } from './SeletorDensidade'
import type { ItemNav, SecaoNav } from './navegacao'
import { cn } from '@/lib/utils'

/*
 * O TRILHO LATERAL (docs/souza-os.md, seção 6, com os ajustes de 12/09).
 *
 * 248px aberto, 68px recolhido. O item ativo se reconhece por três coisas que
 * não dependem de enfeite: fundo neutro, texto mais forte e o ícone em Areia.
 * O filete de 3px do guia saiu a pedido do Rafael, e com ele o único sinal que
 * era só decoração.
 *
 * Recolher não anima a largura: movimento é só transform e opacity (princípio
 * 9), e largura animando empurra a tela inteira a cada quadro.
 */

const CHAVE_TRILHO = 'sgf.trilho'

function recolhidoInicial(): boolean {
  try {
    return localStorage.getItem(CHAVE_TRILHO) === 'recolhido'
  } catch {
    return false
  }
}

const NAO_TEXTO = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'])

function ehCampoDeTexto(el: HTMLElement) {
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return !NAO_TEXTO.has(el.type)
  return false
}

export interface UsuarioDaCasca {
  nome: string
  /** "Administrador" ou "Corretor". */
  papel: string
  email?: string | null
}

/* ------------------------------------------------------------------------- */
/* Peças compartilhadas com a barra do polegar                                */
/* ------------------------------------------------------------------------- */

/*
 * O contador de um destino. Número com nome, nunca pontinho: "3 recebimentos
 * vencidos" é o que o leitor de tela ouve, e o número à vista é o que diz o
 * estado sem depender da cor (princípio 3). Zero não aparece.
 *
 * Na versão compacta (trilho recolhido, polegar) o selo pousa sobre o ícone;
 * o fundo do tom é translúcido, então vai sobre um disco da cor do trilho para
 * o traço do ícone não atravessar o número.
 */
export function ContadorNav({ item, compacto }: { item: ItemNav; compacto?: boolean }) {
  const n = item.contador ?? 0
  if (n <= 0) return null
  const tom = TOM[item.tomContador ?? 'neutro']
  const selo = (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-semibold leading-none tabular-nums',
        compacto ? 'h-4 min-w-[16px] px-1 text-[11px]' : 'h-5 min-w-[20px] px-1.5 text-[11px]',
        tom.fundo,
        tom.borda,
        tom.texto,
      )}
    >
      {n}
    </span>
  )
  return (
    <>
      {compacto ? <span className="inline-flex rounded-full bg-nav-surface">{selo}</span> : selo}
      <span className="sr-only">, {item.leituraContador ?? n}</span>
    </>
  )
}

/** Avatar Areia com a inicial (seção 6). As iniciais são a única exceção ao piso de 11px; aqui nem precisa. */
export function Avatar({ nome, className }: { nome: string; className?: string }) {
  const inicial = nome.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'S'
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-fill font-heading text-[13px] font-bold text-brand-fill-text',
        className,
      )}
    >
      {inicial}
    </span>
  )
}

function ItemDaConta({
  icone: Icone,
  rotulo,
  atalho,
  aoClicar,
  focoInicial,
}: {
  icone: LucideIcon
  rotulo: string
  atalho?: string
  aoClicar: () => void
  focoInicial?: boolean
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      data-foco-inicial={focoInicial || undefined}
      className="flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm text-t2 transition-colors duration-150 hover:bg-nav-hover hover:text-t1"
    >
      <Icone size={16} strokeWidth={1.6} aria-hidden className="shrink-0 text-t4" />
      <span className="min-w-0 flex-1 truncate">{rotulo}</span>
      {atalho && (
        // Atalho de teclado só onde há teclado: com dedo, "⌘K" é ruído.
        <kbd className="hidden h-5 min-w-[20px] items-center justify-center rounded-md border border-line bg-s2 px-1.5 font-label text-[11px] font-medium text-t3 [@media(pointer:fine)]:inline-flex">
          {atalho}
        </kbd>
      )}
    </button>
  )
}

/**
 * O conteúdo do menu da conta: quem está logado, Buscar, Aparência, Densidade,
 * Trocar senha e Sair. O mesmo no popover do trilho e na folha "Mais" do
 * celular, para as duas portas levarem às mesmas coisas.
 */
export function OpcoesDaConta({
  usuario,
  aoBuscar,
  aoTrocarSenha,
  aoSair,
}: {
  usuario: UsuarioDaCasca
  aoBuscar: () => void
  aoTrocarSenha: () => void
  aoSair: () => void
}) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Avatar nome={usuario.nome} className="h-9 w-9 text-sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-t1">{usuario.nome}</p>
          <p className="mt-0.5 truncate text-xs text-t4">
            {usuario.papel}
            {usuario.email && <span className="text-t5"> · </span>}
            {usuario.email}
          </p>
        </div>
      </div>

      <div className="border-t border-nav-line p-1.5">
        <ItemDaConta icone={Search} rotulo="Buscar" atalho={mac ? '⌘K' : 'Ctrl K'} aoClicar={aoBuscar} focoInicial />
      </div>

      <div className="space-y-3 border-t border-nav-line px-3 pb-3.5 pt-3">
        <SeletorAparencia />
        <SeletorDensidade />
      </div>

      <div className="border-t border-nav-line p-1.5">
        <ItemDaConta icone={KeyRound} rotulo="Trocar senha" aoClicar={aoTrocarSenha} />
        <ItemDaConta icone={LogOut} rotulo="Sair" aoClicar={aoSair} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* O trilho                                                                   */
/* ------------------------------------------------------------------------- */

export interface NavRailProps {
  secoes: SecaoNav[]
  avisos: Aviso[]
  usuario: UsuarioDaCasca
  aoBuscar: () => void
  aoTrocarSenha: () => void
  aoSair: () => void
}

const BOTAO_ICONE =
  'relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-nav-text transition-colors duration-150 before:absolute before:-inset-[5px] hover:bg-nav-hover hover:text-nav-active-text'

export function NavRail({ secoes, avisos, usuario, aoBuscar, aoTrocarSenha, aoSair }: NavRailProps) {
  const { pathname } = useLocation()
  const [recolhido, setRecolhido] = useState(recolhidoInicial)
  const alternar = useCallback(() => setRecolhido((r) => !r), [])

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_TRILHO, recolhido ? 'recolhido' : 'aberto')
    } catch {
      /* sem localStorage: vale só nesta sessão */
    }
  }, [recolhido])

  /*
   * Atalho "[" (seção 6). Ignorado com o foco num campo de texto — quem digita
   * "[" numa observação não pode ver o menu fechar — e abaixo de lg, onde o
   * trilho nem existe.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return
      const alvo = e.target instanceof HTMLElement ? e.target : null
      if (alvo && ehCampoDeTexto(alvo)) return
      if (!window.matchMedia('(min-width: 1024px)').matches) return
      e.preventDefault()
      alternar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alternar])

  /*
   * Dica do trilho recolhido. Em portal com posição fixa porque a lista rola e
   * cortaria qualquer coisa que saísse dos 68px. O `title` nativo demora um
   * segundo para aparecer e não aparece no foco por teclado.
   */
  const [dica, setDica] = useState<{ texto: string; top: number; left: number } | null>(null)
  const mostrarDica = (texto: string) => (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    if (!recolhido) return
    const r = e.currentTarget.getBoundingClientRect()
    setDica({ texto, top: r.top + r.height / 2, left: r.right + 10 })
  }
  const esconderDica = () => setDica(null)
  useEffect(() => setDica(null), [recolhido, pathname])

  /* Menu da conta */
  const [menu, setMenu] = useState(false)
  const [posMenu, setPosMenu] = useState<{ left: number; bottom: number } | null>(null)
  const contaRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fecharMenu = useCallback(() => setMenu(false), [])
  useArmadilhaDeFoco(menu, menuRef, fecharMenu)

  useLayoutEffect(() => {
    if (!menu) return
    const posicionar = () => {
      const b = contaRef.current
      if (!b) return
      const r = b.getBoundingClientRect()
      // Aberto, o menu sobe a partir do avatar; recolhido, abre ao lado dele.
      setPosMenu(
        recolhido
          ? { left: r.right + 12, bottom: window.innerHeight - r.bottom }
          : { left: r.left, bottom: window.innerHeight - r.top + 8 },
      )
    }
    posicionar()
    window.addEventListener('resize', posicionar)
    return () => window.removeEventListener('resize', posicionar)
  }, [menu, recolhido])

  useEffect(() => {
    if (!menu) return
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (menuRef.current?.contains(alvo) || contaRef.current?.contains(alvo)) return
      setMenu(false)
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [menu])

  useEffect(() => setMenu(false), [pathname])

  // Fecha antes de agir: a paleta e o modal de senha precisam encontrar o foco livre.
  const depoisDeFechar = (acao: () => void) => () => {
    setMenu(false)
    acao()
  }

  return (
    <aside
      aria-label="Menu lateral"
      className={cn(
        'nav-rail sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-nav-line lg:flex',
        recolhido ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      {/* Topo: a marca, o sino e o recolher. */}
      <div className={cn('flex shrink-0 px-3 pb-3 pt-4', recolhido ? 'flex-col items-center gap-2.5' : 'items-center gap-2')}>
        <Link
          to="/"
          aria-label="Souza Imobiliária: ir para o Início"
          onMouseEnter={mostrarDica('Início')}
          onMouseLeave={esconderDica}
          onFocus={mostrarDica('Início')}
          onBlur={esconderDica}
          className={cn('flex min-w-0 items-center gap-2.5 rounded-[10px]', !recolhido && 'flex-1')}
        >
          <MarcaS className="h-8 w-8 shrink-0" />
          {!recolhido && (
            // O desenho do lockup em duas linhas: "Souza" e o descritor com o ponto final em Areia (seção 2).
            <span aria-hidden className="min-w-0 leading-none">
              <span className="block font-heading text-[15px] font-bold tracking-[-0.02em] text-[color:var(--nav-logo)]">
                Souza
              </span>
              <span className="mt-1 block font-label text-[11px] uppercase tracking-[0.14em] text-t4">
                Imobiliária<span className="text-brand">.</span>
              </span>
            </span>
          )}
        </Link>

        <div className={cn('flex items-center', recolhido ? 'flex-col gap-1.5' : 'gap-1')}>
          <PopoverAvisos avisos={avisos} />
          <button
            type="button"
            onClick={alternar}
            aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!recolhido}
            aria-keyshortcuts="["
            title={recolhido ? 'Expandir menu  [' : 'Recolher menu  ['}
            className={BOTAO_ICONE}
          >
            {recolhido ? (
              <PanelLeftOpen size={16} strokeWidth={1.6} aria-hidden />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.6} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Destinos */}
      <nav
        aria-label="Principal"
        onScroll={esconderDica}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-1"
      >
        {secoes.map((secao, i) => (
          <div
            key={secao.rotulo}
            className={cn(i > 0 && (recolhido ? 'mt-2 border-t border-nav-line pt-2' : 'mt-5'))}
          >
            <Rotulo as="h2" className={recolhido ? 'sr-only' : 'px-2.5 pb-1.5'}>
              {secao.rotulo}
            </Rotulo>
            <ul className="flex flex-col gap-0.5">
              {secao.itens.map((item) => {
                const texto = item.contador ? `${item.rotulo} · ${item.leituraContador ?? item.contador}` : item.rotulo
                const Icone = item.icone
                return (
                  <li key={item.para}>
                    <NavLink
                      to={item.para}
                      end={item.fim}
                      onMouseEnter={mostrarDica(texto)}
                      onMouseLeave={esconderDica}
                      onFocus={mostrarDica(texto)}
                      onBlur={esconderDica}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-10 items-center rounded-[10px] text-sm transition-colors duration-150',
                          recolhido ? 'justify-center' : 'gap-3 px-2.5',
                          isActive
                            ? 'bg-nav-active-bg font-medium text-nav-active-text'
                            : 'text-nav-text hover:bg-nav-hover hover:text-nav-active-text',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icone
                            size={16}
                            strokeWidth={1.6}
                            aria-hidden
                            className={cn(
                              'shrink-0 transition-colors duration-150',
                              isActive ? 'text-brand' : 'text-nav-muted group-hover:text-nav-text',
                            )}
                          />
                          <span className={recolhido ? 'sr-only' : 'min-w-0 flex-1 truncate'}>{item.rotulo}</span>
                          {recolhido ? (
                            item.contador ? (
                              <span className="absolute right-0.5 top-0.5 flex">
                                <ContadorNav item={item} compacto />
                              </span>
                            ) : null
                          ) : (
                            <ContadorNav item={item} />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Rodapé: quem está logado, e o menu da conta. */}
      <div className="shrink-0 border-t border-nav-line p-3">
        <button
          ref={contaRef}
          type="button"
          onClick={() => setMenu((m) => !m)}
          onMouseEnter={mostrarDica(usuario.nome)}
          onMouseLeave={esconderDica}
          aria-haspopup="dialog"
          aria-expanded={menu}
          aria-label={`Sua conta: ${usuario.nome}, ${usuario.papel}`}
          className={cn(
            'flex w-full items-center rounded-[10px] text-left transition-colors duration-150 hover:bg-nav-hover',
            recolhido ? 'justify-center p-1.5' : 'gap-2.5 p-2',
            menu && 'bg-nav-active-bg',
          )}
        >
          <Avatar nome={usuario.nome} />
          {!recolhido && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-nav-active-text">{usuario.nome}</span>
                <span className="mt-0.5 block truncate text-[11px] text-t4">{usuario.papel}</span>
              </span>
              <ChevronsUpDown size={14} strokeWidth={1.6} aria-hidden className="shrink-0 text-nav-muted" />
            </>
          )}
        </button>
      </div>

      {dica &&
        createPortal(
          <div
            aria-hidden
            style={{ top: dica.top, left: dica.left }}
            className="pointer-events-none fixed z-[55] -translate-y-1/2 whitespace-nowrap rounded-lg border border-nav-line bg-[color:var(--nav-elev)] px-2.5 py-1.5 text-[13px] text-t1 shadow-dropdown animate-[overlayEntra_150ms_cubic-bezier(0.16,1,0.3,1)_backwards]"
          >
            {dica.texto}
          </div>,
          document.body,
        )}

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Sua conta"
            tabIndex={-1}
            style={{
              left: posMenu?.left ?? 0,
              bottom: posMenu?.bottom ?? 0,
              visibility: posMenu ? undefined : 'hidden',
            }}
            className="fixed z-[55] w-64 overflow-hidden rounded-[14px] border border-nav-line bg-[color:var(--nav-elev)] shadow-dropdown outline-none animate-[slideUp_180ms_cubic-bezier(0.16,1,0.3,1)_backwards]"
          >
            <OpcoesDaConta
              usuario={usuario}
              aoBuscar={depoisDeFechar(aoBuscar)}
              aoTrocarSenha={depoisDeFechar(aoTrocarSenha)}
              aoSair={depoisDeFechar(aoSair)}
            />
          </div>,
          document.body,
        )}
    </aside>
  )
}
