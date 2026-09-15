import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconeTom } from '@/components/ui/IconeTom'
import { EsqueletoCards, EsqueletoLista, EstadoErro } from '@/components/ui/Estados'
import type { Tom } from '@/components/ui/tom'
import { PopoverAvisos, type Aviso } from '@/components/shared/PopoverAvisos'
import { useRolou } from '@/lib/useRolou'
import { rotaDe, type AcaoDeCta, type RotaDeclarada } from './navegacao'
import { cn } from '@/lib/utils'

/*
 * A CASCA DA PÁGINA (4.1, 4.2): um modelo só.
 *
 *   <header class="cabecalho">  altura fixa (56 / 64) em TODAS as rotas, fundo
 *                               liso, fio e sombra só ao rolar (useRolou)
 *   <main class="conteudo entrada-pagina flex flex-col gap-secao pt-topo pb-barra-inferior">
 *     1º filho: bloco de abertura (subtítulo no celular + faixa), se houver
 *     blocos da tela
 *
 * Quem mora no cabeçalho é declarado pela ROTA (navegacao.ts: ícone, título,
 * mês, faixa, CTA, voltar) e, quando a tela já migrou, pelo próprio
 * PageLayout, que desenha o cabeçalho num portal dentro do <header> da casca.
 * A casca nunca injeta nada que a rota não declarou.
 *
 * Tela que ainda não usa PageLayout (transição): o cabeçalho sai da declaração
 * da rota, e o seletor de mês entra como faixa se a rota declara `usaMes`.
 */

/* ------------------------------------------------------------------------- */
/* Conversa entre a tela e a casca                                            */
/* ------------------------------------------------------------------------- */

export interface CascaValue {
  avisos: Aviso[]
  /** A tela anuncia que desenha o próprio cabeçalho (contador: numa troca de rota a nova monta antes de a velha sair). */
  registrarQuadro: () => () => void
  /** A declaração da rota aberta. */
  rota?: RotaDeclarada
  /** O seletor de mês da casca (só o admin tem). */
  mes?: ReactNode
  /** As funções por trás dos CTAs declarados pelas rotas. */
  acoesDeCta?: Partial<Record<AcaoDeCta, () => void>>
  /** Onde o PageLayout desenha o cabeçalho (portal). */
  slotCabecalho?: HTMLElement | null
}

export const CascaContext = createContext<CascaValue | null>(null)

/** Estado da casca: quantos quadros estão montados e a função que eles chamam. */
// eslint-disable-next-line react-refresh/only-export-components
export function useQuadrosDaCasca(): [number, () => () => void] {
  const [quadros, setQuadros] = useState(0)
  const registrarQuadro = useCallback(() => {
    setQuadros((n) => n + 1)
    return () => setQuadros((n) => n - 1)
  }, [])
  return [quadros, registrarQuadro]
}

/** DEPRECADO — apagar na limpeza final. A casca monta o valor em `CascaDaPagina`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useValorDaCasca(avisos: Aviso[], registrarQuadro: () => () => void): CascaValue {
  return useMemo(() => ({ avisos, registrarQuadro }), [avisos, registrarQuadro])
}

/** A tela anuncia à casca que desenha o próprio cabeçalho. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAnunciarQuadro() {
  const registrar = useContext(CascaContext)?.registrarQuadro
  useLayoutEffect(() => registrar?.(), [registrar])
}

/* ------------------------------------------------------------------------- */
/* A ação principal                                                           */
/* ------------------------------------------------------------------------- */

export interface CtaDaPagina {
  rotulo: string
  /** Rótulo curto entre 420 e 639px, se couber. Abaixo de 420 o CTA é o quadrado de 44 só com o ícone. O nome acessível continua o completo. */
  rotuloCurto?: string
  aoClicar: () => void
}

/**
 * O CTA do cabeçalho: `Button` primário 40 (44 no toque) com ícone Plus.
 * Abaixo de 640 é o quadrado de 44 só com o ícone (4.2); o rótulo curto, se a
 * rota declarar, aparece a partir de 420, onde cabe ao lado do título.
 */
export function BotaoCta({ rotulo, rotuloCurto, aoClicar, className }: CtaDaPagina & { className?: string }) {
  return (
    <Button
      variant="primario"
      icone={Plus}
      onClick={aoClicar}
      aria-label={rotulo}
      className={cn('max-sm:w-11 max-sm:px-0', rotuloCurto && 'min-[420px]:max-sm:w-auto min-[420px]:max-sm:px-4', className)}
    >
      {rotuloCurto && <span className="hidden min-[420px]:max-sm:inline">{rotuloCurto}</span>}
      <span className="hidden sm:inline">{rotulo}</span>
    </Button>
  )
}

