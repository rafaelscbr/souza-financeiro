export type CompanySlug = 'imobiliaria' | 'escola' | 'assessoria'
export type TransactionKind = 'income' | 'expense' | 'withdrawal'
export type TransactionStatus = 'settled' | 'pending'
export type GoalMetric = 'monthly_revenue' | 'monthly_profit'
export type ContactType = 'broker' | 'supplier'

/**
 * Regime de apuração — define em qual mês cada lançamento é contado.
 * `accrual` = competência (mês da venda) · `cash` = caixa (mês em que o dinheiro se move).
 */
export type Regime = 'cash' | 'accrual'

/** Grupo no DRE (Demonstração de Resultado). */
export type DreGroup =
  | 'revenue'
  | 'tax' // imposto sobre faturamento (Simples/DAS) — dedução da receita
  | 'cost_of_sale'
  | 'operating_expense'
  | 'variable_expense'
  | 'withdrawal'

export type TaxRegime = 'simples' | 'presumido' | 'real' | 'none'

export interface Company {
  id: string
  slug: string
  name: string
  brand_color: string
  accent_color: string
  sort_order: number
  /** true = ledger pessoal do dono (isolado do consolidado das empresas). */
  is_personal: boolean
  /** Enquadramento tributário. `null` = ainda não configurado. */
  tax_regime: TaxRegime | null
  /**
   * Alíquota EFETIVA sobre a receita bruta, em % (ex.: 8.5).
   * No Simples é a que aparece no extrato do DAS — não a nominal da tabela.
   * `null` = não configurada; o DRE avisa em vez de assumir zero.
   */
  tax_rate: number | null
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
  /** Conta onde o dinheiro entrou/saiu. `null` = ainda não classificado. */
  account_id: string | null
  /** Empreendimento a que o lançamento pertence. */
  cost_center_id: string | null
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
  account_id: string | null
  cost_center_id?: string | null
}

/** Empreendimento ou projeto — permite apurar resultado por produto. */
export interface CostCenter {
  id: string
  company_id: string
  name: string
  /** Construtora, incorporadora ou parceiro. */
  developer: string | null
  is_active: boolean
  created_at: string
}

export type CostCenterInput = Omit<CostCenter, 'id' | 'created_at'>

/** Mês travado para edição, com rastro de quando foi fechado. */
export interface PeriodClosing {
  id: string
  /** `null` = fechamento do grupo inteiro. */
  company_id: string | null
  /** Primeiro dia do mês fechado (YYYY-MM-01). */
  month: string
  closed_at: string
  closed_by: string | null
  notes: string | null
}

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment' | 'credit_card'

/** Conta onde o dinheiro de fato mora: banco, caixinha, investimento. */
export interface Account {
  id: string
  company_id: string
  name: string
  type: AccountType
  bank: string | null
  /** Saldo no dia em que a conta entrou no sistema. */
  opening_balance: number
  opening_date: string
  color: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type AccountInput = Omit<Account, 'id' | 'created_at'>

/** Movimentação entre contas próprias — não é receita nem despesa. */
export interface Transfer {
  id: string
  from_account_id: string
  to_account_id: string
  amount: number
  date: string
  description: string | null
  created_at: string
}

export type TransferInput = Omit<Transfer, 'id' | 'created_at'>

/** Objetivo com custo: alugar uma sala, contratar alguém, comprar um carro. */
export interface Objective {
  id: string
  /** `business` usa o resultado da empresa · `personal` usa a sobra pessoal. */
  scope: 'business' | 'personal'
  /** Empresa alvo quando `scope = business`. */
  company_id: string | null
  name: string
  /** Desembolso único: entrada, caução, mobília, taxa. */
  one_time_cost: number
  /** Custo que se repete todo mês: aluguel, condomínio, salário. */
  monthly_cost: number
  /** Data desejada (opcional) — o sistema diz se é realista. */
  target_date: string | null
  notes: string | null
  status: 'planned' | 'achieved' | 'cancelled'
  created_at: string
}

export type ObjectiveInput = Omit<Objective, 'id' | 'created_at'>

/** Atalho para lançamentos repetitivos (Contador, Meta Ads, Aluguel). */
export interface TransactionTemplate {
  id: string
  company_id: string | null
  name: string
  kind: TransactionKind
  category: string
  dre_group: DreGroup | null
  /** Valor sugerido; `null` = pergunta ao usar. */
  amount: number | null
  contact_id: string | null
  sort_order: number
  created_at: string
}

export type TransactionTemplateInput = Omit<TransactionTemplate, 'id' | 'created_at'>

export type ContactInput = Omit<Contact, 'id' | 'created_at'>

export type HealthStatus = 'healthy' | 'warning' | 'critical'
