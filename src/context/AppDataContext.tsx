import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { invoiceCycleOf } from '@/lib/cards'
import type {
  Account,
  AccountInput,
  Category,
  Company,
  Contact,
  ContactInput,
  CostCenter,
  CostCenterInput,
  PeriodClosing,
  Goal,
  Objective,
  ObjectiveInput,
  PersonalAsset,
  PersonalAssetInput,
  PersonalBudget,
  Regime,
  TaxRegime,
  Transaction,
  TransactionInput,
  TransactionTemplate,
  TransactionTemplateInput,
  Transfer,
  TransferInput,
} from '@/types'

interface AppDataValue {
  // Dados
  companies: Company[]
  /** Empresas de negócio (exclui a Pessoal). */
  businessCompanies: Company[]
  personalCompany: Company | null
  categories: Category[]
  contacts: Contact[]
  transactions: Transaction[]
  /** Transações das empresas de negócio (exclui a Pessoal). */
  businessTransactions: Transaction[]
  /** Transações do ledger Pessoal. */
  personalTransactions: Transaction[]
  goals: Goal[]
  personalBudgets: PersonalBudget[]
  objectives: Objective[]
  accounts: Account[]
  transfers: Transfer[]
  templates: TransactionTemplate[]
  /** `false` enquanto a migração 004 (modelos) não foi aplicada. */
  templatesReady: boolean
  /** `false` enquanto a migração 005 (módulo pessoal/cartão) não foi aplicada. */
  personalReady: boolean
  /** Bens e dívidas do patrimônio pessoal (migração 006). */
  personalAssets: PersonalAsset[]
  /** `false` enquanto a migração 006 (patrimônio) não foi aplicada. */
  assetsReady: boolean
  costCenters: CostCenter[]
  periodClosings: PeriodClosing[]
  /** `true` quando o mês em foco já foi fechado para o escopo atual. */
  isPeriodClosed: boolean
  /** `false` enquanto a migração 001 não foi aplicada no Supabase. */
  migrationApplied: boolean
  /** `false` enquanto a migração 002 (tesouraria) não foi aplicada. */
  treasuryReady: boolean
  /** `false` enquanto a migração 003 (centro de custo e fechamento) não foi aplicada. */
  costCentersReady: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>

  // Escopo (null = grupo consolidado)
  scopeCompanyId: string | null
  setScope: (companyId: string | null) => void
  activeCompany: Company | null

  /** Regime de apuração — decide em qual mês cada lançamento é contado. */
  regime: Regime
  setRegime: (regime: Regime) => void

  // Período (primeiro dia do mês em foco)
  period: Date
  setPeriod: (date: Date) => void
  goToPrevMonth: () => void
  goToNextMonth: () => void
  goToCurrentMonth: () => void

