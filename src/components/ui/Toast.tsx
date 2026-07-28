import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Feedback pós-ação com Desfazer — o que permite ao lançamento rápido salvar
 * sem tela de confirmação: errou, desfez, sem medo. Antes deste componente o
 * único "sucesso" do app era o modal fechar.
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [acting, setActing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setToast(null)
    setActing(false)
  }, [])

  const showToast = useCallback(
    (opts: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current)
      idRef.current += 1
      setActing(false)
      setToast({ id: idRef.current, tone: 'success', ...opts })
      timer.current = setTimeout(() => setToast(null), opts.duration ?? 5000)
    },
    [],
  )

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function handleAction() {
    if (!toast?.onAction || acting) return
    setActing(true)
    try {
      await toast.onAction()
      dismiss()
    } catch (err) {
      // Falhou o Desfazer (rede caiu, por ex.): o lançamento CONTINUA lá.
      // Fechar em silêncio faria você acreditar que desfez.
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      idRef.current += 1
      setActing(false)
      setToast({
        id: idRef.current,
        tone: 'error',
        message: 'Não foi possível desfazer — o lançamento continua salvo.',
        detail: err instanceof Error ? err.message : undefined,
        duration: 8000,
      })
      timer.current = setTimeout(() => setToast(null), 8000)
    }
  }

  const isError = toast?.tone === 'error'

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 pb-safe lg:bottom-6"
            // `alert`/assertive no erro: falha de Desfazer precisa interromper
            // o leitor de tela, não esperar ele terminar a frase anterior.
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
          >
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 shadow-pop animate-slide-up',
                isError
                  ? 'border-expense/30 bg-surface text-content'
                  : 'border-line bg-surface text-content',
              )}
            >
              {isError ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-expense" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-income" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{toast.message}</p>
                {toast.detail && (
                  <p className="truncate text-xs text-content-muted">{toast.detail}</p>
                )}
              </div>
              {toast.actionLabel && toast.onAction && (
                <button
                  onClick={handleAction}
                  disabled={acting}
                  aria-label={`${toast.actionLabel}: ${toast.message}`}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-emerald transition-colors hover:bg-emerald-soft focus-visible:ring-2 focus-visible:ring-emerald disabled:opacity-50"
                >
                  {acting ? '…' : toast.actionLabel}
                </button>
              )}
              <button
                onClick={dismiss}
                aria-label="Fechar aviso"
                className="shrink-0 rounded-lg p-1.5 text-content-faint transition-colors hover:bg-surface-2 hover:text-content"
              >
                <X className="h-4 w-4" />
              </button>
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
