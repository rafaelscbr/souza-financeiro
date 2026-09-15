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
import { toDateOnly } from '@/lib/format'
import {
  attentionOf,
  buildSaleViews,
  payablesOf,
  receivablesOf,
  type AttentionItem,
  type MoneyItem,
  type SaleView,
} from '@/lib/sales'
import type {
  Account,
  Category,
  Company,
  Contact,
  CostCenter,
  NewSale,
  Profile,
  Sale,
  SaleInstallment,
  Transaction,
  Transfer,
} from '@/types'

/**
 * Os dados da imobiliária, e só dela.
 *
 * O contexto antigo (`AppDataContext`, 941 linhas) carregava as quatro
 * empresas e o razão pessoal, e cada tela filtrava por escopo. Isso obrigava
 * toda tela a saber de multiempresa e era a razão de o app parecer complicado.
 * Aqui existe uma empresa só, resolvida pelo slug, e nenhuma tela recebe
 * seletor de escopo.
 *
 * Toda escrita que mexe em dinheiro de venda passa por função do banco (RPC):
 * é lá que a cascata de imposto e comissão acontece, em uma transação só.
 * Escrita de cadastro e de despesa avulsa vai direto, porque é uma linha.
 */

export interface UsuarioDoSistema extends Profile {
  email: string | null
  ultimoAcesso: string | null
}

interface AdminValue {
  company: Company | null
  sales: Sale[]
  installments: SaleInstallment[]
  transactions: Transaction[]
  accounts: Account[]
  contacts: Contact[]
  categories: Category[]
  costCenters: CostCenter[]
  transfers: Transfer[]
  usuarios: UsuarioDoSistema[]

  /** Vendas com cascata, situação e vínculos prontos para a tela. */
  vendas: SaleView[]
  receber: MoneyItem[]
  pagar: MoneyItem[]
  atencao: AttentionItem[]
  /** Corretores que têm login ativo. */
  contatosComAcesso: Set<string>

  mes: Date
  irParaMes: (d: Date) => void
  mesAnterior: () => void
  mesSeguinte: () => void
  hoje: string

  carregando: boolean
  erro: string | null
  recarregar: () => Promise<void>

  registrarVenda: (venda: NewSale) => Promise<string>
  receberParcela: (p: {
    installmentId: string
    date: string
    accountId: string | null
    received?: number | null
    iss?: number | null
    other?: number
    note?: string | null
  }) => Promise<void>
  desfazerRecebimento: (installmentId: string) => Promise<void>
  pagarComissoes: (p: {
    installmentIds: string[]
    date: string
    accountId: string | null
    adjustment?: number
    note?: string | null
  }) => Promise<void>
  reagendarParcela: (installmentId: string, novaData: string, nota?: string) => Promise<void>
  cancelarVenda: (saleId: string, nota?: string) => Promise<void>
  editarVenda: (saleId: string, dados: Partial<Sale>) => Promise<void>

  criarLancamento: (t: Partial<Transaction>) => Promise<void>
  baixarLancamento: (id: string, date: string, accountId: string | null) => Promise<void>
  estornarLancamento: (id: string, dueDate: string) => Promise<void>
  excluirLancamento: (id: string) => Promise<void>

  salvarContato: (c: Partial<Contact> & { id?: string }) => Promise<Contact>
  salvarConta: (c: Partial<Account> & { id?: string }) => Promise<void>
  salvarEmpreendimento: (c: Partial<CostCenter> & { id?: string }) => Promise<void>
  salvarCategoria: (c: Partial<Category> & { id?: string }) => Promise<void>
  salvarImposto: (regime: string, aliquota: number | null) => Promise<void>
  salvarAcesso: (p: {
    userId: string
    role: 'admin' | 'corretor'
    contactId: string | null
    name: string | null
    isActive: boolean
  }) => Promise<void>
}

