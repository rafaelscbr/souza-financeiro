import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, KeyRound, LogOut, Search, type LucideIcon } from 'lucide-react'
import { MarcaSouza } from '@/components/marca/Marca'
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
 * A NAVEGAÇÃO DO COMPUTADOR (Folha Clara): a barra do topo de 60px. As peças
 * de cima (contador, avatar, opções da conta) também servem a barra de baixo.
 */

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
  /*
   * Souza 3.0: no menu aberto o contador diz o que conta ("2 em atraso"), em
   * texto pequeno; vermelho só para dívida da imobiliária (risco). A bolinha
   * fica para onde não cabe palavra (menu recolhido, barra do polegar).
   */
  if (!compacto && item.rotuloContador) {
    return (
      <span
        className={cn(
          'ms-auto shrink-0 whitespace-nowrap font-medium text-nota num',
          // Na folha clara: vermelho para dívida nossa, âmbar para atraso da construtora.
          item.tomContador === 'risco' ? 'text-error-ink' : item.tomContador === 'atencao' ? 'text-warning-ink' : 'text-t-meta',
        )}
      >
        {item.rotuloContador(n)}
        <span className="sr-only">, {item.leituraContador ?? n}</span>
      </span>
    )
  }
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
/* A barra do topo                                                            */
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

const ANIM_ENTRA = (ms: number) => `esmaeceEntra ${ms}ms var(--curva-entra) backwards`
const ANIM_SAI = 'esmaeceSai var(--dur-saida) var(--curva-sai) both'

/* A pílula da barra: texto branco 82%; a ativa em Champanhe com tinta marinho. */
const PILULA =
  'relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-3.5 transition-colors duration-micro'
const PILULA_INATIVA = 'text-nav-text hover:bg-nav-hover hover:text-white'
const PILULA_ATIVA = 'bg-nav-active-bg font-semibold text-nav-active-text'

/** Um menu que abre abaixo de um botão da barra (Gestão, a conta). Fecha fora, com Esc e ao trocar de tela. */
function useMenuDaBarra() {
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const presenca = usePresenca(aberto, 180)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => setAberto(false), [])
  useArmadilhaDeFoco(aberto, menuRef, fechar)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (menuRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return
      setAberto(false)
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberto])
  useEffect(() => setAberto(false), [pathname])
  return { aberto, setAberto, presenca, botaoRef, menuRef, fechar }
}

/*
 * A BARRA DO TOPO (Folha Clara, 02/11/2026), a partir de 1024px.
 *
 * 60px, fundo --bar-bg. À esquerda a marca; no meio os destinos da primeira
 * seção em pílulas e cada seção seguinte numa pílula que abre um menu
 * ("Gestão"); à direita a busca e a conta. O rodapé do antigo trilho
 * (Configurações, Minhas comissões) mora no menu da conta.
 */
