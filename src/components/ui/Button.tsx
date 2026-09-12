import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/*
 * A cor de ação é o navy da marca.
 *
 * O botão primário era branco sobre esmeralda: 2,54:1 no tema claro e 1,92:1
 * no escuro, em 33 lugares — inclusive o "Entrar", que é a primeira coisa que
 * qualquer pessoa vê. Era a pior reprovação de contraste do app.
 *
 * Agora é preenchimento navy com tinta branca: 17,71:1 no claro. No escuro o
 * navy é invisível contra o próprio papel (1,07:1), então o par inverte —
 * campo claro, tinta navy, 12,87:1.
 *
 * E o verde sai de "cor de clicável". Verde passa a significar uma coisa só:
 * dinheiro que se moveu. Três cores disputavam o papel de ação (esmeralda,
 * um blue-600 de estoque do Tailwind e um azul de marca que não existia na
 * marca); agora é uma.
 */
const variants: Record<Variant, string> = {
  primary: 'bg-action text-action-ink font-semibold hover:bg-action-hover',
  secondary: 'bg-surface text-content border border-line hover:bg-surface-2',
  outline: 'border border-rule text-content hover:bg-surface-2',
  ghost: 'text-content-muted hover:bg-surface-2 hover:text-content',
  danger: 'border border-critical/40 bg-critical-field text-critical-ink hover:bg-critical/15',
}

/* Piso de toque de 44px em tudo tocável. O `sm` de 36px sobrevive apenas para
 * controles dentro de uma linha de lista já tocável por inteiro. */
const sizes: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-toque gap-2 rounded-lg px-4 text-base',
  lg: 'h-12 gap-2 rounded-lg px-6 text-base',
  icon: 'h-toque w-toque rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap font-medium',
          'transition-colors disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
