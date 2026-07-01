const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Formata um valor em Reais: R$ 1.234,56 */
export function formatCurrency(value: number): string {
  return BRL.format(value ?? 0)
}

/** Versão compacta para gráficos/cards: R$ 12,3 mil */
export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) < 1000) return BRL.format(value ?? 0)
  return BRL_COMPACT.format(value ?? 0)
}

/** Formata percentual: 23,5% */
export function formatPercent(value: number, digits = 1): string {
  if (!isFinite(value)) return '—'
  return `${(value * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

/** Formata data curta a partir de YYYY-MM-DD: 30 jun */
export function formatDateShort(dateStr: string): string {
  const d = parseDateOnly(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/** Formata data completa: 30/06/2026 */
export function formatDate(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString('pt-BR')
}

/** Nome do mês por extenso + ano: Junho 2026 */
export function formatMonthYear(date: Date): string {
  const s = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Rótulo curto de mês para gráficos: jun/26 */
export function formatMonthShort(date: Date): string {
  return date
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    .replace('. de ', '/')
    .replace('.', '')
}

/**
 * Interpreta 'YYYY-MM-DD' como data local (evita o shift de fuso do `new Date('YYYY-MM-DD')`,
 * que é tratado como UTC e pode "voltar" um dia).
 */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Converte Date para 'YYYY-MM-DD' local. */
export function toDateOnly(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Interpreta um valor digitado (pt-BR) em número. Ex.: "1.234,56" -> 1234.56 */
export function parseAmountInput(input: string): number {
  if (!input) return 0
  let s = input.replace(/[^\d.,]/g, '')
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = parseFloat(s)
  return isFinite(n) && n >= 0 ? n : 0
}