export function BarraDoTopo({ secoes, usuario, aoBuscar, aoTrocarSenha, aoSair }: NavRailProps) {
  const { pathname } = useLocation()
  const principais = secoes.filter((sec) => !sec.rodape)
  const [primeira, ...demais] = principais
  const doRodape = secoes.filter((sec) => sec.rodape).flatMap((sec) => sec.itens)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

  const pilula = (item: ItemNav) => (
    <li key={item.para}>
      <NavLink
        to={item.para}
        end={item.fim}
        className={({ isActive }) => `${cn(PILULA, isActive ? PILULA_ATIVA : PILULA_INATIVA)} text-menu`}
      >
        <span>{item.rotulo}</span>
        <ContadorNav item={item} compacto />
      </NavLink>
    </li>
  )

  return (
    <header
      aria-label="Barra do sistema"
      data-barra=""
      className="sticky top-0 z-nav hidden h-barra shrink-0 items-center gap-6 bg-nav-surface px-8 lg:flex"
    >
      <Link to="/" data-marca="" aria-label="Souza Financeiro, início" className="shrink-0 rounded-controle">
        <MarcaSouza negativo />
      </Link>

      <nav aria-label="Principal" data-rolagem="" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {primeira && (
          <>
            <h2 className="sr-only">{primeira.rotulo}</h2>
            <ul className="flex items-center gap-1">{primeira.itens.map(pilula)}</ul>
          </>
        )}
        {demais.map((secao) => (
          <MenuDeSecao key={secao.rotulo} secao={secao} pathname={pathname} />
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={aoBuscar}
          aria-label="Buscar telas, vendas e corretores"
          className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-nav-hover px-3.5 text-nav-text transition-colors hover:bg-white/15 hover:text-white"
        >
          <Icone icone={Search} tamanho={16} />
          <span className="text-menu">Buscar</span>
          <kbd className="rounded-kbd border border-nav-line px-1.5 py-0.5 text-nota font-semibold text-nav-muted xl:inline [@media(pointer:coarse)]:hidden">
            {mac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        <MenuDaConta
          usuario={usuario}
          doRodape={doRodape}
          aoBuscar={aoBuscar}
          aoTrocarSenha={aoTrocarSenha}
          aoSair={aoSair}
        />
      </div>
    </header>
  )
}

/** DEPRECADO — o nome do trilho lateral; a casca agora usa a barra do topo. */
export const NavRail = BarraDoTopo

/** Uma seção do menu (ex.: "Gestão") numa pílula que abre a lista dos destinos. */
function MenuDeSecao({ secao, pathname }: { secao: SecaoNav; pathname: string }) {
  const { setAberto, aberto, presenca, botaoRef, menuRef } = useMenuDaBarra()
  /*
   * O menu sai por portal, em posição fixa abaixo da pílula: a faixa de
   * pílulas rola na horizontal (overflow), e um menu absoluto dentro dela
   * ficava cortado — o clique só deslocava a faixa e nada aparecia.
   */
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    if (!aberto) return
    const posicionar = () => {
      const r = botaoRef.current?.getBoundingClientRect()
      if (r) setPos({ left: Math.min(r.left, window.innerWidth - 272), top: r.bottom + 12 })
    }
    posicionar()
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    return () => {
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
    }
  }, [aberto, botaoRef])
  const ativa = secao.itens.some((it) => (it.fim ? pathname === it.para : pathname === it.para || pathname.startsWith(`${it.para}/`)))
  const contador = secao.itens.reduce((n, it) => n + (it.contador ?? 0), 0)
  return (
    <div className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="true"
        aria-expanded={aberto}
        className={`${cn(PILULA, ativa ? PILULA_ATIVA : PILULA_INATIVA)} text-menu`}
      >
        {secao.rotulo}
        {contador > 0 && <Badge>{contador > 9 ? '9+' : contador}</Badge>}
        <Icone icone={ChevronDown} tamanho={16} />
      </button>
      {presenca.montado &&
        createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label={secao.rotulo}
          tabIndex={-1}
          {...presenca.props}
          style={{
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            visibility: pos ? undefined : 'hidden',
            animation: presenca.estado === 'saindo' ? ANIM_SAI : ANIM_ENTRA(150),
          }}
          className="fixed z-popover flex w-64 flex-col rounded-lista bg-surface p-2 shadow-dropdown outline-none"
        >
          <ul className="flex flex-col">
            {secao.itens.map((item) => (
              <li key={item.para}>
                <NavLink
                  to={item.para}
                  end={item.fim}
                  data-foco-inicial={item === secao.itens[0] || undefined}
                  className={({ isActive }) =>
                    `${cn(ITEM_CONTA, isActive && 'bg-s2 font-semibold text-t1')} text-texto-titulo`
                  }
                >
                  <Icone icone={item.icone} tamanho={16} className="text-t3" />
                  <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                  <ContadorNav item={item} compacto />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>,
          document.body,
        )}
    </div>
  )
}

/** A conta, à direita da barra: o rodapé do menu (Configurações…) e as opções da conta. */
function MenuDaConta({
  usuario,
  doRodape,
  aoBuscar,
  aoTrocarSenha,
  aoSair,
}: {
  usuario: UsuarioDaCasca
  doRodape: ItemNav[]
  aoBuscar: () => void
  aoTrocarSenha: () => void
  aoSair: () => void
}) {
  const { setAberto, aberto, presenca, botaoRef, menuRef } = useMenuDaBarra()
  // Fecha antes de agir: a paleta e o painel de senha precisam encontrar o foco livre.
  const depoisDeFechar = (acao: () => void) => () => {
    setAberto(false)
    acao()
  }
  return (
    <div className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Sua conta: ${usuario.nome}, ${usuario.papel}`}
        className={cn(
          'flex h-11 cursor-pointer items-center gap-2 rounded-full ps-1 pe-2.5 text-nav-text transition-colors hover:bg-nav-hover hover:text-white',
          aberto && 'bg-nav-hover',
        )}
      >
        <Avatar nome={usuario.nome} className="size-9 bg-brand-fill font-extrabold text-brand-fill-text" />
        <span className="hidden max-w-[10rem] truncate text-menu xl:inline">{usuario.nome}</span>
        <Icone icone={ChevronDown} tamanho={16} />
      </button>
      {presenca.montado && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Sua conta"
          tabIndex={-1}
          {...presenca.props}
          style={{ animation: presenca.estado === 'saindo' ? ANIM_SAI : ANIM_ENTRA(150) }}
          className="absolute right-0 top-full z-popover mt-2 flex max-h-[calc(100vh-80px)] w-72 flex-col overflow-y-auto rounded-lista bg-surface shadow-dropdown outline-none"
        >
          {doRodape.length > 0 && (
            <ul className="flex flex-col border-b border-fio-linha p-2">
              {doRodape.map((item) => (
                <li key={item.para}>
                  <NavLink
                    to={item.para}
                    end={item.fim}
                    className={({ isActive }) => `${cn(ITEM_CONTA, isActive && 'bg-s2 font-semibold text-t1')} text-texto-titulo`}
                  >
                    <Icone icone={item.icone} tamanho={16} className="text-t3" />
                    <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                    <ContadorNav item={item} compacto />
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          <OpcoesDaConta
            usuario={usuario}
            aoBuscar={depoisDeFechar(aoBuscar)}
            aoTrocarSenha={depoisDeFechar(aoTrocarSenha)}
            aoSair={depoisDeFechar(aoSair)}
          />
        </div>
      )}
    </div>
  )
}
