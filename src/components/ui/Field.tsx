import { CircleAlert } from 'lucide-react'
import { Icone } from './Icone'
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
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Campo (docs/souza-os-fundamentos.md, 7.9; tipo 6.1 `.campo`).
 *
 * 44px para todo controle. Borda fio-controle (≥3:1); hover sobe para t3;
 * foco borda brand + anel de 3px a 25%; erro borda `error`. Rótulo ↔ campo 8,
 * campo ↔ dica 8, e o erro ocupa o lugar da dica (o layout não pula).
 *
 * ATENÇÃO: tamanho de letra (`campo`, `text-texto-meta`, `text-nota`) fica
 * FORA do cn(): o tailwind-merge sem configuração lê `text-nota` como cor.
 */

/* ------------------------------------------------------------------------- */
/* Ligação entre o FormField e o campo                                        */
/* ------------------------------------------------------------------------- */

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
      /* aria-required, e não `required`: o nativo abriria o balão do navegador. */
      'aria-required': props['aria-required'] ?? (doCampo?.obrigatorio || undefined),
    },
  }
}

/**
 * A caixa de digitar, igual para Input, Select, Textarea e MoneyInput (7.9).
 * `campo` (6.1) dá 16/24 no toque e 14/20 com ponteiro fino ≥1024.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function classeCampo(invalido: boolean) {
  return cn(
    'campo block h-11 w-full rounded-controle border bg-surface px-3 text-t1',
    'placeholder:text-t-meta transition-colors duration-micro ease-cor',
    'focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/25 focus-visible:outline-none',
    invalido ? 'border-error' : 'border-fio-controle hover:border-t3',
    'aria-[invalid=true]:border-error',
    'disabled:cursor-not-allowed disabled:opacity-40',
  )
}

/* ------------------------------------------------------------------------- */
/* Rótulo                                                                     */
/* ------------------------------------------------------------------------- */

/** `texto-meta` 500 em t2; o `*` em error-ink é só visual (o campo leva aria-required). */
export function Label({
  className,
  children,
  required,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={`text-texto-meta ${cn('block font-medium text-t2', className)}`} {...props}>
      {children}
      {required && (
        <span aria-hidden className="text-error-ink">
          {' *'}
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
    /*
     * Data: indicador nativo (sem ícone extra) e `color-scheme` do tema, que o
     * html já declara. No iOS o input de data ignora `height`.
     */
    const data = props.type === 'date' || props.type === 'month' || props.type === 'datetime-local'
    return (
      <input
        ref={ref}
        {...props}
        {...aria}
        className={cn(classeCampo(invalido), data && 'flex min-h-11 appearance-none items-center', className)}
      />
    )
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
        className={cn(classeCampo(invalido), 'h-auto min-h-24 resize-y py-3', className)}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

/*
 * Select NATIVO: no celular abre a roda do sistema. A seta é desenho; fica
 * num trilho `inset-y-0` com `pr-3`, sem deslocamento solto (3.6).
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
          className={cn(classeCampo(invalido), 'appearance-none pr-10', className)}
        >
          {children}
        </select>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-t-meta">
          <ChevronDown size={16} strokeWidth={1.6} />
        </span>
      </div>
    )
  },
)
Select.displayName = 'Select'

/* ------------------------------------------------------------------------- */
/* Agrupador                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Rótulo + campo + dica ou erro, em coluna com `gap-2`. O erro substitui a dica
 * no mesmo slot, com `role="alert"`.
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
  /** Marca o `*` no rótulo e `aria-required` no campo. */
  required?: boolean
  className?: string
  children: ReactNode
}) {
  const idErro = `${htmlFor}-erro`
  const idDica = `${htmlFor}-dica`
  const idDescricao = error ? idErro : hint ? idDica : undefined

  return (
    <CampoContext.Provider value={{ htmlFor, idDescricao, invalido: !!error, obrigatorio: !!required }}>
      <div className={cn('flex flex-col gap-2', className)}>
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
        {children}
        {error ? (
          <p id={idErro} role="alert" className="flex items-start gap-1 font-medium text-error-ink text-nota">
            {/* Cor de estado nunca sozinha (5.1): o ícone anda com o texto. */}
            <span className="flex h-4 shrink-0 items-center">
              <Icone icone={CircleAlert} tamanho={12} />
            </span>
            <span>{error}</span>
          </p>
        ) : hint ? (
          <p id={idDica} className="text-nota text-t-meta">
            {hint}
          </p>
        ) : null}
      </div>
    </CampoContext.Provider>
  )
}
