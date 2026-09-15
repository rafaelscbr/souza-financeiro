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
import { ChevronsUpDown, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, Search, type LucideIcon } from 'lucide-react'
import { MarcaS } from '@/components/marca/Marca'
import type { Aviso } from '@/components/shared/PopoverAvisos'
import { Badge } from '@/components/ui/Badge'
import { Icone } from '@/components/ui/Icone'
import { Rotulo } from '@/components/ui/Rotulo'
import { useArmadilhaDeFoco } from '@/components/ui/SidePanel'
import { usePresenca } from '@/lib/usePresenca'
import { SeletorAparencia } from './SeletorAparencia'
import { SeletorDensidade } from './SeletorDensidade'
import type { ItemNav, SecaoNav } from './navegacao'
import { cn } from '@/lib/utils'

/*
 * O TRILHO LATERAL (4.3), a partir de 1024px.
 *
 * 248px aberto, 68 recolhido; a largura muda sem animar. Topo com a altura do
 * cabeçalho da página e SÓ a marca (o sino foi para o cabeçalho, o recolher
 * para o rodapé). 24px até o primeiro grupo. Item ativo neutro: fundo, texto
 * forte e `aria-current`, sem filete e sem ouro.
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
/* Peças compartilhadas com a barra inferior                                  */
/* ------------------------------------------------------------------------- */

/**
 * O contador de um destino (Badge, 7.7): número com nome para o leitor de tela.
 * Risco quando conta algo vencido; neutro no resto. Compacto (sobre ícone):
 * no máximo "9+". Zero não aparece.
 */
export function ContadorNav({ item, compacto }: { item: ItemNav; compacto?: boolean }) {
  const n = item.contador ?? 0
  if (n <= 0) return null
  return (
    <>
      <Badge risco={item.tomContador === 'risco'} className={compacto ? undefined : 'ms-auto'}>
        <span aria-hidden>{compacto && n > 9 ? '9+' : n}</span>
      </Badge>
      <span className="sr-only">, {item.leituraContador ?? n}</span>
    </>
  )
}

/** Avatar com a inicial: 32px (44 quando é o botão do trilho recolhido). */
export function Avatar({ nome, className }: { nome: string; className?: string }) {
  const inicial = nome.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'S'
  return (
    <span
      aria-hidden
      className={`${cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-s3 font-heading text-t1',
        className,
      )} text-botao`}
    >
      {inicial}
    </span>
  )
}

const ITEM_CONTA =
  'flex h-11 w-full items-center gap-3 rounded-controle px-3 text-left text-t2 transition-colors hover:bg-linha-hover hover:text-t1 active:bg-linha-press lg:[@media(pointer:fine)]:h-10'

function ItemDaConta({
  icone,
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
      className={`${ITEM_CONTA} text-texto-titulo`}
    >
      <Icone icone={icone} tamanho={16} className="text-t3" />
      <span className="min-w-0 flex-1 truncate">{rotulo}</span>
      {atalho && (
        // Atalho de teclado só onde há teclado: com dedo, "⌘K" é ruído.
        <kbd className="hidden h-5 items-center rounded-badge border border-fio-linha bg-s2 px-2 font-label text-t2 text-chip [@media(pointer:fine)]:inline-flex">
          {atalho}
        </kbd>
      )}
    </button>
  )
}

/**
 * O menu da conta: quem está logado, Buscar, Aparência, Densidade, Trocar
 * senha e Sair. O mesmo no popover do trilho e na folha "Mais" do celular.
 * `contexto="popover"` traz o próprio recuo; `"painel"` usa o do corpo do painel.
 */
