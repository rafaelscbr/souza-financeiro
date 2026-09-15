import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { Icone } from './Icone'
import { usePresenca } from '@/lib/usePresenca'
import { cn } from '@/lib/utils'

/*
 * PAINEL LATERAL (7.10; 5.2 nível 2; 8.3 abrir, fechar e drill-down).
 *
 * Contexto acima de foco total: quem abre uma parcela continua vendo a lista
 * de onde ela saiu, à esquerda, sob o véu `veu-painel`. O modal central fica
 * só para confirmação (ConfirmDialog).
 *
 * Três andares: cabeçalho de 64px (Voltar, título, ações, Fechar), corpo que
 * rola sozinho e rodapé fixo com as ações. Um painel por vez: o drill-down
 * troca o conteúdo (avança/recua 200ms) e mostra "Voltar"; nunca empilha.
 * Entra em 280ms e sai em 180ms (`usePresenca`); o foco volta ao gatilho e a
 * trava de rolagem não desloca a página (`scrollbar-gutter: stable` no html).
 */

const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const CAMPOS =
  'input:not([disabled]):not([readonly]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]):not([readonly])'

/*
 * Pilha das sobreposições abertas. Uma composição pode abrir sobre um painel,
 * uma confirmação sobre um formulário: sem a pilha, um Escape fecharia as duas
 * de uma vez e o Tab disputaria o foco entre elas. Só quem está no topo ouve.
 */
const pilha: number[] = []
let proximoId = 1

/* A trava da rolagem conta quantos a pediram, para o segundo painel a fechar
 * não devolver a rolagem à página enquanto o primeiro ainda está aberto. */
let travas = 0
let overflowAntes = ''
let paddingAntes = ''

function travarRolagem() {
  if (travas === 0) {
    // Trava no <html>: é ele que rola, e o scrollbar-gutter:stable dele só guarda a
    // calha com overflow próprio. Travar o body deslocava a página 4px (item 15).
    const html = document.documentElement
    const larguraAntes = html.clientWidth
    overflowAntes = html.style.overflow
    paddingAntes = html.style.paddingRight
    html.style.overflow = 'hidden'
    // A barra de rolagem fina (4px) some mesmo com scrollbar-gutter: devolve a calha como padding.
    const calha = html.clientWidth - larguraAntes
    if (calha > 0) html.style.paddingRight = `${calha}px`
  }
  travas++
}

function soltarRolagem() {
  travas = Math.max(0, travas - 1)
  if (travas === 0) {
    document.documentElement.style.overflow = overflowAntes
    document.documentElement.style.paddingRight = paddingAntes
  }
}

function focaveisEm(raiz: HTMLElement) {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
    (el) => el.getClientRects().length > 0 || el === document.activeElement,
  )
}

/**
 * Armadilha de foco de toda sobreposição do sistema: painel, modal,
 * confirmação e paleta de busca usam esta, e só esta.
 *
 * - Tab e Shift+Tab circulam dentro do container.
 * - Escape chama `aoEscapar` (só a sobreposição do topo da pilha).
 * - Ao abrir, o foco vai para `[data-foco-inicial]`; se não houver, para o
 *   primeiro campo — mas só com ponteiro fino, porque no celular focar um campo
 *   sobe o teclado por cima do painel que acabou de abrir; lá o foco fica no
 *   próprio diálogo, que o leitor de tela anuncia.
 * - Ao fechar, o foco volta a quem abriu.
 *
 * `aoEscapar` vai por ref: quem passa `() => setX(null)` inline recriaria a
 * função a cada tecla, e o efeito, ao rodar de novo, devolvia o foco à origem
 * no meio da digitação.
 */
