import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Carregando"
    />
  )
}

export function FullPageLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-content-muted">
      <Spinner className="h-7 w-7 text-emerald" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
