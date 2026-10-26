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

  const principais = secoes.filter((sec) => !sec.rodape)
  const doRodape = secoes.filter((sec) => sec.rodape).flatMap((sec) => sec.itens)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

  /* Um destino do menu (Souza 2.0): 32px, ícone 16, ativo em fundo neutro com ícone marinho. */
  const destino = (item: ItemNav) => {
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
              'group/item relative flex h-10 items-center rounded-controle transition-colors duration-micro lg:[@media(pointer:fine)]:h-8',
              recolhido ? 'justify-center' : 'gap-2.5 px-2.5',
              isActive
                ? 'bg-nav-active-bg font-medium text-nav-active-text [&_svg]:text-brand'
                : 'text-nav-text hover:bg-nav-hover hover:text-nav-active-text [&_svg]:text-nav-muted hover:[&_svg]:text-nav-text',
            )} text-texto-meta`
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
  }

  return (
    <aside
      aria-label="Menu lateral"
      data-trilho=""
      className={cn(
        'sticky top-0 z-nav hidden h-screen shrink-0 flex-col border-r border-nav-line bg-nav-surface lg:flex',
        recolhido ? 'w-[60px]' : 'w-[244px]',
      )}
    >
      {/* Topo (Souza 2.0): a empresa, discreta, e a busca logo abaixo. */}
      <div className={cn('flex shrink-0 flex-col gap-3 pb-2 pt-4', recolhido ? 'items-center px-2' : 'px-3')}>
        <Link
          to="/"
          data-marca=""
          aria-label="Souza Imobiliária, visão financeira"
          onMouseEnter={mostrarDica('Visão financeira')}
          onMouseLeave={esconderDica}
          onFocus={mostrarDica('Visão financeira')}
          onBlur={esconderDica}
          className={cn('flex min-w-0 items-center gap-2.5 rounded-controle', !recolhido && 'px-1.5 py-1')}
        >
          <MarcaS className="size-7 shrink-0" />
          {!recolhido && (
            <span aria-hidden className="flex min-w-0 flex-col leading-tight" style={{ animation: ANIM_ENTRA(120) }}>
              <span className="truncate font-semibold text-[color:var(--nav-logo)] text-texto-titulo">Souza Imobiliária</span>
              <span className="truncate text-nav-muted text-nota">Financeiro</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={aoBuscar}
          onMouseEnter={mostrarDica('Buscar')}
          onMouseLeave={esconderDica}
          aria-label="Buscar telas, vendas e corretores"
          className={cn(
            'flex items-center rounded-controle border border-nav-line bg-surface text-nav-muted transition-colors hover:border-[color:var(--line-input)] hover:text-nav-text',
            recolhido ? 'size-9 justify-center' : 'h-8 w-full gap-2 px-2.5',
          )}
        >
          <Icone icone={Search} tamanho={16} />
          {!recolhido && (
            <>
              <span className="flex-1 text-left text-texto-meta">Buscar</span>
              <kbd className="text-nota font-medium text-nav-muted">{mac ? '⌘K' : 'Ctrl K'}</kbd>
            </>
          )}
        </button>
      </div>

      <nav
        aria-label="Principal"
        onScroll={esconderDica}
        data-rolagem=""
        className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3 pt-2', !recolhido && 'gap-5 px-3')}
      >
        {principais.map((secao, i) => (
          <div key={secao.rotulo} className="flex flex-col">
            {recolhido ? (
              i > 0 && <span aria-hidden className="mx-2 my-2.5 h-px bg-nav-line" />
            ) : secao.semRotulo ? null : (
              <h2 className="mb-1 px-2.5 font-medium text-nav-muted text-nota">{secao.rotulo}</h2>
            )}
            {(recolhido || secao.semRotulo) && <h2 className="sr-only">{secao.rotulo}</h2>}
            <ul className="flex flex-col gap-0.5">{secao.itens.map(destino)}</ul>
          </div>
        ))}
      </nav>

      {/* Rodapé: Configurações, a conta e o recolher. */}
      <div className={cn('flex shrink-0 flex-col gap-1 border-t border-nav-line', recolhido ? 'items-center px-2 py-2' : 'p-3')}>
        {doRodape.length > 0 && <ul className={cn('flex flex-col gap-0.5', recolhido && 'items-center')}>{doRodape.map(destino)}</ul>}
        <div className={cn('flex items-center gap-1', recolhido && 'flex-col')}>
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
              recolhido ? 'size-10 justify-center' : 'h-11 min-w-0 flex-1 gap-2.5 px-1.5',
              menu && 'bg-nav-active-bg',
            )}
          >
            <Avatar nome={usuario.nome} className="size-7" />
            {!recolhido && (
              <>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-medium text-nav-active-text text-texto-meta">{usuario.nome}</span>
                  <span className="truncate text-nav-muted text-nota">{usuario.papel}</span>
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
            className={cn(BOTAO_RECOLHER, 'size-8')}
          >
            <Icone icone={recolhido ? PanelLeftOpen : PanelLeftClose} tamanho={16} />
          </button>
        </div>
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