export function OpcoesDaConta({
  usuario,
  aoBuscar,
  aoTrocarSenha,
  aoSair,
  contexto = 'popover',
}: {
  usuario: UsuarioDaCasca
  aoBuscar: () => void
  aoTrocarSenha: () => void
  aoSair: () => void
  contexto?: 'popover' | 'painel'
}) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
  const bloco = contexto === 'popover' ? 'p-2' : 'py-2'
  const blocoTexto = contexto === 'popover' ? 'px-4 py-3' : 'py-3'
  return (
    <div className="flex flex-col">
      <div className={cn('flex items-center gap-3', blocoTexto)}>
        <Avatar nome={usuario.nome} />
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-medium text-t1 text-texto-titulo">{usuario.nome}</p>
          <p className="truncate text-t-meta text-texto-meta">
            {usuario.papel}
            {usuario.email ? ` · ${usuario.email}` : ''}
          </p>
        </div>
      </div>

      <div className={cn('border-t border-fio-linha', bloco)}>
        <ItemDaConta icone={Search} rotulo="Buscar" atalho={mac ? '⌘K' : 'Ctrl K'} aoClicar={aoBuscar} focoInicial />
      </div>

      <div className={cn('flex flex-col gap-4 border-t border-fio-linha', blocoTexto)}>
        <SeletorAparencia />
        <SeletorDensidade />
      </div>

      <div className={cn('border-t border-fio-linha', bloco)}>
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
  /** DEPRECADO — apagar na limpeza final. O sino mora no cabeçalho da página (4.3); ignorado. */
  avisos?: Aviso[]
  usuario: UsuarioDaCasca
  aoBuscar: () => void
  aoTrocarSenha: () => void
  aoSair: () => void
}

/* Controle isolado (8.4): a cor transiciona; pressionar é fundo, sem escala (8.3). */
const BOTAO_RECOLHER =
  'flex size-10 shrink-0 items-center justify-center rounded-controle text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-active-text active:bg-linha-press'

const ANIM_ENTRA = (ms: number) => `esmaeceEntra ${ms}ms var(--curva-entra) backwards`
const ANIM_SAI = 'esmaeceSai var(--dur-saida) var(--curva-sai) both'

