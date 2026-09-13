import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { IconeTom } from './IconeTom'

/**
 * Feedback pós-ação com Desfazer — o que permite ao lançamento rápido salvar
 * sem tela de confirmação: errou, desfez, sem medo.
 *
 * Só aparece DEPOIS que o banco respondeu (seção 1: proibido optimistic
 * update). A mensagem é específica ao que aconteceu, no particípio do botão que
 * a disparou: "Registrar pagamento" confirma "Pagamento registrado" (seção 11).
 */
export interface ToastOptions {
  message: string
  /** Linha secundária (ex.: contexto de orçamento da categoria). */
  detail?: string
  tone?: 'success' | 'error'
  /** Rótulo da ação (ex.: "Desfazer"). */
  actionLabel?: string
  onAction?: () => void | Promise<void>
  /** ms até sumir sozinho (padrão 5000). */
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
const DURACAO_ERRO = 8000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [acting, setActing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)

  const limparTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const agendarSaida = useCallback(
    (ms: number) => {
      limparTimer()
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
      agendarSaida(opts.duration ?? DURACAO_PADRAO)
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
        duration: DURACAO_ERRO,
      })
      agendarSaida(DURACAO_ERRO)
    }
  }

  /*
   * O tempo para enquanto o ponteiro ou o foco estão no aviso (WCAG 2.2.1).
   * Cinco segundos são pouco para quem chega ao "Desfazer" pelo teclado ou
   * está lendo o detalhe; ao sair, o aviso ganha o tempo inteiro de novo.
   */
  function retomar() {
    if (toast && !acting) agendarSaida(toast.duration ?? DURACAO_PADRAO)
  }
  function aoSairFoco(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) retomar()
  }

  const isError = toast?.tone === 'error'

  const cartao = toast && (
    <div
      key={toast.id}
      onMouseEnter={limparTimer}
      onMouseLeave={retomar}
      onFocus={limparTimer}
      onBlur={aoSairFoco}
      className={cn(
        'entrada pointer-events-auto flex w-full items-center gap-3 rounded-[14px] py-2.5 pl-3 pr-1.5 shadow-dropdown modal-surface',
        isError ? 'border-error-line' : 'border-line',
      )}
    >
      <IconeTom
        icone={isError ? AlertTriangle : CheckCircle2}
        tom={isError ? 'risco' : 'sucesso'}
        tamanho="sm"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium leading-snug text-t1">{toast.message}</p>
        {toast.detail && (
          <p className="mt-0.5 break-words text-xs leading-snug text-t3">{toast.detail}</p>
        )}
      </div>
      {toast.actionLabel && toast.onAction && (
        <Button
          variant="ghost"
          carregando={acting}
          onClick={handleAction}
          aria-label={`${toast.actionLabel}: ${toast.message}`}
          className="shrink-0 font-semibold text-brand-text hover:bg-brand-tint hover:text-brand-text"
        >
          {toast.actionLabel}
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Fechar aviso" className="shrink-0">
        <X aria-hidden strokeWidth={1.6} className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        /*
         * As duas regiões vivas ficam montadas o tempo todo, vazias quando não
         * há aviso. Leitor de tela só anuncia o que ENTRA numa região que já
         * existia; uma região criada junto com o texto costuma passar calada.
         * Sucesso é `status`/polite (espera a frase anterior terminar); erro é
         * `alert`/assertive, porque falha de Desfazer precisa interromper.
         *
         * No celular o aviso fica acima da BottomNav; no desktop, junto da borda.
         */
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center px-4 pb-safe lg:bottom-6">
          <div role="status" aria-live="polite" aria-atomic="true" className="w-full max-w-sm">
            {!isError && cartao}
          </div>
          <div role="alert" aria-live="assertive" aria-atomic="true" className="w-full max-w-sm">
            {isError && cartao}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
