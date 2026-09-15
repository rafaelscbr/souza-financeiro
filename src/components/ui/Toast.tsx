import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePresenca } from '@/lib/usePresenca'
import { Button } from './Button'
import { Icone } from './Icone'

/**
 * TOAST (7.12) — feedback depois que o banco respondeu, com "Desfazer".
 *
 * Só aparece DEPOIS da resposta do banco (nada de atualização otimista). A
 * mensagem é específica ao que aconteceu: "Recebimento registrado · R$ …".
 *
 * Tempo: 5s; 8s com ação; erro não some sozinho. Pausa em hover e em foco.
 * Entra com `toastEntra` 240ms e sai com `esmaeceSai` 180ms (`usePresenca`).
 * Sem `data-caixa` (7.11).
 */
export interface ToastOptions {
  message: string
  /** Linha secundária (ex.: contexto de orçamento da categoria). */
  detail?: string
  tone?: 'success' | 'error'
  /** Rótulo da ação (ex.: "Desfazer"). */
  actionLabel?: string
  onAction?: () => void | Promise<void>
  /** ms até sumir sozinho (padrão 5000; 8000 com ação). Ignorado em erro. */
  duration?: number
}

interface ToastState extends ToastOptions {
  id: number
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURACAO_PADRAO = 5000
const DURACAO_COM_ACAO = 8000

/** Quanto o aviso fica; `null` = não some sozinho (erro). */
function duracaoDe(t: ToastOptions): number | null {
  if (t.tone === 'error') return null
  if (t.duration != null) return t.duration
  return t.actionLabel && t.onAction ? DURACAO_COM_ACAO : DURACAO_PADRAO
}

const ENTRADA: CSSProperties = { animation: 'toastEntra var(--dur-lista) var(--curva-entra) backwards' }
const SAIDA: CSSProperties = { animation: 'esmaeceSai var(--dur-saida) linear both' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [acting, setActing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)
  /* O último aviso continua desenhado enquanto sai. */
  const ultimo = useRef<ToastState | null>(null)
  if (toast) ultimo.current = toast
  const presenca = usePresenca(toast !== null, 180)

  const limparTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const agendarSaida = useCallback(
    (ms: number | null) => {
      limparTimer()
      if (ms == null) return
      timer.current = setTimeout(() => setToast(null), ms)
    },
    [limparTimer],
  )

  const dismiss = useCallback(() => {
    limparTimer()
    setToast(null)
    setActing(false)
  }, [limparTimer])

  const showToast = useCallback(
    (opts: ToastOptions) => {
      idRef.current += 1
      setActing(false)
      setToast({ id: idRef.current, tone: 'success', ...opts })
      agendarSaida(duracaoDe({ tone: 'success', ...opts }))
    },
    [agendarSaida],
  )

  useEffect(() => limparTimer, [limparTimer])

  async function handleAction() {
    if (!toast?.onAction || acting) return
    // O aviso não pode sumir no meio do Desfazer: quem clicou precisa ver o fim.
    limparTimer()
    setActing(true)
    try {
      await toast.onAction()
      dismiss()
    } catch (err) {
      // Falhou o Desfazer (rede caiu, por ex.): o lançamento CONTINUA lá.
      // Fechar em silêncio faria você acreditar que desfez.
      idRef.current += 1
      setActing(false)
      setToast({
        id: idRef.current,
        tone: 'error',
        message: 'Não foi possível desfazer: o lançamento continua salvo.',
        detail: err instanceof Error ? err.message : undefined,
      })
    }
  }

  /*
   * O tempo para enquanto o ponteiro ou o foco estão no aviso (WCAG 2.2.1);
   * ao sair, o aviso ganha o tempo inteiro de novo.
   */
  function retomar() {
    if (toast && !acting) agendarSaida(duracaoDe(toast))
  }
  function aoSairFoco(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) retomar()
  }

  const visto = toast ?? ultimo.current
  const isError = visto?.tone === 'error'

  const cartao = presenca.montado && visto && (
    <div
      key={visto.id}
      {...presenca.props}
      onMouseEnter={limparTimer}
      onMouseLeave={retomar}
      onFocus={limparTimer}
      onBlur={aoSairFoco}
      style={presenca.estado === 'saindo' ? SAIDA : ENTRADA}
      data-toast
      className="pointer-events-auto grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 rounded-caixa border border-fio-caixa bg-surface p-4 shadow-dropdown"
    >
      {/* Ícone de 16 no meio da primeira linha de 20px. */}
      <span className="flex h-5 items-center">
        <Icone
          icone={isError ? CircleAlert : CircleCheck}
          tamanho={16}
          className={isError ? 'text-error' : 'text-success'}
        />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="break-words text-texto text-t1">{visto.message}</p>
        {visto.detail && <p className="break-words text-texto-meta text-t-meta">{visto.detail}</p>}
      </div>
      <div className="flex items-center gap-2">
        {visto.actionLabel && visto.onAction && (
          <Button
            variant="fantasma"
            size="sm"
            carregando={acting}
            onClick={handleAction}
            aria-label={`${visto.actionLabel}: ${visto.message}`}
          >
            {visto.actionLabel}
          </Button>
        )}
        <Button variant="fantasma" size="icone" onClick={dismiss} aria-label="Fechar aviso">
          <Icone icone={X} tamanho={16} />
        </Button>
      </div>
    </div>
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        /*
         * As duas regiões vivas ficam montadas o tempo todo, vazias quando não
         * há aviso: leitor de tela só anuncia o que ENTRA numa região que já
         * existia. Sucesso é `status`/polite; erro é `alert`/assertive.
         *
         * Celular: centrado, 16px de cada lado, 24px acima da barra inferior.
         * Computador: canto inferior direito, a 24px das bordas.
         */
        <div
          data-toasts
          className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center pb-barra-inferior lg:items-end lg:p-6"
        >
          <div role="status" aria-live="polite" aria-atomic="true" className={cn(LARGURA, isError && 'hidden')}>
            {!isError && cartao}
          </div>
          <div role="alert" aria-live="assertive" aria-atomic="true" className={cn(LARGURA, !isError && 'hidden')}>
            {isError && cartao}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

const LARGURA = 'w-[min(24rem,calc(100%_-_32px))]'

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
