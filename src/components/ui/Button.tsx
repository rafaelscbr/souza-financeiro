import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/*
 * A cor de ação é o OURO da marca, em gradiente, com tinta escura — o mesmo
 * botão "+ Novo" do CRM que a imobiliária já usa.
 *
 * O botão primário era branco sobre esmeralda: 2,54:1 no tema claro e 1,92:1
 * no escuro, em 33 lugares, inclusive o "Entrar". Era a pior reprovação de
 * contraste do app. Agora é tinta #0B1226 sobre ouro #E4B23C: 9,51:1 no
 * escuro e 8,62:1 no claro, com o mesmo par nos dois temas.
 *
 * Verde sai de "cor de clicável" e passa a significar uma coisa só: dinheiro
 * que se moveu.
 */
const variants: Record<Variant, string> = {
  primary: 'acao-ouro font-semibold shadow-[0_2px_12px_-4px_rgb(228_178_60/0.55)]',
  secondary: 'bg-surface-2 text-content border border-line hover:bg-surface-3',
  outline: 'border border-rule text-content hover:bg-surface-2',
  ghost: 'text-content-muted hover:bg-surface-2 hover:text-content',
  danger: 'border border-critical/40 bg-critical-field text-critical-ink hover:bg-critical/20',
}

/* Piso de toque de 44px em tudo tocável. O `sm` de 36px sobrevive apenas para
 * controles dentro de uma linha de lista já tocável por inteiro. */
const sizes: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3.5 text-sm',
  md: 'h-toque gap-2 rounded-xl px-4 text-base',
  lg: 'h-12 gap-2 rounded-xl px-6 text-base',
  icon: 'h-toque w-toque rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap font-medium',
          'transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
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