export function NavRail({ secoes, usuario, aoBuscar, aoTrocarSenha, aoSair }: NavRailProps) {
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

  /* Atalho "[": ignorado em campo de texto e abaixo de 1024, onde o trilho não existe. */
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

  /* Dica do trilho recolhido: portal fixo, 8px à direita, entra em 120ms. */
  const [dica, setDica] = useState<{ texto: string; top: number; left: number } | null>(null)
  const mostrarDica = (texto: string) => (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    if (!recolhido) return
    const r = e.currentTarget.getBoundingClientRect()
    setDica({ texto, top: r.top + r.height / 2, left: r.right + 8 })
  }
  const esconderDica = () => setDica(null)
  useEffect(() => setDica(null), [recolhido, pathname])

  /* Menu da conta: abre para cima (ao lado, recolhido), sai em 180ms. */
  const [menu, setMenu] = useState(false)
  const presencaMenu = usePresenca(menu, 180)
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

  // Fecha antes de agir: a paleta e o painel de senha precisam encontrar o foco livre.
  const depoisDeFechar = (acao: () => void) => () => {
    setMenu(false)
    acao()
  }

  return (
    <aside
      aria-label="Menu lateral"
      data-trilho=""
      className={cn(
        'sticky top-0 z-nav hidden h-screen shrink-0 flex-col border-r border-nav-line bg-nav-surface lg:flex',
        recolhido ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      {/* Topo: altura do cabeçalho, só a marca, sem fio embaixo. */}
      <div className={cn('flex h-cabecalho shrink-0 items-center', recolhido ? 'justify-center' : 'px-4')}>
        <Link
          to="/"
          data-marca=""
          aria-label="Souza Imobiliária, início"
          onMouseEnter={mostrarDica('Início')}
          onMouseLeave={esconderDica}
          onFocus={mostrarDica('Início')}
          onBlur={esconderDica}
          className="flex min-w-0 items-center gap-3 rounded-controle"
        >
          <MarcaS className="size-8 shrink-0" />
          {!recolhido && (
            <span aria-hidden className="flex min-w-0 flex-col" style={{ animation: ANIM_ENTRA(120) }}>
              <span className="font-heading font-bold text-[color:var(--nav-logo)] text-valor-linha">Souza</span>
              <span className="font-label uppercase tracking-[0.08em] text-t-meta text-rotulo">Imobiliária</span>
            </span>
          )}
        </Link>
      </div>

      {/* Destinos: 24 da base do topo até o 1º rótulo; 24 acima e 8 abaixo de cada rótulo. */}
      <nav
        aria-label="Principal"
        onScroll={esconderDica}
        data-rolagem=""
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-6"
      >
        {secoes.map((secao, i) => (
          <div key={secao.rotulo} className="flex flex-col">
            {recolhido ? (
              i > 0 && <span aria-hidden className="mx-3 my-3 h-px bg-nav-line" />
            ) : (
              <Rotulo as="h2" className={cn('mb-2 px-3', i > 0 && 'mt-6')}>
                {secao.rotulo}
              </Rotulo>
            )}
            {recolhido && <h2 className="sr-only">{secao.rotulo}</h2>}
            <ul className="flex flex-col gap-1">
              {secao.itens.map((item) => {
                const texto = item.contador ? `${item.rotulo} · ${item.leituraContador ?? item.contador}` : item.rotulo
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
                        `${cn(
                          'relative flex h-10 items-center rounded-controle transition-colors active:bg-linha-press',
                          recolhido ? 'justify-center' : 'gap-3 px-3',
                          isActive
                            ? 'bg-nav-active-bg font-semibold text-nav-active-text'
                            : 'text-nav-text hover:bg-nav-hover hover:text-nav-active-text',
                        )} text-texto-titulo`
                      }
                    >
                      <Icone icone={item.icone} tamanho={16} />
                      <span
                        className={recolhido ? 'sr-only' : 'min-w-0 flex-1 truncate'}
                        style={recolhido ? undefined : { animation: ANIM_ENTRA(120) }}
                      >
                        {item.rotulo}
                      </span>
                      {recolhido ? (
                        item.contador ? (
                          <span className="absolute right-0 top-0 flex -translate-y-1/4 translate-x-1/4">
                            <ContadorNav item={item} compacto />
                          </span>
                        ) : null
                      ) : (
                        <ContadorNav item={item} />
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Rodapé: a conta e o recolher. Recolhido, um em cima do outro. */}
      <div
        className={cn(
          'flex shrink-0 border-t border-nav-line',
          recolhido ? 'flex-col items-center gap-2 px-3 py-3' : 'items-center gap-2 p-3',
        )}
      >
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
            'flex items-center rounded-controle text-left transition-colors hover:bg-nav-hover active:bg-linha-press',
            recolhido ? 'size-11 justify-center' : 'h-14 min-w-0 flex-1 gap-3 px-2',
            menu && 'bg-nav-active-bg',
          )}
        >
          <Avatar nome={usuario.nome} />
          {!recolhido && (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-nav-active-text text-texto-titulo">{usuario.nome}</span>
                <span className="truncate text-t-meta text-texto-meta">{usuario.papel}</span>
              </span>
              <Icone icone={ChevronsUpDown} tamanho={16} className="text-nav-muted" />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={alternar}
          onMouseEnter={mostrarDica('Expandir menu')}
          onMouseLeave={esconderDica}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!recolhido}
          aria-keyshortcuts="["
          title={recolhido ? undefined : 'Recolher menu  ['}
          className={BOTAO_RECOLHER}
        >
          <Icone icone={recolhido ? PanelLeftOpen : PanelLeftClose} tamanho={16} />
        </button>
      </div>

      {dica &&
        createPortal(
          <div
            aria-hidden
            style={{ top: dica.top, left: dica.left, animation: ANIM_ENTRA(120) }}
            className="pointer-events-none fixed z-popover -translate-y-1/2 whitespace-nowrap rounded-controle border border-fio-caixa bg-surface px-3 py-2 text-t1 shadow-dropdown text-texto-meta"
          >
            {dica.texto}
          </div>,
          document.body,
        )}

      {presencaMenu.montado &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Sua conta"
            tabIndex={-1}
            {...presencaMenu.props}
            style={{
              left: posMenu?.left ?? 0,
              bottom: posMenu?.bottom ?? 0,
              visibility: posMenu ? undefined : 'hidden',
              animation: presencaMenu.estado === 'saindo' ? ANIM_SAI : ANIM_ENTRA(150),
            }}
            className="fixed z-popover flex max-h-[calc(100vh-32px)] w-72 flex-col overflow-y-auto rounded-caixa border border-fio-caixa bg-surface shadow-dropdown outline-none"
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
