import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * O PAINEL LATERAL — o padrão de edição e de detalhe (Souza OS, seções 1.10 e 8).
 *
 * Contexto acima de foco total: quem abre uma parcela continua vendo a lista
 * de onde ela saiu, à esquerda, sob um véu leve. O modal central fica só para
 * confirmação curta e destrutiva (ConfirmDialog).
 *
 * Três andares fixos: cabeçalho (título, subtítulo, ações, fechar), corpo que
 * rola sozinho e rodapé com as ações. O rodapé é fixo porque o botão que salva
 * não pode sumir atrás de um formulário comprido, principalmente no celular.
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

function travarRolagem() {
  if (travas === 0) {
    overflowAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  travas++
}

function soltarRolagem() {
  travas = Math.max(0, travas - 1)
  if (travas === 0) document.body.style.overflow = overflowAntes
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
      const ponteiroFino = window.matchMedia('(pointer: fine)').matches
      const campo = ponteiroFino ? raiz.querySelector<HTMLElement>(CAMPOS) : null
      ;(marcado ?? campo ?? raiz).focus({ preventScroll: true })
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

const LARGURAS = {
  md: 'sm:max-w-[34rem]',
  lg: 'sm:max-w-[42rem]',
  xl: 'sm:max-w-[52rem]',
} as const

export interface SidePanelProps {
  aberto: boolean
  aoFechar: () => void
  titulo: ReactNode
  subtitulo?: ReactNode
  /** Botões-ícone ao lado do fechar (editar, abrir a venda). */
  acoes?: ReactNode
  /** Rodapé fixo com as ações do painel. A ação principal mora aqui. */
  rodape?: ReactNode
  largura?: 'md' | 'lg' | 'xl'
  children: ReactNode
}

export function SidePanel({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  acoes,
  rodape,
  largura = 'md',
  children,
}: SidePanelProps) {
  const painelRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  useArmadilhaDeFoco(aberto, painelRef, aoFechar)

  if (!aberto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Véu leve: a tela de trás continua legível, é contexto e não ruído. */}
      <div aria-hidden className="overlay-entra absolute inset-0 bg-black/25" onClick={aoFechar} />

      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-t`}
        aria-describedby={subtitulo ? `${uid}-s` : undefined}
        tabIndex={-1}
        className={cn(
          // Tela cheia no celular; do `sm` em diante encosta à direita com o
          // raio de 20px só do lado de dentro. `painel-entra` desliza da direita
          // e, abaixo de 640px, sobe — o mesmo corte de breakpoint daqui.
          'painel-entra modal-surface relative flex h-full w-full flex-col overflow-hidden shadow-modal outline-none',
          'border-0 sm:rounded-l-[20px] sm:border sm:border-r-0',
          LARGURAS[largura],
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 pb-3.5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4">
          <div className="min-w-0 flex-1 pt-1.5">
            <h2
              id={`${uid}-t`}
              className="font-heading text-base font-bold leading-snug tracking-[-0.015em] text-t1"
            >
              {titulo}
            </h2>
            {subtitulo && (
              <div id={`${uid}-s`} className="mt-0.5 text-[13px] leading-snug text-t3">
                {subtitulo}
              </div>
            )}
          </div>
          {acoes && <div className="flex shrink-0 items-center gap-1.5">{acoes}</div>}
          {/* 40px: o piso de toque da seção 12, mesmo sendo só um X. */}
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar painel"
            className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-t3 transition-colors duration-150 hover:bg-s3/60 hover:text-t1"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
          </button>
        </header>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 sm:px-6',
            rodape ? 'pb-5' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </div>

        {rodape && (
          <footer className="shrink-0 border-t border-line px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
            {rodape}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
