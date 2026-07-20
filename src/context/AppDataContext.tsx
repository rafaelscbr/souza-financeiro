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
import type {
  Category,
  Company,
  Contact,
  ContactInput,
  Goal,
  PersonalBudget,
  Regime,
  Transaction,
  TransactionInput,
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

  // Mutações — lançamentos
  createTransaction: (input: TransactionInput) => Promise<void>
  createTransactions: (inputs: TransactionInput[]) => Promise<void>
  updateTransaction: (id: string, input: Partial<TransactionInput>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>

  // Mutações — metas
  saveGoal: (goal: Omit<Goal, 'id' | 'created_at'>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>

  // Mutações — contatos
  createContact: (input: ContactInput) => Promise<Contact>
  updateContact: (id: string, input: Partial<ContactInput>) => Promise<void>
  deleteContact: (id: string) => Promise<void>

  // Mutações — orçamento pessoal
  savePersonalBudget: (category: string, monthlyLimit: number) => Promise<void>
  deletePersonalBudget: (category: string) => Promise<void>
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
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [personalBudgets, setPersonalBudgets] = useState<PersonalBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [scopeCompanyId, setScope] = useState<string | null>(null)
  const [period, setPeriodState] = useState<Date>(startOfMonth())
  const [regime, setRegimeState] = useState<Regime>(loadRegime)

  const refresh = useCallback(async () => {
    setError(null)
    const [companiesRes, categoriesRes, contactsRes, txRes, goalsRes, budgetsRes] = await Promise.all([
      supabase.from('companies').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('contacts').select('*').order('name'),
      supabase.from('transactions').select('*').order('competence_date', { ascending: false }),
      supabase.from('goals').select('*'),
      supabase.from('personal_budgets').select('*'),
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

    setCompanies((companiesRes.data as Company[]) ?? [])
    setCategories((categoriesRes.data as Category[]) ?? [])
    setContacts((contactsRes.data as Contact[]) ?? [])
    setTransactions(((txRes.data as Transaction[]) ?? []).map(coerceTransaction))
    setGoals(
      ((goalsRes.data as Goal[]) ?? []).map((g) => ({ ...g, target_value: Number(g.target_value) })),
    )
    setPersonalBudgets(
      ((budgetsRes.data as PersonalBudget[]) ?? []).map((b) => ({
        ...b,
        monthly_limit: Number(b.monthly_limit),
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
      const { error } = await supabase.from('transactions').insert(input)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const createTransactions = useCallback(
    async (inputs: TransactionInput[]) => {
      if (inputs.length === 0) return
      const { error } = await supabase.from('transactions').insert(inputs)
      if (error) throw new Error(error.message)
      await refresh()
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
    async (category: string, monthlyLimit: number) => {
      await supabase.from('personal_budgets').delete().eq('category', category)
      if (monthlyLimit > 0) {
        const { error } = await supabase
          .from('personal_budgets')
          .insert({ category, monthly_limit: monthlyLimit })
        if (error) throw new Error(error.message)
      }
      await refresh()
    },
    [refresh],
  )

  const deletePersonalBudget = useCallback(
    async (category: string) => {
      const { error } = await supabase.from('personal_budgets').delete().eq('category', category)
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
      deleteGroup,
      saveGoal,
      deleteGoal,
      createContact,
      updateContact,
      deleteContact,
      savePersonalBudget,
      deletePersonalBudget,
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
      deleteGroup,
      saveGoal,
      deleteGoal,
      createContact,
      updateContact,
      deleteContact,
      savePersonalBudget,
      deletePersonalBudget,
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