export function useArmadilhaDeFoco(
  ativo: boolean,
  ref: RefObject<HTMLElement>,
  aoEscapar: () => void,
) {
  const aoEscaparRef = useRef(aoEscapar)
  useEffect(() => {
    aoEscaparRef.current = aoEscapar
  })

  useEffect(() => {
    if (!ativo) return
    const id = proximoId++
    pilha.push(id)
    const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null
    travarRolagem()

    const onKey = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== id || e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        aoEscaparRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const raiz = ref.current
      if (!raiz) return
      const itens = focaveisEm(raiz)
      if (itens.length === 0) {
        e.preventDefault()
        raiz.focus()
        return
      }
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      const atual = document.activeElement
      if (!raiz.contains(atual)) {
        e.preventDefault()
        ;(e.shiftKey ? ultimo : primeiro).focus()
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault()
        primeiro.focus()
      } else if (e.shiftKey && (atual === primeiro || atual === raiz)) {
        e.preventDefault()
        ultimo.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    // Um tique depois da montagem: o portal precisa estar no documento.
    const t = window.setTimeout(() => {
      const raiz = ref.current
      if (!raiz || raiz.contains(document.activeElement)) return
      const marcado = raiz.querySelector<HTMLElement>('[data-foco-inicial]')
      // 8.3: o painel foca o título depois de 1 quadro (quem quer o campo
      // marca `data-foco-inicial`). Sem título marcado, o primeiro campo, só
      // com ponteiro fino.
      const titulo = raiz.querySelector<HTMLElement>('[data-foco-titulo]')
      const ponteiroFino = window.matchMedia('(pointer: fine)').matches
      const campo = ponteiroFino ? raiz.querySelector<HTMLElement>(CAMPOS) : null
      ;(marcado ?? titulo ?? campo ?? raiz).focus({ preventScroll: true })
    }, 20)

    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      const i = pilha.indexOf(id)
      if (i >= 0) pilha.splice(i, 1)
      soltarRolagem()
      if (origem?.isConnected) origem.focus({ preventScroll: true })
    }
  }, [ativo, ref])
}

/**
 * Estado do painel na URL (`?lancamento=<id>`): o link abre o mesmo painel,
 * recarregar a página não o perde e o botão de voltar do celular não cai numa
 * tela inesperada.
 *
 * Escreve com `replace`: abrir, trocar de item e fechar não empilham entradas
 * no histórico. Sem isso, dez parcelas conferidas eram dez toques em "voltar".
 */
export function useParamPainel(nome: string): [string | null, (valor: string) => void, () => void] {
  const [params, setParams] = useSearchParams()
  const valor = params.get(nome)

  const abrir = useCallback(
    (novo: string) => {
      setParams(
        (atual) => {
          const p = new URLSearchParams(atual)
          p.set(nome, novo)
          return p
        },
        { replace: true },
      )
    },
    [nome, setParams],
  )

  const fechar = useCallback(() => {
    setParams(
      (atual) => {
        if (!atual.has(nome)) return atual
        const p = new URLSearchParams(atual)
        p.delete(nome)
        return p
      },
      { replace: true },
    )
  }, [nome, setParams])

  return [valor, abrir, fechar]
}

/* 7.10: md 480 (detalhe, drill-down, parcela), lg 672 (formulários), xl 832 (relatório). */
const LARGURAS = {
  md: 'sm:max-w-[30rem]',
  lg: 'sm:max-w-[42rem]',
  xl: 'sm:max-w-[52rem]',
} as const

/* Painel e folha trocam de keyframe no mesmo corte (640) em que trocam de forma. */
const CONSULTA_SM = '(min-width: 640px)'
function assinarSm(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA_SM)
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}
function useAPartirDeSm() {
  return useSyncExternalStore(
    assinarSm,
    () => window.matchMedia(CONSULTA_SM).matches,
    () => true,
  )
}

export interface SidePanelProps {
  aberto: boolean
  aoFechar: () => void
  titulo: ReactNode
  subtitulo?: ReactNode
  /** No máximo 1 botão-ícone ao lado do Fechar (7.10). */
  acoes?: ReactNode
  /** Ações do painel; a principal mora aqui, à direita. */
  rodape?: ReactNode
  /** Resumo à esquerda do rodapé (`texto-meta` + `valor-destaque`). */
  resumo?: ReactNode
  largura?: 'md' | 'lg' | 'xl'
  /**
   * `lateral` (padrão): encosta à direita; tela cheia abaixo de 640.
   * `folha`: conteúdo curto (menu "Mais", confirmação de parcela); abaixo de
   * 640 sobe de baixo com o topo arredondado.
   */
  forma?: 'lateral' | 'folha'
  /** Drill-down aninhado: mostra "Voltar" (40) antes do título. */
  aoVoltar?: () => void
  /** Rótulo acessível do Voltar. Padrão "Voltar". */
  rotuloVoltar?: string
  /**
   * Profundidade do drill-down (0 = raiz). Quando muda, o corpo troca com
   * `avanca` (subiu) ou `recua` (desceu) em 200ms; o painel não fecha.
   */
  nivel?: number
  /** Troca de item no mesmo nível (ex.: outra parcela): entra com `avanca`. */
  chaveConteudo?: string | number
  children: ReactNode
}

/* Botão-ícone do cabeçalho: 40 no computador, 44 no toque (7.10). */
const BOTAO_CABECALHO =
  'flex size-10 shrink-0 items-center justify-center rounded-controle text-t2 transition-colors hover:bg-linha-hover hover:text-t1 active:bg-linha-press max-lg:size-11 [@media(pointer:coarse)]:size-11'

type Direcao = 'avanca' | 'recua'

