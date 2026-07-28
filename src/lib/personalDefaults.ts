import type { TransactionKind } from '@/types'

/**
 * Categorias padrão do módulo pessoal — curadas para escolher em 1 toque:
 * poucas o bastante para caber na grade, completas o bastante para o
 * relatório anual (e o apoio ao IR) fazer sentido.
 *
 * 'Investimentos/Poupança' mantém EXATAMENTE este nome: `personalSummary`
 * (lib/finance.ts) usa a string para o KPI "Investido/Poupado".
 */
export interface DefaultCategory {
  name: string
  kind: TransactionKind
  icon: string
  color: string
}

export const DEFAULT_PERSONAL_CATEGORIES: DefaultCategory[] = [
  // Despesas — essenciais
  { name: 'Moradia', kind: 'expense', icon: '🏠', color: '#0369A1' },
  { name: 'Mercado', kind: 'expense', icon: '🛒', color: '#4D7C0F' },
  { name: 'Restaurantes & Café', kind: 'expense', icon: '🍽️', color: '#B45309' },
  { name: 'Transporte', kind: 'expense', icon: '🚗', color: '#374151' },
  { name: 'Saúde', kind: 'expense', icon: '💊', color: '#BE123C' },
  { name: 'Educação', kind: 'expense', icon: '🎓', color: '#1E3A8A' },
  // Despesas — estilo de vida
  { name: 'Lazer & Viagens', kind: 'expense', icon: '🎬', color: '#7C3AED' },
  { name: 'Compras Pessoais', kind: 'expense', icon: '👕', color: '#DB2777' },
  { name: 'Assinaturas', kind: 'expense', icon: '📱', color: '#6366F1' },
  { name: 'Bem-estar', kind: 'expense', icon: '💪', color: '#0F766E' },
  { name: 'Família & Presentes', kind: 'expense', icon: '🎁', color: '#C026D3' },
  { name: 'Pets', kind: 'expense', icon: '🐾', color: '#92400E' },
  // Despesas — financeiras
  { name: 'Tarifas & Juros', kind: 'expense', icon: '🏦', color: '#DC2626' },
  { name: 'Impostos Pessoais', kind: 'expense', icon: '🧾', color: '#57534E' },
  { name: 'Investimentos/Poupança', kind: 'expense', icon: '📈', color: '#059669' },
  { name: 'Doações', kind: 'expense', icon: '🤝', color: '#0891B2' },
  // Receitas
  { name: 'Renda Extra', kind: 'income', icon: '💰', color: '#059669' },
  { name: 'Rendimentos', kind: 'income', icon: '📊', color: '#0F766E' },
  { name: 'Reembolsos', kind: 'income', icon: '🔁', color: '#0369A1' },
  { name: 'Outros Recebimentos', kind: 'income', icon: '✨', color: '#6366F1' },
]

/** Chave do localStorage: última conta usada no lançamento rápido pessoal. */
export const LAST_PERSONAL_ACCOUNT_KEY = 'sgf.personal.lastAccount'
