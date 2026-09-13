import {
  createContext,
  forwardRef,
  useContext,
  type AriaAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Souza OS, seção 8: Input / Select / Textarea.
 *
 * Label sempre visível e placeholder nunca é rótulo: o placeholder some na
 * primeira tecla, e quem volta ao campo para conferir não sabe mais o que ele
 * pedia. Por isso não existe campo sem <Label> neste arquivo.
 */

/* ------------------------------------------------------------------------- */
/* Ligação entre o FormField e o campo                                        */
/* ------------------------------------------------------------------------- */

/*
 * O FormField sabe se há erro, dica ou obrigatoriedade; o campo é quem precisa
 * dizer isso ao leitor de tela (aria-invalid, aria-describedby, aria-required)
 * e pintar a borda de erro. Contexto em vez de cloneElement: o filho pode ser
 * um CurrencyInput, um Select dentro de um wrapper, qualquer coisa. O campo só
 * aceita a ligação se o `id` dele for o `htmlFor` do FormField, para um campo
 * aninhado por engano não herdar o erro do vizinho.
 */
interface CampoContexto {
  htmlFor: string
  idDescricao?: string
  invalido: boolean
  obrigatorio: boolean
}

const CampoContext = createContext<CampoContexto | null>(null)

interface PropsLigaveis {
  id?: string
  'aria-invalid'?: AriaAttributes['aria-invalid']
  'aria-describedby'?: string
  'aria-required'?: AriaAttributes['aria-required']
}

/**
 * Lê a ligação com o FormField em volta. Devolve se o campo está inválido e os
 * atributos aria a espalhar DEPOIS das props do chamador (eles já as incluem).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useCampo(props: PropsLigaveis) {
  const ctx = useContext(CampoContext)
  const doCampo = ctx && props.id != null && props.id === ctx.htmlFor ? ctx : null

  const invalido =
    props['aria-invalid'] === true || props['aria-invalid'] === 'true' || !!doCampo?.invalido
  const descritoPor =
    [props['aria-describedby'], doCampo?.idDescricao].filter(Boolean).join(' ') || undefined

  return {
    invalido,
    aria: {
      'aria-invalid': invalido || undefined,
      'aria-describedby': descritoPor,
      /*
       * aria-required, e não `required`: o nativo liga a validação do navegador
       * e bloquearia o envio do <form> do login com um balão que o app não
       * escreveu. Obrigatoriedade é regra da tela, que já mostra o erro dela.
       */
      'aria-required': props['aria-required'] ?? (doCampo?.obrigatorio || undefined),
    },
  }
}

/**
 * A caixa de digitar, igual para Input, Select, Textarea e MoneyInput.
 *
 * `text-base sm:text-sm`: o guia pede 14px, e é 14px a partir de 640px. Abaixo
 * disso fica 16px porque o Safari do iPhone dá zoom na página inteira ao focar
 * um campo com letra menor que 16px, e o corretor lança do celular.
 *
 * O foco é a borda Areia + halo de 25%, e por isso o contorno global de
 * `*:focus-visible` sai daqui: a borda `--brand` já passa de 3:1 contra a
 * superfície nos dois temas, e contorno por cima de borda por cima de halo
 * seriam três sinais para uma coisa só.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function classeCampo(invalido: boolean) {
  return cn(
    'block w-full min-h-[42px] rounded-lg border bg-surface px-3 py-2.5 text-base text-t1 sm:text-sm',
    'placeholder:text-t4 transition-[border-color,box-shadow] duration-150',
    'focus:outline-none focus:ring-2 focus-visible:outline-none',
    invalido
      ? 'border-error-line focus:border-error focus:ring-error/20'
      : 'border-line-input hover:border-line-strong focus:border-brand focus:ring-brand/25',
    'disabled:cursor-not-allowed disabled:opacity-40',
  )
}

/* ------------------------------------------------------------------------- */
/* Rótulo                                                                     */
/* ------------------------------------------------------------------------- */

/*
 * 12px em --t2: pequeno, mas no papel "corpo", porque é o que diz o que o campo
 * pede. O `*` vermelho é só para quem vê; quem ouve recebe aria-required do
 * próprio campo.
 */
export function Label({
  className,
  children,
  required,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('mb-1.5 block text-xs font-medium text-t2', className)} {...props}>
      {children}
      {required && (
        <span aria-hidden className="ml-0.5 text-error">
          *
        </span>
      )}
    </label>
  )
}

/* ------------------------------------------------------------------------- */
/* Campos                                                                     */
/* ------------------------------------------------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const { invalido, aria } = useCampo(props)
    return <input ref={ref} {...props} {...aria} className={cn(classeCampo(invalido), className)} />
  },
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    const { invalido, aria } = useCampo(props)
    return (
      <textarea
        ref={ref}
        {...props}
        {...aria}
        className={cn(classeCampo(invalido), 'min-h-[88px] resize-y leading-relaxed', className)}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

/*
 * Select NATIVO (seção 8). No celular ele abre a roda do sistema, que é a
 * melhor lista de escolha que existe num polegar, e o teclado e o leitor de
 * tela já sabem usá-lo. A seta é desenho: o `appearance-none` tira a do
 * navegador, que muda de cara em cada sistema.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    const { invalido, aria } = useCampo(props)
    return (
      <div className="relative">
        <select
          ref={ref}
          {...props}
          {...aria}
          className={cn(classeCampo(invalido), 'appearance-none pr-9', className)}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          strokeWidth={1.6}
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t4"
        />
      </div>
    )
  },
)
Select.displayName = 'Select'

/* ------------------------------------------------------------------------- */
/* Agrupador                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Label + campo + dica ou erro. O erro substitui a dica (os dois juntos seriam
 * duas frases disputando o mesmo lugar) e vem com `role="alert"`, ícone e
 * palavra: cor sozinha nunca comunica status.
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  /** Marca o `*` vermelho no rótulo e `aria-required` no campo. */
  required?: boolean
  className?: string
  children: ReactNode
}) {
  const idErro = `${htmlFor}-erro`
  const idDica = `${htmlFor}-dica`
  const idDescricao = error ? idErro : hint ? idDica : undefined

  return (
    <CampoContext.Provider
      value={{ htmlFor, idDescricao, invalido: !!error, obrigatorio: !!required }}
    >
      <div className={className}>
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
        {children}
        {hint && !error && (
          <p id={idDica} className="mt-1.5 text-xs text-t4">
            {hint}
          </p>
        )}
        {error && (
          <p id={idErro} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-error">
            <AlertCircle aria-hidden strokeWidth={1.6} className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </CampoContext.Provider>
  )
}
