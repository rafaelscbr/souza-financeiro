import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { classeCampo, useCampo } from './Field'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

/*
 * Campo de dinheiro (docs/souza-os-fundamentos.md, 7.9): "R$" em t-meta à
 * esquerda, número tabular (`num`) alinhado à direita, 44px.
 *
 * Guarda só dígitos: os dois últimos são os centavos ("123456" é R$ 1.234,56).
 * Nunca `type="number"` (aceitaria "1e5" e mudaria com a roda do mouse).
 */

// ---------------------------------------------------------------------------
// Moeda (R$)
// ---------------------------------------------------------------------------

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
      {/* O prefixo é desenho sobre a caixa, não parte do valor. */}
      <span
        aria-hidden
        className="campo pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-t-meta"
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
        className={cn(classeCampo(invalido), 'num pl-10 text-right', className)}
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
        className={cn(classeCampo(invalido), 'num pr-8 text-right', className)}
      />
      <span
        aria-hidden
        className="campo pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-t-meta"
      >
        %
      </span>
    </div>
  )
}
