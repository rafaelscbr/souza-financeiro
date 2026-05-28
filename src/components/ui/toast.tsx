import * as React from 'react'
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  toasts: ToastMessage[]
  toast: (opts: Omit<ToastMessage, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  const toast = React.useCallback((opts: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...opts, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

// Convenience hooks
export function useToastActions() {
  const { toast } = useToast()
  return {
    success: (title: string, description?: string) => toast({ type: 'success', title, description }),
    error: (title: string, description?: string) => toast({ type: 'error', title, description }),
    warning: (title: string, description?: string) => toast({ type: 'warning', title, description }),
    info: (title: string, description?: string) => toast({ type: 'info', title, description }),
  }
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />,
  error: <XCircle className="h-5 w-5 text-red-500 shrink-0" />,
  warning: <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
}

const toastBg: Record<ToastType, string> = {
  success: 'border-green-200 dark:border-green-800',
  error: 'border-red-200 dark:border-red-800',
  warning: 'border-amber-200 dark:border-amber-800',
  info: 'border-blue-200 dark:border-blue-800',
}

function ToastContainer({ toasts, dismiss }: { toasts: ToastMessage[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 md:bottom-4 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-xl border bg-card p-4 shadow-lg pointer-events-auto animate-in slide-in-from-right-full',
            toastBg[t.type]
          )}
        >
          {icons[t.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
