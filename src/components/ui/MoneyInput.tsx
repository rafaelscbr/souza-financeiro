import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-xl border border-line bg-white px-3.5 text-content placeholder:text-content-faint ' +
  'transition-colors focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/30 ' +
  'disabled:opacity-50 tnum h-11'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

// ---------------------------------------------------------------------------
// Moeda (R$) — máscara baseada em centavos, formato brasileiro
// ---------------------------------------------------------------------------

interface CurrencyInputProps extends BaseProps {
  value: number | null
  onChange: (value: number | null) => void
}

function formatCents(value: number | null): string {
  if (value == null) return ''
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-content-faint">
        R$
      </span>
      <input
        {...props}
        inputMode="numeric"
        value={formatCents(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits === '' ? null : parseInt(digits, 10) / 100)
        }}
        placeholder="0,00"
        className={cn(fieldBase, 'pl-9', className)}
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

export function PercentInput({ value, onChange, className, ...props }: PercentInputProps) {
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
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d,]/g, '')
          setText(raw)
          onChange(raw === '' ? null : parseFloat(raw.replace(',', '.')) || 0)
        }}
        placeholder="0"
        className={cn(fieldBase, 'pr-8', className)}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-content-faint">
        %
      </span>
    </div>
  )
}
