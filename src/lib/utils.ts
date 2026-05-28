import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Class merge utility ──────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency formatting ──────────────────────────────────────
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)}K`
  }
  return formatCurrency(value)
}

// ── Percent formatting ───────────────────────────────────────
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '0%'
  return `${value.toFixed(decimals).replace('.', ',')}%`
}

// ── Date formatting ──────────────────────────────────────────
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '-'
    return format(d, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '-'
  }
}

export function formatDateMonth(date: string | Date | null | undefined): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '-'
    return format(d, 'MMM/yy', { locale: ptBR })
  } catch {
    return '-'
  }
}

export function formatDatetime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '-'
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return '-'
  }
}

// ── Number formatting ────────────────────────────────────────
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  return new Intl.NumberFormat('pt-BR').format(value)
}

// ── Status colors ────────────────────────────────────────────
export type StatusColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'

export const saleStatusConfig: Record<string, { label: string; color: StatusColor }> = {
  contracted: { label: 'Contratado', color: 'blue' },
  completed: { label: 'Concluído', color: 'green' },
  cancelled: { label: 'Cancelado', color: 'red' },
}

export const developmentStatusConfig: Record<string, { label: string; color: StatusColor }> = {
  active: { label: 'Ativo', color: 'green' },
  delivered: { label: 'Entregue', color: 'blue' },
  cancelled: { label: 'Cancelado', color: 'red' },
}

export const commissionRuleConfig: Record<string, string> = {
  upfront: 'À vista na assinatura',
  installments: 'Parcelada conforme repasse',
  custom: 'Personalizado',
}

// ── Input mask helpers ───────────────────────────────────────
export function maskCPF(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14)
}

export function maskPhone(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15)
}

// ── Parse currency input ─────────────────────────────────────
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
}

// ── Percentage change ────────────────────────────────────────
export function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

// ── Re-exports from types (for convenience) ──────────────────
export type { ExpenseCategory } from '@/types'
export { EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES } from '@/types'

// ── Month list for charts ────────────────────────────────────
export function getLast12Months(): string[] {
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(format(d, 'MMM/yy', { locale: ptBR }))
  }
  return months
}