  // Mutações — lançamentos (create devolve as linhas criadas — o Desfazer do
  // lançamento rápido precisa dos ids)
  createTransaction: (input: TransactionInput) => Promise<Transaction>
  createTransactions: (inputs: TransactionInput[]) => Promise<Transaction[]>
  updateTransaction: (id: string, input: Partial<TransactionInput>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  deleteTransactions: (ids: string[]) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>

  // Mutações — metas
  saveGoal: (goal: Omit<Goal, 'id' | 'created_at'>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>

  // Mutações — contatos
  createContact: (input: ContactInput) => Promise<Contact>
  updateContact: (id: string, input: Partial<ContactInput>) => Promise<void>
  deleteContact: (id: string) => Promise<void>

  // Mutações — orçamento pessoal (`month` null = limite padrão de todo mês)
  savePersonalBudget: (category: string, monthlyLimit: number, month?: string | null) => Promise<void>
  deletePersonalBudget: (category: string, month?: string | null) => Promise<void>
  /** Cria as categorias pessoais padrão (com ícone e cor) que ainda não existem. */
  seedPersonalCategories: () => Promise<number>

  // Mutações — patrimônio pessoal
  createPersonalAsset: (input: PersonalAssetInput) => Promise<void>
  updatePersonalAsset: (id: string, input: Partial<PersonalAssetInput>) => Promise<void>
  deletePersonalAsset: (id: string) => Promise<void>

  // Mutações — contas e transferências
  createAccount: (input: AccountInput) => Promise<void>
  updateAccount: (id: string, input: Partial<AccountInput>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  createTransfer: (input: TransferInput) => Promise<void>
  deleteTransfer: (id: string) => Promise<void>

  // Mutações — centro de custo e fechamento
  createCostCenter: (input: CostCenterInput) => Promise<void>
  updateCostCenter: (id: string, input: Partial<CostCenterInput>) => Promise<void>
  deleteCostCenter: (id: string) => Promise<void>
  closePeriod: (companyId: string | null, month: string, notes?: string) => Promise<void>
  reopenPeriod: (id: string) => Promise<void>
  // Mutações — modelos de lançamento
  createTemplate: (input: TransactionTemplateInput) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>

  /** Baixa em um clique: marca como liquidado na data e conta informadas. */
  settleTransaction: (id: string, accountId: string | null, date: string) => Promise<void>
  /** Desfaz a baixa, devolvendo o lançamento para pendente. */
  unsettleTransaction: (id: string, dueDate: string) => Promise<void>

  // Mutações — objetivos
  createObjective: (input: ObjectiveInput) => Promise<void>
  updateObjective: (id: string, input: Partial<ObjectiveInput>) => Promise<void>
  deleteObjective: (id: string) => Promise<void>

  // Configuração tributária
  updateCompanyTax: (companyId: string, regime: TaxRegime, rate: number | null) => Promise<void>
}

const AppDataContext = createContext<AppDataValue | null>(null)

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const REGIME_KEY = 'sgf.regime'

/** Caixa é o padrão: responde "quanto entrou na conta", que é como se pensa no dia a dia. */
function loadRegime(): Regime {
  try {
    return localStorage.getItem(REGIME_KEY) === 'accrual' ? 'accrual' : 'cash'
  } catch {
    return 'cash'
  }
}

function coerceTransaction(t: Transaction): Transaction {
  return {
    ...t,
    amount: Number(t.amount),
    property_value: t.property_value == null ? null : Number(t.property_value),
    commission_pct: t.commission_pct == null ? null : Number(t.commission_pct),
    broker_pct: t.broker_pct == null ? null : Number(t.broker_pct),
    card_cycle_month: t.card_cycle_month ?? null,
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [personalBudgets, setPersonalBudgets] = useState<PersonalBudget[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [periodClosings, setPeriodClosings] = useState<PeriodClosing[]>([])
  const [templates, setTemplates] = useState<TransactionTemplate[]>([])
  const [migrationApplied, setMigrationApplied] = useState(true)
  const [treasuryReady, setTreasuryReady] = useState(true)
  const [costCentersReady, setCostCentersReady] = useState(true)
  const [templatesReady, setTemplatesReady] = useState(true)
  const [personalReady, setPersonalReady] = useState(true)
  const [personalAssets, setPersonalAssets] = useState<PersonalAsset[]>([])
  const [assetsReady, setAssetsReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [scopeCompanyId, setScope] = useState<string | null>(null)
  const [period, setPeriodState] = useState<Date>(startOfMonth())
  const [regime, setRegimeState] = useState<Regime>(loadRegime)

  const refresh = useCallback(async () => {
    setError(null)
    const [
      companiesRes,
      categoriesRes,
      contactsRes,
      txRes,
      goalsRes,
      budgetsRes,
      objectivesRes,
      accountsRes,
      transfersRes,
      costCentersRes,
      closingsRes,
      templatesRes,
      migration005Res,
      assetsRes,
    ] = await Promise.all([
      supabase.from('companies').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('contacts').select('*').order('name'),
      supabase.from('transactions').select('*').order('competence_date', { ascending: false }),
      supabase.from('goals').select('*'),
      supabase.from('personal_budgets').select('*'),
      supabase.from('objectives').select('*').order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').order('sort_order'),
      supabase.from('transfers').select('*').order('date', { ascending: false }),
      supabase.from('cost_centers').select('*').order('name'),
      supabase.from('period_closings').select('*').order('month', { ascending: false }),
      supabase.from('transaction_templates').select('*').order('sort_order'),
      // Sonda a migração 005: se a coluna não existe, o módulo pessoal degrada
      // com aviso em vez de quebrar (mesmo padrão das migrações 001–004).
      supabase.from('transactions').select('card_cycle_month').limit(1),
      supabase.from('personal_assets').select('*').order('sort_order'),
    ])

    const firstError =
      companiesRes.error ||
      categoriesRes.error ||
      contactsRes.error ||
      txRes.error ||
      goalsRes.error ||
      budgetsRes.error
    if (firstError) {
      setError('Não foi possível carregar os dados. Verifique sua conexão.')
      return
    }

    // A tabela `objectives` só existe após a migração 001. Enquanto isso, o
    // resto do sistema continua funcionando e a tela avisa o que falta.
    setMigrationApplied(!objectivesRes.error)
    setObjectives(
      ((objectivesRes.data as Objective[]) ?? []).map((o) => ({
        ...o,
        one_time_cost: Number(o.one_time_cost),
        monthly_cost: Number(o.monthly_cost),
      })),
    )

    // Idem para a tesouraria (migração 002).
    setTreasuryReady(!accountsRes.error && !transfersRes.error)
    setAccounts(
      ((accountsRes.data as Account[]) ?? []).map((a) => ({
        ...a,
        opening_balance: Number(a.opening_balance),
        card_closing_day: a.card_closing_day == null ? null : Number(a.card_closing_day),
        card_due_day: a.card_due_day == null ? null : Number(a.card_due_day),
        card_limit: a.card_limit == null ? null : Number(a.card_limit),
      })),
    )
    setTransfers(
      ((transfersRes.data as Transfer[]) ?? []).map((t) => ({ ...t, amount: Number(t.amount) })),
    )

    // Idem para centro de custo e fechamento (migração 003).
    setCostCentersReady(!costCentersRes.error && !closingsRes.error)
    setCostCenters((costCentersRes.data as CostCenter[]) ?? [])
    setPeriodClosings((closingsRes.data as PeriodClosing[]) ?? [])

    // Idem para o módulo pessoal/cartão (migração 005).
    setPersonalReady(!migration005Res.error)

    // Idem para o patrimônio pessoal (migração 006).
    setAssetsReady(!assetsRes.error)
    setPersonalAssets(
      ((assetsRes.data as PersonalAsset[]) ?? []).map((a) => ({ ...a, value: Number(a.value) })),
    )

    // Idem para modelos de lançamento (migração 004).
    setTemplatesReady(!templatesRes.error)
    setTemplates(
      ((templatesRes.data as TransactionTemplate[]) ?? []).map((t) => ({
        ...t,
        amount: t.amount == null ? null : Number(t.amount),
      })),
    )

    setCompanies(
      ((companiesRes.data as Company[]) ?? []).map((c) => ({
        ...c,
        tax_rate: c.tax_rate == null ? null : Number(c.tax_rate),
      })),
    )
    setCategories(
      ((categoriesRes.data as Category[]) ?? []).map((c) => ({
        ...c,
        icon: c.icon ?? null,
        color: c.color ?? null,
      })),
    )
    setContacts((contactsRes.data as Contact[]) ?? [])
    setTransactions(((txRes.data as Transaction[]) ?? []).map(coerceTransaction))
    setGoals(
      ((goalsRes.data as Goal[]) ?? []).map((g) => ({ ...g, target_value: Number(g.target_value) })),
    )
    setPersonalBudgets(
      ((budgetsRes.data as PersonalBudget[]) ?? []).map((b) => ({
        ...b,
        monthly_limit: Number(b.monthly_limit),
        month: b.month ?? null,
      })),
    )
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const setRegime = useCallback((r: Regime) => {
    setRegimeState(r)
    try {
      localStorage.setItem(REGIME_KEY, r)
    } catch {
      // sem localStorage (aba anônima) o regime só não persiste entre sessões
    }
  }, [])

  const setPeriod = useCallback((date: Date) => setPeriodState(startOfMonth(date)), [])
  const goToPrevMonth = useCallback(
    () => setPeriodState((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1)),
    [],
  )
  const goToNextMonth = useCallback(
    () => setPeriodState((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1)),
    [],
  )
  const goToCurrentMonth = useCallback(() => setPeriodState(startOfMonth()), [])

  const createTransaction = useCallback(
    async (input: TransactionInput) => {
      const { data, error } = await supabase.from('transactions').insert(input).select().single()
      if (error) throw new Error(error.message)
      await refresh()
      return coerceTransaction(data as Transaction)
    },
    [refresh],
  )

  const createTransactions = useCallback(
    async (inputs: TransactionInput[]) => {
      if (inputs.length === 0) return []
      const { data, error } = await supabase.from('transactions').insert(inputs).select()
      if (error) throw new Error(error.message)
      await refresh()
      return ((data as Transaction[]) ?? []).map(coerceTransaction)
    },
    [refresh],
  )

  const updateTransaction = useCallback(
    async (id: string, input: Partial<TransactionInput>) => {
      const { error } = await supabase.from('transactions').update(input).eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteTransactions = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase.from('transactions').delete().in('id', ids)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const { error } = await supabase.from('transactions').delete().eq('group_id', groupId)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const saveGoal = useCallback(
    async (goal: Omit<Goal, 'id' | 'created_at'>) => {
      let del = supabase.from('goals').delete().eq('metric', goal.metric).eq('month', goal.month)
      del = goal.company_id === null ? del.is('company_id', null) : del.eq('company_id', goal.company_id)
      const { error: delErr } = await del
      if (delErr) throw new Error(delErr.message)

      const { error } = await supabase.from('goals').insert(goal)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteGoal = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const createContact = useCallback(
    async (input: ContactInput) => {
      const { data, error } = await supabase.from('contacts').insert(input).select().single()
      if (error) throw new Error(error.message)
      await refresh()
      return data as Contact
    },
    [refresh],
  )

  const updateContact = useCallback(
    async (id: string, input: Partial<ContactInput>) => {
      const { error } = await supabase.from('contacts').update(input).eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteContact = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === scopeCompanyId) ?? null,
    [companies, scopeCompanyId],
  )

  // Um mês está fechado se houver fechamento da empresa em foco OU do grupo.
  const isPeriodClosed = useMemo(() => {
    const mk = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}-01`
    return periodClosings.some(
      (c) => c.month === mk && (c.company_id === null || c.company_id === scopeCompanyId),
    )
  }, [periodClosings, period, scopeCompanyId])

  // Isolamento pessoal × negócio
  const personalCompany = useMemo(() => companies.find((c) => c.is_personal) ?? null, [companies])
  const businessCompanies = useMemo(() => companies.filter((c) => !c.is_personal), [companies])
  const businessTransactions = useMemo(
    () => (personalCompany ? transactions.filter((t) => t.company_id !== personalCompany.id) : transactions),
    [transactions, personalCompany],
  )
  const personalTransactions = useMemo(
    () => (personalCompany ? transactions.filter((t) => t.company_id === personalCompany.id) : []),
    [transactions, personalCompany],
  )

  const savePersonalBudget = useCallback(
    async (category: string, monthlyLimit: number, month: string | null = null) => {
      // Antes da migração 005 a coluna `month` não existe — filtrá-la erraria.
      // Comportamento antigo (limite único por categoria) como degradação.
      if (!personalReady) {
        await supabase.from('personal_budgets').delete().eq('category', category)
        if (monthlyLimit > 0) {
          const { error } = await supabase
            .from('personal_budgets')
            .insert({ category, monthly_limit: monthlyLimit })
          if (error) throw new Error(error.message)
        }
        await refresh()
        return
      }

      let del = supabase.from('personal_budgets').delete().eq('category', category)
      del = month === null ? del.is('month', null) : del.eq('month', month)
      await del
      if (monthlyLimit > 0) {
        const { error } = await supabase
          .from('personal_budgets')
          .insert({ category, monthly_limit: monthlyLimit, month })
        if (error) throw new Error(error.message)
      }
      await refresh()
    },
    [refresh, personalReady],
  )

  const deletePersonalBudget = useCallback(
    async (category: string, month: string | null = null) => {
      let del = supabase.from('personal_budgets').delete().eq('category', category)
      if (personalReady) del = month === null ? del.is('month', null) : del.eq('month', month)
      const { error } = await del
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh, personalReady],
  )

  const seedPersonalCategories = useCallback(async () => {
    const personal = companies.find((c) => c.is_personal)
    if (!personal) throw new Error('Empresa pessoal não encontrada.')
    const { DEFAULT_PERSONAL_CATEGORIES } = await import('@/lib/personalDefaults')
    const existing = new Set(
      categories
        .filter((c) => c.company_id === personal.id)
        .map((c) => `${c.kind}|${c.name.toLowerCase()}`),
    )
    const missing = DEFAULT_PERSONAL_CATEGORIES.filter(
      (c) => !existing.has(`${c.kind}|${c.name.toLowerCase()}`),
    )
    if (missing.length === 0) return 0
    const rows = missing.map((c, i) => ({
      company_id: personal.id,
      kind: c.kind,
      name: c.name,
      dre_group: null,
      is_recurring_default: false,
      sort_order: i,
      // Ícone/cor dependem da migração 005 — sem ela, semeia sem identidade visual.
      ...(personalReady ? { icon: c.icon, color: c.color } : {}),
    }))
    const { error } = await supabase.from('categories').insert(rows)
    if (error) throw new Error(error.message)
    await refresh()
    return missing.length
  }, [refresh, companies, categories, personalReady])

  const createPersonalAsset = useCallback(
    async (input: PersonalAssetInput) => {
      const { error } = await supabase.from('personal_assets').insert(input)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const updatePersonalAsset = useCallback(
    async (id: string, input: Partial<PersonalAssetInput>) => {
      const { error } = await supabase.from('personal_assets').update(input).eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deletePersonalAsset = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('personal_assets').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const createAccount = useCallback(
    async (input: AccountInput) => {
      const { error } = await supabase.from('accounts').insert(input)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const updateAccount = useCallback(
    async (id: string, input: Partial<AccountInput>) => {
      const { error } = await supabase.from('accounts').update(input).eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteAccount = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const createTransfer = useCallback(
    async (input: TransferInput) => {
      const { error } = await supabase.from('transfers').insert(input)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteTransfer = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transfers').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const createTemplate = useCallback(
    async (input: TransactionTemplateInput) => {
      const { error } = await supabase.from('transaction_templates').insert(input)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteTemplate = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transaction_templates').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const settleTransaction = useCallback(
    async (id: string, accountId: string | null, date: string) => {
      // Dar baixa apontando um CARTÃO precisa carimbar a fatura do ciclo — é o
      // carimbo que define em qual mês a despesa pesa. Sem ele, o lançamento
      // ficaria no mês da baixa e sumiria da fatura correspondente.
      const target = accountId ? accounts.find((a) => a.id === accountId) : null
      const cardCycle =
        target && target.type === 'credit_card'
          ? invoiceCycleOf(date, target.card_closing_day ?? 31)
          : null
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'settled',
          settled_date: date,
          due_date: null,
          account_id: accountId,
          ...(personalReady ? { card_cycle_month: cardCycle } : {}),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh, accounts, personalReady],
  )

  const unsettleTransaction = useCallback(
    async (id: string, dueDate: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'pending',
          settled_date: null,
          due_date: dueDate,
          // Voltar a pendente tira o lançamento de qualquer fatura.
          ...(personalReady ? { card_cycle_month: null } : {}),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh, personalReady],
  )

  const createCostCenter = useCallback(
    async (input: CostCenterInput) => {
      const { error } = await supabase.from('cost_centers').insert(input)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const updateCostCenter = useCallback(
    async (id: string, input: Partial<CostCenterInput>) => {
      const { error } = await supabase.from('cost_centers').update(input).eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteCostCenter = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('cost_centers').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const closePeriod = useCallback(
    async (companyId: string | null, month: string, notes?: string) => {
      const { error } = await supabase
        .from('period_closings')
        .insert({ company_id: companyId, month, notes: notes ?? null })
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const reopenPeriod = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('period_closings').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const createObjective = useCallback(
    async (input: ObjectiveInput) => {
      const { error } = await supabase.from('objectives').insert(input)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const updateObjective = useCallback(
    async (id: string, input: Partial<ObjectiveInput>) => {
      const { error } = await supabase.from('objectives').update(input).eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const deleteObjective = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('objectives').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const updateCompanyTax = useCallback(
    async (companyId: string, regime: TaxRegime, rate: number | null) => {
      const { error } = await supabase
        .from('companies')
        .update({ tax_regime: regime, tax_rate: rate })
        .eq('id', companyId)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<AppDataValue>(
    () => ({
      companies,
      businessCompanies,
      personalCompany,
      categories,
      contacts,
      transactions,
      businessTransactions,
      personalTransactions,
      goals,
      personalBudgets,
      objectives,
      accounts,
      transfers,
      costCenters,
      periodClosings,
      isPeriodClosed,
      templates,
      templatesReady,
      personalReady,
      personalAssets,
      assetsReady,
      migrationApplied,
      treasuryReady,
      costCentersReady,
      loading,
      error,
      refresh,
      scopeCompanyId,
      setScope,
      activeCompany,
      regime,
      setRegime,
      period,
      setPeriod,
      goToPrevMonth,
      goToNextMonth,
      goToCurrentMonth,
      createTransaction,
      createTransactions,
      updateTransaction,
      deleteTransaction,
      deleteTransactions,
      deleteGroup,
      saveGoal,
      deleteGoal,
      createContact,
      updateContact,
      deleteContact,
      savePersonalBudget,
      deletePersonalBudget,
      seedPersonalCategories,
      createPersonalAsset,
      updatePersonalAsset,
      deletePersonalAsset,
      createAccount,
      updateAccount,
      deleteAccount,
      createTransfer,
      deleteTransfer,
      createCostCenter,
      updateCostCenter,
      deleteCostCenter,
      closePeriod,
      reopenPeriod,
      createTemplate,
      deleteTemplate,
      settleTransaction,
      unsettleTransaction,
      createObjective,
      updateObjective,
      deleteObjective,
      updateCompanyTax,
    }),
    [
      companies,
      businessCompanies,
      personalCompany,
      categories,
      contacts,
      transactions,
      businessTransactions,
      personalTransactions,
      goals,
      personalBudgets,
      objectives,
      accounts,
      transfers,
      costCenters,
      periodClosings,
      isPeriodClosed,
      templates,
      templatesReady,
      personalReady,
      personalAssets,
      assetsReady,
      migrationApplied,
      treasuryReady,
      costCentersReady,
      loading,
      error,
      refresh,
      scopeCompanyId,
      activeCompany,
      regime,
      setRegime,
      period,
      setPeriod,
      goToPrevMonth,
      goToNextMonth,
      goToCurrentMonth,
      createTransaction,
      createTransactions,
      updateTransaction,
      deleteTransaction,
      deleteTransactions,
      deleteGroup,
      saveGoal,
      deleteGoal,
      createContact,
      updateContact,
      deleteContact,
      savePersonalBudget,
      deletePersonalBudget,
      seedPersonalCategories,
      createPersonalAsset,
      updatePersonalAsset,
      deletePersonalAsset,
      createAccount,
      updateAccount,
      deleteAccount,
      createTransfer,
      deleteTransfer,
      createCostCenter,
      updateCostCenter,
      deleteCostCenter,
      closePeriod,
      reopenPeriod,
      createTemplate,
      deleteTemplate,
      settleTransaction,
      unsettleTransaction,
      createObjective,
      updateObjective,
      deleteObjective,
      updateCompanyTax,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData deve ser usado dentro de <AppDataProvider>')
  return ctx
}
