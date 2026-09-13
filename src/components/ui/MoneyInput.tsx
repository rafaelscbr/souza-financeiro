import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { classeCampo, useCampo } from './Field'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

// ---------------------------------------------------------------------------
// Moeda (R$) — máscara baseada em centavos, formato brasileiro
// ---------------------------------------------------------------------------

/*
 * Seção 1: "Input de dinheiro guarda só dígitos, exibe formatado com prefixo
 * R$. Nunca type=\"number\" cru para dinheiro."
 *
 * O que se digita vira só dígitos e os dois últimos são os centavos: "123456"
 * é R$ 1.234,56. Não há vírgula para errar, não há ponto que o navegador lê
 * como decimal em inglês, e o valor nunca é arredondado para parecer redondo.
 * `type="number"` aceitaria "1e5", mudaria o valor com a roda do mouse e
 * mostraria "1234.56".
 */
interface CurrencyInputProps extends BaseProps {
  value: number | null
  onChange: (value: number | null) => void
}

function formatCents(value: number | null): string {
  if (value == null) return ''
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CurrencyInput({
  value,
  onChange,
  className,
  placeholder = '0,00',
  ...props
}: CurrencyInputProps) {
  const { invalido, aria } = useCampo(props)
  return (
    <div className="relative">
      {/*
       * O prefixo é desenho sobre a caixa, não parte do valor: o estado é número
       * e a exibição é pt-BR. Em --t4, o menor texto que ainda é informação.
       */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-t4"
      >
        R$
      </span>
      <input
        {...props}
        {...aria}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatCents(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits === '' ? null : parseInt(digits, 10) / 100)
        }}
        placeholder={placeholder}
        className={cn(classeCampo(invalido), 'pl-10 tabular-nums', className)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Percentual (%) — aceita vírgula decimal
// ---------------------------------------------------------------------------

interface PercentInputProps extends BaseProps {
  value: number | null
  onChange: (value: number | null) => void
}

export function PercentInput({
  value,
  onChange,
  className,
  placeholder = '0',
  ...props
}: PercentInputProps) {
  const { invalido, aria } = useCampo(props)
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))

  // sincroniza quando o valor externo muda (ex.: reset do formulário)
  useEffect(() => {
    const external = value == null ? '' : String(value).replace('.', ',')
    const parsed = text === '' ? null : parseFloat(text.replace(',', '.'))
    if (parsed !== value) setText(external)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative">
      <input
        {...props}
        {...aria}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d,]/g, '')
          setText(raw)
          onChange(raw === '' ? null : parseFloat(raw.replace(',', '.')) || 0)
        }}
        placeholder={placeholder}
        className={cn(classeCampo(invalido), 'pr-8 tabular-nums', className)}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-t4"
      >
        %
      </span>
    </div>
  )
}
