import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-content-muted', className)}
      {...props}
    />
  )
}

/*
 * A borda do campo é o fio ESTRUTURAL (3,54:1 no claro, 3,74:1 no escuro), não
 * o fio decorativo. O preenchimento do campo difere do papel por apenas
 * 1,09:1 — sozinho ele não delimita nada, e a WCAG 1.4.11 pede 3:1 para o
 * contorno de um componente. Com `border-line` (1,24:1) a caixa de digitar
 * simplesmente não tinha limite visível no tema claro.
 *
 * Altura 44px (piso de toque) e raio de 10px, que é 24% de 44 — a mesma
 * proporção da moldura da marca.
 */
const fieldBase =
  'w-full rounded-lg border border-rule bg-surface-2 px-3.5 text-content placeholder:text-content-faint ' +
  'transition-colors focus:border-content focus:outline-none focus:ring-2 focus:ring-content focus:ring-offset-2 focus:ring-offset-papel ' +
  'disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-toque', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, 'min-h-[80px] py-2.5', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(fieldBase, 'h-toque appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  ),
)
Select.displayName = 'Select'

/** Agrupa label + campo + mensagem de erro, com acessibilidade. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-content-faint">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-expense" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
