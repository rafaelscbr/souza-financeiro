// ============================================================
// DATABASE TYPES
// ============================================================

export interface Development {
  id: string
  name: string
  developer_name: string | null
  location: string | null
  city: string | null
  state: string | null
  total_units: number | null
  delivery_date: string | null
  status: 'active' | 'delivered' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface Broker {
  id: string
  name: string
  creci: string | null
  email: string | null
  phone: string | null
  pix_key: string | null
  bank_name: string | null
  bank_agency: string | null
  bank_account: string | null
  commission_default_pct: number
  active: boolean
  created_at: string
}

export interface Sale {
  id: string
  development_id: string | null
  unit_number: string | null
  unit_type: string | null
  floor_number: number | null
  area_m2: number | null
  buyer_name: string
  buyer_cpf: string | null
  buyer_phone: string | null
  buyer_email: string | null
  total_price: number
  vgl: number | null
  sale_date: string
  contract_date: string | null
  deed_date: string | null
  status: 'contracted' | 'cancelled' | 'completed'
  commission_pct: number | null
  commission_total: number | null
  commission_rule: 'upfront' | 'installments' | 'custom'
  notes: string | null
  created_at: string
  updated_at: string
  // relations
  development?: Development
  sale_brokers?: SaleBroker[]
  receivables?: Receivable[]
  commission_installments?: CommissionInstallment[]
}

export interface SaleBroker {
  id: string
  sale_id: string
  broker_id: string
  role: 'captador' | 'vendedor' | 'coordenador' | null
  commission_pct: number | null
  commission_value: number | null
  created_at: string
  // relations
  broker?: Broker
}

export interface CommissionInstallment {
  id: string
  sale_id: string
  broker_id: string
  installment_number: number
  due_date: string
  amount: number
  paid_date: string | null
  paid: boolean
  notes: string | null
  created_at: string
  // relations
  broker?: Broker
  sale?: Sale
}

export interface Receivable {
  id: string
  sale_id: string | null
  description: string
  due_date: string
  amount: number
  received_date: string | null
  received: boolean
  category: 'commission' | 'fee' | 'other'
  notes: string | null
  created_at: string
  // relations
  sale?: Sale
}

export interface Expense {
  id: string
  description: string
  category: ExpenseCategory
  subcategory: string | null
  development_id: string | null
  amount: number
  due_date: string
  paid_date: string | null
  paid: boolean
  recurring: boolean
  recurring_day: number | null
  notes: string | null
  created_at: string
  updated_at: string
  // relations
  development?: Development
}

export type ExpenseCategory =
  | 'rent'
  | 'marketing'
  | 'salary'
  | 'technology'
  | 'legal'
  | 'accounting'
  | 'office'
  | 'other'

export interface Budget {
  id: string
  name: string
  period_start: string
  period_end: string
  category: string | null
  budgeted_amount: number
  notes: string | null
  created_at: string
}

export interface Simulation {
  id: string
  name: string
  period_start: string | null
  period_end: string | null
  vgl_amount: number
  commission_pct: number
  gross_commission: number
  net_commission: number
  total_expenses: number
  net_profit: number
  items: SimulationItem[]
  created_at: string
}

export interface SimulationItem {
  label: string
  amount: number
  type: 'revenue' | 'expense'
  category?: string
}

// ============================================================
// UI / FORM TYPES
// ============================================================

export interface KpiCard {
  label: string
  value: number
  format: 'currency' | 'percent' | 'number'
  change?: number
  changeLabel?: string
  icon?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple'
}

export interface ChartDataPoint {
  label: string
  value: number
  value2?: number
  value3?: number
}

export type Period = '7d' | '30d' | '90d' | '12m' | 'ytd' | 'custom'

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  rent: 'Aluguel',
  marketing: 'Marketing',
  salary: 'Salários e Pró-labore',
  technology: 'Tecnologia',
  legal: 'Jurídico',
  accounting: 'Contabilidade',
  office: 'Escritório',
  other: 'Outros',
}

export const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
  marketing: ['Meta Ads', 'Google Ads', 'Instagram', 'Portal Imobiliário', 'Impresso', 'Outros'],
  salary: ['Pró-labore', 'CLT', 'Freelancer', 'Outros'],
  technology: ['CRM', 'Software', 'Internet', 'Outros'],
}
