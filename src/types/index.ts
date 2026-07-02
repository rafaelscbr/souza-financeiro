export type CompanySlug = 'imobiliaria' | 'escola' | 'assessoria'
export type TransactionKind = 'income' | 'expense' | 'withdrawal'
export type TransactionStatus = 'settled' | 'pending'
export type GoalMetric = 'monthly_revenue' | 'monthly_profit'
export type ContactType = 'broker' | 'supplier'

/** Grupo no DRE (Demonstração de Resultado). */
export type DreGroup =
  | 'revenue'
  | 'cost_of_sale'
  | 'operating_expense'
  | 'variable_expense'
  | 'withdrawal'

export interface Company {
  id: string
  slug: string
  name: string
  brand_color: string
  accent_color: string
  sort_order: number
  /** true = ledger pessoal do dono (isolado do consolidado das empresas). */
  is_personal: boolean
  created_at: string
}

export interface PersonalBudget {
  id: string
  category: string
  monthly_limit: number
  created_at: string
}

export interface Category {
  id: string
  company_id: string | null
  kind: TransactionKind
  name: string
  dre_group: DreGroup | null
  is_recurring_default: boolean
  sort_order: number
  created_at: string
}

export interface Contact {
  id: string
  type: ContactType
  name: string
  document: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Transaction {
  id: string
  company_id: string
  kind: TransactionKind
  category: string
  dre_group: DreGroup | null
  description: string
  amount: number
  /** Mês de competência / faturamento (YYYY-MM-DD). */
  competence_date: string
  /** settled = recebido/pago · pending = a receber/a pagar. */
  status: TransactionStatus
  /** Data em que o dinheiro entrou/saiu de fato (quando settled). */
  settled_date: string | null
  /** Previsão de recebimento/pagamento (quando pending). */
  due_date: string | null
  is_recurring: boolean
  /** Corretor (repasse) ou fornecedor (despesa). */
  contact_id: string | null
  /** Texto livre de contraparte (legado / quando não há contato). */
  counterparty: string | null
  /** Valor do imóvel vendido (comissões). */
  property_value: number | null
  /** % da comissão sobre a venda. */
  commission_pct: number | null
  /** % do corretor sobre a comissão. */
  broker_pct: number | null
  /** Agrupa parcelas + venda/repasse de uma mesma operação. */
  group_id: string | null
  installment_index: number | null
  installment_count: number | null
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  /** null = meta do grupo (consolidada). */
  company_id: string | null
  metric: GoalMetric
  target_value: number
  /** Primeiro dia do mês de referência (YYYY-MM-DD). */
  month: string
  created_at: string
}

/** Payload de criação/edição de lançamento (sem campos gerados pelo banco). */
export interface TransactionInput {
  company_id: string
  kind: TransactionKind
  category: string
  dre_group: DreGroup | null
  description: string
  amount: number
  competence_date: string
  status: TransactionStatus
  settled_date: string | null
  due_date: string | null
  is_recurring: boolean
  contact_id: string | null
  counterparty: string | null
  property_value: number | null
  commission_pct: number | null
  broker_pct: number | null
  group_id: string | null
  installment_index: number | null
  installment_count: number | null
}

export type ContactInput = Omit<Contact, 'id' | 'created_at'>

export type HealthStatus = 'healthy' | 'warning' | 'critical'