export function SidePanel({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  acoes,
  rodape,
  resumo,
  largura = 'md',
  forma = 'lateral',
  aoVoltar,
  rotuloVoltar = 'Voltar',
  nivel = 0,
  chaveConteudo,
  children,
}: SidePanelProps) {
  const painelRef = useRef<HTMLDivElement>(null)
  const corpoRef = useRef<HTMLDivElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const uid = useId()
  const presenca = usePresenca(aberto, 180)
  const aPartirDeSm = useAPartirDeSm()
  useArmadilhaDeFoco(aberto, painelRef, aoFechar)

  /*
   * Drill-down (8.3): quando o nível ou a chave mudam, o corpo remonta com
   * `avanca` (entrou mais fundo ou trocou de item) ou `recua` (voltou). A
   * primeira exibição não anima: a entrada é a do painel.
   */
  const anterior = useRef<{ nivel: number; chave: string | number | undefined } | null>(null)
  const troca = useRef<{ n: number; direcao: Direcao }>({ n: 0, direcao: 'avanca' })
  if (!presenca.montado) {
    anterior.current = null
    troca.current = { n: 0, direcao: 'avanca' }
  } else if (anterior.current === null) {
    anterior.current = { nivel, chave: chaveConteudo }
  } else if (anterior.current.nivel !== nivel || anterior.current.chave !== chaveConteudo) {
    troca.current = {
      n: troca.current.n + 1,
      direcao: nivel < anterior.current.nivel ? 'recua' : 'avanca',
    }
    anterior.current = { nivel, chave: chaveConteudo }
  }
  const n = troca.current.n

  // Conteúdo novo começa do topo, e o foco não se perde com o item que saiu.
  useLayoutEffect(() => {
    if (n === 0) return
    corpoRef.current?.scrollTo({ top: 0 })
    const ativo = document.activeElement
    if (!ativo || ativo === document.body || !painelRef.current?.contains(ativo)) {
      tituloRef.current?.focus({ preventScroll: true })
    }
  }, [n])

  if (!presenca.montado) return null

  const animacaoCorpo: CSSProperties | undefined =
    n > 0 ? { animation: `${troca.current.direcao} var(--dur-pagina) var(--curva-entra) backwards` } : undefined

  const folha = forma === 'folha'

  return createPortal(
    <>
      <div
        aria-hidden
        data-estado={presenca.estado}
        className="veu fixed inset-0 z-veu bg-[color:var(--veu-painel)]"
        onClick={aoFechar}
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-t`}
        aria-describedby={subtitulo ? `${uid}-s` : undefined}
        tabIndex={-1}
        data-painel={largura}
        {...presenca.props}
        style={folha ? undefined : { paddingTop: 'env(safe-area-inset-top)' }}
        className={cn(
          aPartirDeSm ? 'painel' : 'folha',
          'fixed z-painel flex w-full flex-col bg-surface shadow-modal outline-none',
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:rounded-l-sobreposicao sm:border-l sm:border-fio-caixa',
          folha
            ? 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sobreposicao border-t border-fio-caixa sm:max-h-none sm:rounded-tr-none sm:border-t-0'
            : 'inset-0',
          LARGURAS[largura],
        )}
      >
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-fio-linha px-4 sm:px-6">
          {aoVoltar && (
            <button type="button" onClick={aoVoltar} aria-label={rotuloVoltar} className={BOTAO_CABECALHO}>
              <Icone icone={ArrowLeft} tamanho={16} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2
              ref={tituloRef}
              id={`${uid}-t`}
              tabIndex={-1}
              data-foco-titulo
              className="truncate font-heading text-titulo-painel text-t1 outline-none"
            >
              {titulo}
            </h2>
            {subtitulo && (
              <div id={`${uid}-s`} className="truncate text-texto-meta text-t-meta">
                {subtitulo}
              </div>
            )}
          </div>
          {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
          <button type="button" onClick={aoFechar} aria-label="Fechar painel" className={BOTAO_CABECALHO}>
            <Icone icone={X} tamanho={16} />
          </button>
        </header>

        <div
          ref={corpoRef}
          data-rolagem
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
          style={rodape ? undefined : { paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        >
          <div key={n} data-corpo-painel className="flex flex-col gap-8" style={animacaoCorpo}>
            {children}
          </div>
        </div>

        {rodape && (
          <footer
            data-rodape
            className="flex shrink-0 items-center gap-3 border-t border-fio-caixa px-4 pb-seguro pt-4 sm:px-6"
          >
            {resumo && <div className="flex min-w-0 flex-col">{resumo}</div>}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">{rodape}</div>
          </footer>
        )}
      </div>
    </>,
    document.body,
  )
}
