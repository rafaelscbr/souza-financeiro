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
  /**
   * `null` = limite padrão que vale todo mês; 'YYYY-MM-01' = ajuste pontual
   * daquele mês (viagem em julho, 13º em dezembro). O mês específico vence
   * o padrão na leitura. (migração 005)
   */
  month: string | null
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
  /** Emoji exibido na grade de 1 toque do lançamento rápido. (migração 005) */
  icon: string | null
  /** Cor da categoria (hex) — identidade visual persistente. (migração 005) */
  color: string | null
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
  /**
   * Compra de cartão de crédito: 1º dia do mês da FATURA em que a compra pesa.
   * Carimbado no lançamento (mudar o fechamento do cartão depois não reescreve
   * o histórico). `null` = lançamento fora de cartão. (migração 005)
   */
  card_cycle_month: string | null
  /** Venda que originou o lançamento (migração 008). Substitui o vínculo por texto. */
  sale_id?: string | null
  sale_installment_id?: string | null
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
  card_cycle_month?: string | null
}

/**
 * Construtora ou incorporadora.
 *
 * O PRAZO DE PAGAMENTO é dela, não do empreendimento: a LOTISA paga 10 dias
 * úteis depois que a imobiliária emite a nota, em qualquer produto. O GATILHO
 * de liberação da comissão é do empreendimento (`CostCenter.trigger_note`),
 * porque a mesma construtora usa regras diferentes em cada lançamento.
 */
export interface Developer {
  id: string
  company_id: string
  name: string
  /** Dias até o pagamento, contados da emissão da nota. `null` = não sei ainda. */
  payment_days: number | null
  /** true = dias úteis (segunda a sexta, sem feriado); false = corridos. */
  payment_days_business: boolean
  notes: string | null
  is_active: boolean
  created_at: string
}

export type DeveloperInput = Omit<Developer, 'id' | 'company_id' | 'created_at'>

/** Empreendimento ou projeto — permite apurar resultado por produto. */
export interface CostCenter {
  id: string
  company_id: string
  name: string
  /** Construtora, incorporadora ou parceiro — o nome, como era antes do cadastro. */
  developer: string | null
  /** A construtora cadastrada, dona do prazo de pagamento. */
  developer_id: string | null
  /** O gatilho que libera a comissão neste empreendimento, como está no contrato. */
  trigger_note: string | null
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
  /** Dia de fechamento da fatura (só cartão). Compra após o fechamento cai na fatura seguinte. */
  card_closing_day: number | null
  /** Dia de vencimento: primeira ocorrência APÓS o fechamento (pode ser no mesmo mês). */
  card_due_day: number | null
  /** Limite total do cartão. `null` = não informado. */
  card_limit: number | null
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

/** Categorias de bem/dívida do patrimônio pessoal (migração 006). */
export type AssetCategory =
  | 'imovel'
  | 'veiculo'
  | 'participacao'
  | 'investimento'
  | 'financiamento'
  | 'emprestimo'
  | 'outro'

/**
 * Bem ou dívida informado à mão. O sistema já sabe de contas, investimentos e
 * faturas — aqui entra o que ele não tem como descobrir sozinho.
 */
export interface PersonalAsset {
  id: string
  kind: 'asset' | 'liability'
  category: AssetCategory
  name: string
  value: number
  /** Data da última avaliação — a tela avisa quando o valor ficar velho. */
  valued_at: string
  notes: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type PersonalAssetInput = Omit<PersonalAsset, 'id' | 'created_at'>

export type ContactInput = Omit<Contact, 'id' | 'created_at'>

export type HealthStatus = 'healthy' | 'warning' | 'critical'

// ---------------------------------------------------------------------------
// Sistema da imobiliária (migrações 007-011)
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'corretor'

/** Papel de um usuário do Auth. Sem perfil, o acesso não foi liberado. */
export interface Profile {
  id: string
  role: Role
  /** Contato (corretor) que este login representa. `null` no administrador. */
  contact_id: string | null
  name: string | null
  is_active: boolean
}

export type SaleStatus = 'ativa' | 'concluida' | 'cancelada'
export type InstallmentStatus = 'prevista' | 'recebida' | 'cancelada'
/** Situação da comissão no vocabulário do corretor. */
export type BrokerStatus = 'prevista' | 'liberada' | 'recebida' | 'cancelada'

export interface Sale {
  id: string
  company_id: string
  title: string
  cost_center_id: string | null
  unit: string | null
  client_name: string | null
  sale_date: string
  /** Valor do imóvel (VGV). `null` = não informado; nunca inventar. */
  property_value: number | null
  commission_pct: number | null
  /** Comissão que a imobiliária tem direito a receber (só a parte dela). */
  commission_total: number
  partner_name: string | null
  partner_share_pct: number | null
  /** Sem nota não há Simples (caso da parceria Rogga). */
  issues_invoice: boolean
  simples_pct: number
  /** A construtora retém ISS no ato do pagamento? */
  retains_iss: boolean
  iss_pct: number
  broker_id: string | null
  broker_pct: number | null
  owner_profit_pct: number | null
  status: SaleStatus
  notes: string | null
  legacy_group_id: string | null
  created_at: string
  updated_at: string
}

export interface SaleInstallment {
  id: string
  sale_id: string
  idx: number
  count: number
  expected_date: string
  /** Parcela bruta da comissão. */
  amount: number
  iss_amount: number
  simples_amount: number
  broker_amount: number
  /** Desconto combinado com o corretor, se houve. */
  broker_adjustment: number
  owner_amount: number
  net_amount: number
  status: InstallmentStatus
  /**
   * OS TRÊS MARCOS DA PARCELA (decisão de 21/09/2026).
   *
   * O dinheiro não vem na data: vem depois de uma corrente de eventos. O
   * cliente paga a construtora até atingir o gatilho do contrato, a comissão
   * é liberada, a imobiliária emite a nota fiscal, e a construtora paga no
   * prazo dela. `expected_date` é sempre a melhor previsão de quando o
   * dinheiro entra — e passa a ser calculada quando a nota é emitida.
   */
  trigger_note: string | null
  /** Gatilho atingido em. `null` = a comissão ainda não foi liberada. */
  trigger_met_date: string | null
  /** Nota fiscal emitida em. `null` = ainda não emitida. */
  invoice_issued_date: string | null
  invoice_number: string | null
  received_date: string | null
  /** Quanto caiu na conta (parcela menos o que foi retido). */
  received_amount: number | null
  account_id: string | null
  notes: string | null
  revenue_tx_id: string | null
  iss_tx_id: string | null
  simples_tx_id: string | null
  broker_tx_id: string | null
  owner_tx_id: string | null
  other_tx_id: string | null
}

/** Uma parcela a registrar em `register_sale`. */
export interface NewInstallment {
  idx: number
  expected_date: string
  amount: number
  /** O gatilho desta parcela; sem ele, vale o do empreendimento. */
  trigger_note?: string | null
}

export interface NewSale {
  title: string
  cost_center_id: string | null
  unit: string | null
  client_name: string | null
  sale_date: string
  property_value: number | null
  commission_pct: number | null
  commission_total: number
  partner_name: string | null
  partner_share_pct: number | null
  issues_invoice: boolean
  simples_pct: number
  retains_iss: boolean
  iss_pct: number
  broker_id: string | null
  broker_pct: number | null
  notes: string | null
  installments: NewInstallment[]
}
