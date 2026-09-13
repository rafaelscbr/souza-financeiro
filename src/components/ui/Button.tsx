import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /**
   * O banco ainda não respondeu. Desabilita, anuncia `aria-busy` e põe o giro
   * ANTES do rótulo, que continua visível: quem clicou em "Salvar lançamento"
   * continua lendo o que pediu enquanto espera.
   */
  carregando?: boolean
}

/*
 * Souza OS, seção 8.
 *
 * `primary` é o Areia chapado da marca (sem degradê nem halo, ajuste de 12/09) com a tinta marinho (--grad-brand-text),
 * o mesmo "+ Novo" do iCRM, em Sora bold. No hover o degradê sobe para
 * --brand-fill-hover, que é mais claro no escuro e mais fundo no claro: cada
 * tema tem o próprio valor, então o hover lê o token em vez de um brilho fixo.
 *
 * `danger` e `success` são o tom inteiro (fundo -bg, texto e borda do tom), não
 * um botão chapado de vermelho ou verde: cor é significado, e o significado já
 * está na palavra do botão. `outline` é sinônimo de `secondary`, mantido para as
 * telas que já o usam.
 */
const variants: Record<ButtonVariant, string> = {
  primary:
    'grad-brand font-heading font-bold ' +
    'hover:bg-[image:linear-gradient(158deg,var(--brand-fill-hover)_0%,var(--brand-fill)_62%)]',
  secondary: 'border border-line bg-surface text-t2 hover:border-line-strong hover:bg-s2 hover:text-t1',
  outline: 'border border-line bg-surface text-t2 hover:border-line-strong hover:bg-s2 hover:text-t1',
  ghost: 'text-t3 hover:bg-s3/50 hover:text-t1',
  danger: 'border border-error-line bg-error-bg text-error hover:border-error/60',
  success: 'border border-success-line bg-success-bg text-success hover:border-success/60',
}

/*
 * sm 36px, md 40px, lg 44px, icon 40px (seção 8). O alvo de toque mínimo da
 * seção 12 é 40px; o `sm` sobrevive para controle dentro de uma linha que já é
 * tocável por inteiro. A ação principal de uma tela de celular vai de `lg`.
 * Sora 13px é o CTA do cabeçalho (seção 6).
 */
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-[13px]',
  lg: 'h-11 gap-2 px-5 text-sm',
  icon: 'h-10 w-10 shrink-0 p-0',
}

/*
 * `type="button"` POR PADRÃO. O padrão do HTML é "submit": um "Cancelar" posto
 * dentro de um <form> enviava o formulário. Agora enviar é sempre uma escolha
 * escrita (`type="submit"`), nunca um acidente de onde o botão caiu.
 *
 * Foco: o anel `ring-brand/40` do guia, somado ao contorno global de
 * `*:focus-visible` (seção 12). Juntos dão uma faixa de ouro de 4px que aparece
 * até sobre o próprio botão dourado no tema claro, onde o anel sozinho some.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      type = 'button',
      carregando = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || carregando}
        aria-busy={carregando || undefined}
        className={cn(
          'relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium',
          'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-[0.98]',
          'disabled:pointer-events-none disabled:opacity-40',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {carregando && size === 'icon' ? (
          <Spinner decorativo />
        ) : (
          <>
            {carregando && <Spinner decorativo />}
            {children}
          </>
        )}
      </button>
    )
  },
)
Button.displayName = 'Button'
