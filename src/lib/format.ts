const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Formata um valor em Reais: R$ 1.234,56 */
export function formatCurrency(value: number): string {
  return BRL.format(value ?? 0)
}

/*
 * NÃO existe formatCurrencyCompact.
 *
 * "R$ 24,0 mil" é exatamente o que impede conferir um valor, e conferir é a
 * razão de existir deste sistema: a diferença de R$ 0,04 é o que trava um
 * cadastro. Cota não se arredonda. Quando um número não cabe, a saída é cortar
 * coluna, quebrar em duas tabelas ou rolar o container — nunca encolher o
 * dinheiro. A função foi apagada para que a regra não dependa de lembrança.
 */

/**
 * Parte o valor para que o 'R$' possa ser composto menor que os dígitos.
 *
 * O olho precisa pousar nos dígitos, não no símbolo — mas os CENTAVOS ficam
 * sempre no corpo cheio, em qualquer degrau. Dois tamanhos dentro do mesmo
 * número é maneirismo, e num sistema de conferência é um defeito.
 *
 * O sinal negativo é o MENOS de verdade (U+2212), não o hífen: o hífen tem
 * largura de hífen e desalinha a coluna.
 */
export function partesDoValor(value: number): {
  negativo: boolean
  prefixo: string
  digitos: string
} {
  const v = value ?? 0
  const negativo = v < 0
  // formata o módulo e devolve só os dígitos, sem o "R$" do Intl
  const bruto = BRL.format(Math.abs(v))
  const digitos = bruto.replace(/[^\d.,]/g, '')
  return { negativo, prefixo: 'R$', digitos }
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