// Exportado só para a vitrine (src/demo) montar o mesmo contexto com dados de exemplo.
// eslint-disable-next-line react-refresh/only-export-components
export const AdminContext = createContext<AdminValue | null>(null)

function inicioDoMes(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const num = (v: unknown): number => Number(v ?? 0)

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [installments, setInstallments] = useState<SaleInstallment[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioDoSistema[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mes, setMes] = useState<Date>(inicioDoMes())

  const hoje = toDateOnly(new Date())

  const recarregar = useCallback(async () => {
    setErro(null)
    const empresa = await supabase
      .from('companies')
      .select('*')
      .eq('slug', 'imobiliaria')
      .maybeSingle()

    if (empresa.error || !empresa.data) {
      setErro('Não foi possível carregar a imobiliária. Verifique sua conexão.')
      return
    }
    const cid = (empresa.data as Company).id

    const [vendasRes, parcelasRes, txRes, contasRes, contatosRes, catsRes, ccRes, trfRes, perfisRes] =
      await Promise.all([
        supabase.from('sales').select('*').eq('company_id', cid).order('sale_date', { ascending: false }),
        supabase.from('sale_installments').select('*').order('idx'),
        supabase.from('transactions').select('*').eq('company_id', cid).order('competence_date', { ascending: false }),
        supabase.from('accounts').select('*').eq('company_id', cid).order('sort_order'),
        supabase.from('contacts').select('*').order('name'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('cost_centers').select('*').eq('company_id', cid).order('name'),
        supabase.from('transfers').select('*').order('date', { ascending: false }),
        supabase.from('profiles').select('*'),
      ])

    const primeiroErro =
      vendasRes.error || parcelasRes.error || txRes.error || contasRes.error || contatosRes.error
    if (primeiroErro) {
      // Tabela de venda ausente = migrações 007-011 ainda não aplicadas. A
      // mensagem diz exatamente isso, em vez de "erro ao carregar".
      const faltaEstrutura = /sales|sale_installments|profiles/.test(primeiroErro.message)
      setErro(
        faltaEstrutura
          ? 'O banco ainda não tem a estrutura de vendas. Aplique as migrações 007 a 011 no SQL Editor do Supabase.'
          : 'Não foi possível carregar os dados. Verifique sua conexão.',
      )
      return
    }

    setCompany({ ...(empresa.data as Company), tax_rate: empresa.data.tax_rate == null ? null : num(empresa.data.tax_rate) })
    setSales(
      ((vendasRes.data as Sale[]) ?? []).map((s) => ({
        ...s,
        property_value: s.property_value == null ? null : num(s.property_value),
        commission_pct: s.commission_pct == null ? null : num(s.commission_pct),
        commission_total: num(s.commission_total),
        partner_share_pct: s.partner_share_pct == null ? null : num(s.partner_share_pct),
        simples_pct: num(s.simples_pct),
        iss_pct: num(s.iss_pct),
        broker_pct: s.broker_pct == null ? null : num(s.broker_pct),
        owner_profit_pct: s.owner_profit_pct == null ? null : num(s.owner_profit_pct),
      })),
    )
    const idsDeVenda = new Set(((vendasRes.data as Sale[]) ?? []).map((s) => s.id))
    setInstallments(
      ((parcelasRes.data as SaleInstallment[]) ?? [])
        .filter((i) => idsDeVenda.has(i.sale_id))
        .map((i) => ({
          ...i,
          amount: num(i.amount),
          iss_amount: num(i.iss_amount),
          simples_amount: num(i.simples_amount),
          broker_amount: num(i.broker_amount),
          broker_adjustment: num(i.broker_adjustment),
          owner_amount: num(i.owner_amount),
          net_amount: num(i.net_amount),
          received_amount: i.received_amount == null ? null : num(i.received_amount),
        })),
    )
    setTransactions(
      ((txRes.data as Transaction[]) ?? []).map((t) => ({
        ...t,
        amount: num(t.amount),
        property_value: t.property_value == null ? null : num(t.property_value),
        commission_pct: t.commission_pct == null ? null : num(t.commission_pct),
        broker_pct: t.broker_pct == null ? null : num(t.broker_pct),
      })),
    )
    setAccounts(
      ((contasRes.data as Account[]) ?? []).map((a) => ({
        ...a,
        opening_balance: num(a.opening_balance),
        card_limit: a.card_limit == null ? null : num(a.card_limit),
      })),
    )
    setContacts((contatosRes.data as Contact[]) ?? [])
    setCategories((catsRes.data as Category[]) ?? [])
    setCostCenters((ccRes.data as CostCenter[]) ?? [])
    setTransfers(((trfRes.data as Transfer[]) ?? []).map((t) => ({ ...t, amount: num(t.amount) })))

    // E-mail e último acesso ficam em auth.users, que o app não lê. O perfil
    // basta para a tela de acesso; o e-mail aparece quando o próprio perfil o
    // guarda (é o que o convite grava).
    setUsuarios(
      ((perfisRes.data as Profile[]) ?? []).map((p) => ({
        ...p,
        email: null,
        ultimoAcesso: null,
      })),
    )
  }, [])

  useEffect(() => {
    setCarregando(true)
    recarregar().finally(() => setCarregando(false))
  }, [recarregar])

  // ---------------------------------------------------------------- derivados
  const vendas = useMemo(
    () => buildSaleViews({ sales, installments, costCenters, contacts, transactions, today: hoje }),
    [sales, installments, costCenters, contacts, transactions, hoje],
  )
  const receber = useMemo(() => receivablesOf(transactions, vendas, hoje), [transactions, vendas, hoje])
  const pagar = useMemo(() => payablesOf(transactions, vendas, hoje), [transactions, vendas, hoje])
  const atencao = useMemo(() => attentionOf({ vendas, receber, pagar, today: hoje }), [vendas, receber, pagar, hoje])
  const contatosComAcesso = useMemo(
    () => new Set(usuarios.filter((u) => u.is_active && u.contact_id).map((u) => u.contact_id as string)),
    [usuarios],
  )

  // ---------------------------------------------------------------- mutações
  const chamar = useCallback(
    async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) throw new Error(traduzirErro(error.message))
      await recarregar()
      return data
    },
    [recarregar],
  )

  const value = useMemo<AdminValue>(
    () => ({
      company,
      sales,
      installments,
      transactions,
      accounts,
      contacts,
      categories,
      costCenters,
      transfers,
      usuarios,
      vendas,
      receber,
      pagar,
      atencao,
      contatosComAcesso,
      mes,
      hoje,
      irParaMes: (d) => setMes(inicioDoMes(d)),
      mesAnterior: () => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)),
      mesSeguinte: () => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)),
      carregando,
      erro,
      recarregar,

      async registrarVenda(venda) {
        const id = await chamar('register_sale', { p: venda })
        return String(id)
      },
      async receberParcela({ installmentId, date, accountId, received, iss, other, note }) {
        await chamar('receive_installment', {
          p_installment: installmentId,
          p_date: date,
          p_account: accountId,
          p_received: received ?? null,
          p_iss: iss ?? null,
          p_other: other ?? 0,
          p_note: note ?? null,
        })
      },
      async desfazerRecebimento(installmentId) {
        await chamar('undo_receive_installment', { p_installment: installmentId })
      },
      async pagarComissoes({ installmentIds, date, accountId, adjustment, note }) {
        await chamar('pay_broker_installments', {
          p_ids: installmentIds,
          p_date: date,
          p_account: accountId,
          p_adjustment: adjustment ?? 0,
          p_note: note ?? null,
        })
      },
      async reagendarParcela(installmentId, novaData, nota) {
        await chamar('reschedule_installment', {
          p_installment: installmentId,
          p_new_date: novaData,
          p_note: nota ?? null,
        })
      },
      async cancelarVenda(saleId, nota) {
        await chamar('cancel_sale', { p_sale: saleId, p_note: nota ?? null })
      },
      async editarVenda(saleId, dados) {
        const { error } = await supabase.from('sales').update(dados).eq('id', saleId)
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },

      async criarLancamento(t) {
        if (!company) throw new Error('Empresa não carregada.')
        const { error } = await supabase.from('transactions').insert({ ...t, company_id: company.id })
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
      async baixarLancamento(id, date, accountId) {
        const { error } = await supabase
          .from('transactions')
          .update({ status: 'settled', settled_date: date, due_date: null, account_id: accountId })
          .eq('id', id)
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
      async estornarLancamento(id, dueDate) {
        const { error } = await supabase
          .from('transactions')
          .update({ status: 'pending', settled_date: null, due_date: dueDate, account_id: null })
          .eq('id', id)
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
      async excluirLancamento(id) {
        const { error } = await supabase.from('transactions').delete().eq('id', id)
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },

      async salvarContato(c) {
        const { id, ...resto } = c
        const q = id
          ? supabase.from('contacts').update(resto).eq('id', id).select().single()
          : supabase
              .from('contacts')
              .insert({ type: 'broker', is_active: true, ...resto })
              .select()
              .single()
        const { data, error } = await q
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
        return data as Contact
      },
      async salvarConta(c) {
        if (!company) throw new Error('Empresa não carregada.')
        const { id, ...resto } = c
        const { error } = id
          ? await supabase.from('accounts').update(resto).eq('id', id)
          : await supabase.from('accounts').insert({ company_id: company.id, ...resto })
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
      async salvarEmpreendimento(c) {
        if (!company) throw new Error('Empresa não carregada.')
        const { id, ...resto } = c
        const { error } = id
          ? await supabase.from('cost_centers').update(resto).eq('id', id)
          : await supabase.from('cost_centers').insert({ company_id: company.id, is_active: true, ...resto })
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
      async salvarCategoria(c) {
        if (!company) throw new Error('Empresa não carregada.')
        const { id, ...resto } = c
        const { error } = id
          ? await supabase.from('categories').update(resto).eq('id', id)
          : await supabase.from('categories').insert({ company_id: company.id, sort_order: 99, ...resto })
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
      async salvarImposto(regime, aliquota) {
        if (!company) throw new Error('Empresa não carregada.')
        const { error } = await supabase
          .from('companies')
          .update({ tax_regime: regime, tax_rate: aliquota })
          .eq('id', company.id)
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
      async salvarAcesso({ userId, role, contactId, name, isActive }) {
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: userId, role, contact_id: contactId, name, is_active: isActive })
        if (error) throw new Error(traduzirErro(error.message))
        await recarregar()
      },
    }),
    [
      company, sales, installments, transactions, accounts, contacts, categories, costCenters,
      transfers, usuarios, vendas, receber, pagar, atencao, contatosComAcesso, mes, hoje,
      carregando, erro, recarregar, chamar,
    ],
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin deve ser usado dentro de <AdminDataProvider>')
  return ctx
}

/**
 * As funções do banco levantam exceção com texto em português pensado para o
 * usuário ("As parcelas somam X e a comissão é Y"). O supabase-js embrulha
 * isso; aqui a mensagem volta a ser a que a função escreveu.
 */
function traduzirErro(msg: string): string {
  const limpa = msg.replace(/^.*?(?:ERROR|error):\s*/i, '').trim()
  if (/permission denied|row-level security/i.test(limpa)) {
    return 'Seu acesso não permite esta ação.'
  }
  if (/duplicate key|unique/i.test(limpa)) return 'Esse registro já existe.'
  if (/violates foreign key/i.test(limpa)) {
    return 'Há registros ligados a este item — desative em vez de excluir.'
  }
  if (/could not find the function|does not exist/i.test(limpa)) {
    return 'O banco ainda não tem as funções de venda. Aplique as migrações 007 a 011.'
  }
  return limpa || 'Não deu para completar a ação.'
}