/* ------------------------------------------------------------------------- */
/* O conteúdo do cabeçalho                                                    */
/* ------------------------------------------------------------------------- */

interface ConteudoDoCabecalho {
  icone: LucideIcon
  tom?: Tom
  titulo: string
  subtitulo?: ReactNode
  acoes?: ReactNode
  menu?: ReactNode
  cta?: CtaDaPagina
  voltar?: { para: string; rotulo: string }
}

/* Botão-ícone do cabeçalho: 40 no computador, 44 abaixo de 1024 e no toque. */
const BOTAO_ICONE =
  'flex size-10 shrink-0 items-center justify-center rounded-controle text-t2 transition-colors hover:bg-linha-hover hover:text-t1 active:bg-linha-press max-lg:size-11 [@media(pointer:coarse)]:size-11'

/*
 * Computador: [← 40, ficha] 12 [IconeTom 36] 12 [h1 + subtítulo] … [sino 40] 12 [ações ≤2] 12 [CTA 40]
 * Celular:    [IconeTom 28] 12 [h1] … [sino 44] [CTA 44, rótulo curto]
 * Ficha no celular: [← 44] 8 [h1 truncado] … [sino 44] [⋯ 44] (sem IconeTom e sem CTA)
 */
function CabecalhoDaPagina({ icone, tom = 'neutro', titulo, subtitulo, acoes, menu, cta, voltar }: ConteudoDoCabecalho) {
  const avisos = useContext(CascaContext)?.avisos
  const navigate = useNavigate()
  const location = useLocation()
  const ficha = Boolean(voltar)

  const aoVoltar = () => {
    if (!voltar) return
    const de = (location.state as { de?: string } | null)?.de
    navigate(de ?? voltar.para)
  }

  return (
    <>
      {voltar && (
        <button type="button" onClick={aoVoltar} aria-label={`Voltar para ${voltar.rotulo}`} className={BOTAO_ICONE}>
          <ArrowLeft size={16} strokeWidth={1.6} aria-hidden focusable="false" />
        </button>
      )}
      <IconeTom icone={icone} tom={tom} tamanho="sm" className={cn('lg:hidden', ficha && 'hidden')} />
      <IconeTom icone={icone} tom={tom} tamanho="md" className="max-lg:hidden" />
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="min-w-0 truncate font-heading text-t1 text-titulo-pagina-m lg:text-titulo-pagina">
          {titulo}
        </h1>
        {subtitulo && (
          <p
            className="min-w-0 flex-1 truncate text-t-meta text-texto-meta max-lg:hidden"
            title={typeof subtitulo === 'string' ? subtitulo : undefined}
          >
            {subtitulo}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {avisos && <PopoverAvisos avisos={avisos} />}
        {acoes && <div className="flex items-center gap-3 max-lg:hidden">{acoes}</div>}
        {menu}
        {cta && <BotaoCta {...cta} className={cn(ficha && 'max-lg:hidden')} />}
      </div>
    </>
  )
}

/*
 * O bloco de abertura: 1º filho do <main>. No celular junta o subtítulo (que
 * sai do cabeçalho), a faixa e as ações; no computador sobra só a faixa
 * (`min-h-12 flex flex-wrap items-center`). Sem faixa no computador, o bloco
 * some ali, para não somar um vão de seção vazio.
 */
function AberturaDaPagina({ subtitulo, faixa, acoes }: { subtitulo?: ReactNode; faixa?: ReactNode; acoes?: ReactNode }) {
  if (!subtitulo && !faixa && !acoes) return null
  const faixaNoComputador = Boolean(faixa)
  const faixaVisivel = Boolean(faixa || acoes)
  return (
    <div className={cn('flex flex-col gap-4', !faixaNoComputador && 'lg:hidden')}>
      {subtitulo && <p className="line-clamp-2 text-t-meta text-texto-meta lg:hidden">{subtitulo}</p>}
      {faixaVisivel && (
        <div className={cn('flex min-h-12 flex-wrap items-center gap-2 lg:gap-3', !faixa && 'lg:hidden')}>
          {faixa}
          {acoes && <div className="flex flex-wrap items-center gap-2 lg:hidden">{acoes}</div>}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* O PageLayout: o que a tela declara                                         */
/* ------------------------------------------------------------------------- */

export interface PageLayoutProps {
  /** Título do h1. Sem ele, o da rota (navegacao.ts). */
  titulo?: string
  /** O que a tela faz, ou um resumo vivo. Computador: ao lado do h1, 1 linha; celular: bloco de abertura, até 2. */
  subtitulo?: ReactNode
  /** O ícone da área. Sem ele, o da rota. */
  icone?: LucideIcon
  /** DEPRECADO — apagar na limpeza final. O ícone do cabeçalho é neutro. */
  tom?: Tom
  /** Seletor de mês na faixa. Sem a prop, vale o que a rota declara (`usaMes`). */
  mes?: boolean
  /** Até 2 ações ao lado do sino (no celular descem para a faixa, salvo quando há `menu`). */
  acoes?: ReactNode
  /**
   * O "⋯" da ficha (4.2), em todas as larguras, depois das ações. Com ele, no
   * celular as `acoes` NÃO descem para a faixa: a tela põe Editar e as demais
   * dentro deste menu (mesma função, mesmos argumentos).
   */
  menu?: ReactNode
  /** A ação principal. Sem ela, a que a rota declara. */
  cta?: CtaDaPagina
  /** Filtros rápidos ou abas: 1º filho do <main>, rola com o conteúdo. */
  faixa?: ReactNode
  /** Ficha: botão voltar para esta lista. Sem ele, o que a rota declara. */
  voltarPara?: string
  /** `dados` (padrão, 1216 de teto) ou `leitura` (coluna de 720 à esquerda). */
  largura?: 'dados' | 'leitura'
  children: ReactNode
}

export function PageLayout({
  titulo,
  subtitulo,
  icone,
  tom,
  mes,
  acoes,
  menu,
  cta,
  faixa,
  voltarPara,
  largura = 'dados',
  children,
}: PageLayoutProps) {
  const casca = useContext(CascaContext)
  const { pathname } = useLocation()
  useAnunciarQuadro()

  const rota = casca?.rota
  const tituloFinal = titulo ?? rota?.titulo ?? ''
  const iconeFinal = icone ?? rota?.icone
  const ctaDaRota = rota?.cta && casca?.acoesDeCta?.[rota.cta.acao]
  const ctaFinal: CtaDaPagina | undefined =
    cta ?? (rota?.cta && ctaDaRota ? { rotulo: rota.cta.rotulo, rotuloCurto: rota.cta.rotuloCurto, aoClicar: ctaDaRota } : undefined)
  const voltar = voltarPara
    ? { para: voltarPara, rotulo: rota?.voltar?.rotulo ?? 'a lista' }
    : rota?.voltar
  const usaMes = mes ?? rota?.usaMes ?? false
  const faixaFinal =
    usaMes && casca?.mes ? (
      <>
        {casca.mes}
        {faixa}
      </>
    ) : (
      faixa
    )

  if (import.meta.env.DEV && !iconeFinal) {
    console.error(`[PageLayout] sem ícone para ${pathname}: declare a rota em navegacao.ts ou passe \`icone\`.`)
  }

  useEffect(() => {
    if (!tituloFinal) return
    const anterior = document.title
    document.title = `${tituloFinal} · Souza Imobiliária`
    return () => {
      document.title = anterior
    }
  }, [tituloFinal])

  const cabecalho = iconeFinal ? (
    <CabecalhoDaPagina
      icone={iconeFinal}
      tom={tom}
      titulo={tituloFinal}
      subtitulo={subtitulo}
      acoes={acoes}
      menu={menu}
      cta={ctaFinal}
      voltar={voltar}
    />
  ) : null

  const corpo = (
    <>
      <AberturaDaPagina subtitulo={subtitulo} faixa={faixaFinal} acoes={menu ? undefined : acoes} />
      {largura === 'leitura' ? <div className="leitura flex flex-col gap-secao">{children}</div> : children}
    </>
  )

  // Dentro da casca: cabeçalho por portal, corpo direto no <main> da casca.
  if (casca) {
    return (
      <>
        {casca.slotCabecalho && cabecalho && createPortal(cabecalho, casca.slotCabecalho)}
        {corpo}
      </>
    )
  }

  // Fora da casca (amostras): a mesma receita, sozinha.
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="cabecalho">
        <div className="conteudo flex h-cabecalho items-center gap-3">{cabecalho}</div>
      </header>
      <main className="conteudo entrada-pagina flex flex-col gap-secao pb-barra-inferior pt-topo">{corpo}</main>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* A casca: cabeçalho fixo + <main>                                           */
/* ------------------------------------------------------------------------- */

export interface CascaDaPaginaProps {
  /** As declarações das rotas deste perfil (navegacao.ts). */
  rotas: RotaDeclarada[]
  /** O sino: sempre no cabeçalho, antes das ações da tela. */
  avisos: Aviso[]
  /** O seletor de mês, para as rotas que declaram `usaMes`. */
  mes?: ReactNode
  /** As funções dos CTAs declarados pelas rotas. */
  acoesDeCta?: Partial<Record<AcaoDeCta, () => void>>
  /** Dados da casca ainda carregando: esqueleto no lugar da tela, cabeçalho de pé. */
  carregando?: boolean
  /** Falha ao ler o banco: erro no lugar da tela (erro vence vazio). */
  erro?: ReactNode
  aoTentarDeNovo?: () => void
  children: ReactNode
}

export function CascaDaPagina({
  rotas,
  avisos,
  mes,
  acoesDeCta,
  carregando = false,
  erro,
  aoTentarDeNovo,
  children,
}: CascaDaPaginaProps) {
  const { pathname } = useLocation()
  const rota = useMemo(() => rotaDe(pathname, rotas), [pathname, rotas])
  const [quadros, registrarQuadro] = useQuadrosDaCasca()
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [sentinela, rolou] = useRolou()
  const legado = quadros === 0

  const valor = useMemo<CascaValue>(
    () => ({ avisos, registrarQuadro, rota, mes, acoesDeCta, slotCabecalho: slot }),
    [avisos, registrarQuadro, rota, mes, acoesDeCta, slot],
  )

  // Tela sem PageLayout: o título da aba vem da rota.
  useEffect(() => {
    if (legado) document.title = `${rota.titulo} · Souza Imobiliária`
  }, [legado, rota])

  const ctaDaRota = rota.cta && acoesDeCta?.[rota.cta.acao]

  return (
    <CascaContext.Provider value={valor}>
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Sentinela de 1px na base do cabeçalho: sai da vista ao rolar e acende o fio (4.2). */}
        <div ref={sentinela} aria-hidden className="pointer-events-none absolute inset-x-0 top-cabecalho h-px" />

        <header className="cabecalho" data-rolou={rolou || undefined}>
          <div className={cn('conteudo flex h-cabecalho items-center gap-3', rota.voltar && 'max-lg:gap-2')}>
            <div className="contents">
              {legado && (
                <CabecalhoDaPagina
                  icone={rota.icone}
                  titulo={rota.titulo}
                  voltar={rota.voltar}
                  cta={
                    rota.cta && ctaDaRota
                      ? { rotulo: rota.cta.rotulo, rotuloCurto: rota.cta.rotuloCurto, aoClicar: ctaDaRota }
                      : undefined
                  }
                />
              )}
            </div>
            <div ref={setSlot} className="contents" />
          </div>
        </header>

        <main key={pathname} className="conteudo entrada-pagina flex flex-col gap-secao pb-barra-inferior pt-topo">
          {carregando ? (
            <CarregandoTela />
          ) : erro ? (
            <ErroDaTela motivo={erro} aoTentarDeNovo={aoTentarDeNovo} />
          ) : (
            <>
              {legado && rota.usaMes && mes ? <AberturaDaPagina faixa={mes} /> : null}
              {children}
            </>
          )}
        </main>
      </div>
    </CascaContext.Provider>
  )
}

/** Carregando no lugar da tela, dentro do <main> da casca: a forma da composição, sem spinner (7.13). */
export function CarregandoTela({ rotulo = 'Carregando…' }: { rotulo?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-secao">
      <span className="sr-only">{rotulo}</span>
      <EsqueletoCards quantos={4} />
      <EsqueletoLista linhas={5} />
    </div>
  )
}

/** Falhou no lugar da tela: o erro dentro de uma caixa, o cabeçalho continua de pé. */
export function ErroDaTela({ motivo, aoTentarDeNovo }: { motivo?: ReactNode; aoTentarDeNovo?: () => void }) {
  return (
    <div data-caixa="" className="rounded-caixa border border-fio-caixa bg-surface shadow-card">
      <EstadoErro motivo={motivo} aoTentarDeNovo={aoTentarDeNovo ?? (() => window.location.reload())} />
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Transição                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * DEPRECADO — apagar na limpeza final. A casca é `CascaDaPagina`; a barra e o
 * respiro de transição deixaram de existir (cabeçalho e faixa vêm da rota).
 */
export function AreaDaTela({ children }: { quadros?: number; barra?: ReactNode; children: ReactNode }) {
  return <>{children}</>
}

/**
 * DEPRECADO — apagar na limpeza final. Mês e CTA agora são declarados pela rota
 * (navegacao.ts) e desenhados pela `CascaDaPagina`; não desenha nada.
 */
export function BarraDeTransicao(_props: { acoes?: ReactNode; cta?: CtaDaPagina }) {
  return null
}

/** DEPRECADO — apagar na limpeza final. Use `CarregandoTela`. */
export function QuadroCarregando({ rotulo }: { rotulo: string }) {
  return <CarregandoTela rotulo={rotulo} />
}

/** DEPRECADO — apagar na limpeza final. Use `ErroDaTela`. */
export function QuadroErro({ motivo, aoTentarDeNovo }: { motivo?: ReactNode; aoTentarDeNovo: () => void }) {
  return <ErroDaTela motivo={motivo} aoTentarDeNovo={aoTentarDeNovo} />
}
