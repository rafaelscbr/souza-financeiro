import { toDateOnly } from '@/lib/format'
import type {
  Account,
  Category,
  Company,
  Contact,
  CostCenter,
  Developer,
  DreGroup,
  Sale,
  SaleInstallment,
  Transaction,
  TransactionKind,
  Transfer,
} from '@/types'
import type { UsuarioDoSistema } from '@/admin/AdminData'

/**
 * DADOS DE EXEMPLO DA VITRINE.
 *
 * Todo nome tem "Exemplo". As datas são relativas a hoje, para as situações
 * (vencida, liberada, prevista com data passada) continuarem verdadeiras em
 * qualquer dia em que a vitrine abrir.
 *
 * Este arquivo só GRAVA as linhas como o banco gravaria (a cascata de cada
 * parcela segue a função register_sale da migração 009: ISS sobre a parcela
 * se a construtora retém, Simples sobre a parcela menos ISS, corretor sobre o
 * que sobra). Tudo que é derivado — vendas com cascata, a receber, a pagar,
 * atenção — sai das funções de src/lib, em DemoApp.
 */

const CRIADO = '2026-01-01T12:00:00Z'
export const EMPRESA_ID = 'exemplo-imobiliaria'

export function dia(deslocamento: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + deslocamento)
  return toDateOnly(d)
}

/**
 * Vencimento do DAS do mês da data: dia 20 do mês seguinte, adiado para
 * segunda quando cai no fim de semana. Espelha `venc_das` do banco (027).
 */
function vencDas(data: string): string {
  const [a, m] = data.split('-').map(Number)
  const d = new Date(a, m, 20)
  if (d.getDay() === 6) d.setDate(d.getDate() + 2)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return toDateOnly(d)
}

/*
 * A GUIA DO MÊS (027). O Simples de parcela recebida não é linha de parcela:
 * ele se junta ao de todas as outras parcelas que entraram no mesmo mês, numa
 * guia só. Aqui o acumulador faz o que `sincroniza_das` faz no banco.
 */
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const guiaDoMes = new Map<string, { total: number; paga: boolean }>()
function somarNaGuia(dataRec: string, valor: number, paga: boolean) {
  const comp = `${dataRec.slice(0, 7)}-01`
  const g = guiaDoMes.get(comp) ?? { total: 0, paga: true }
  g.total = r2(g.total + valor)
  // A guia só está paga quando todo o mês está pago.
  g.paga = g.paga && paga
  guiaDoMes.set(comp, g)
}

const r2 = (n: number) => Math.round(n * 100) / 100

export const company: Company = {
  id: EMPRESA_ID,
  slug: 'imobiliaria',
  name: 'Imobiliária Exemplo',
  brand_color: 'rgb(30, 58, 138)',
  accent_color: 'rgb(228, 178, 60)',
  sort_order: 1,
  is_personal: false,
  tax_regime: 'simples',
  tax_rate: 6,
  created_at: CRIADO,
}

export const developers: Developer[] = [
  { id: 'dev-alfa', company_id: EMPRESA_ID, name: 'Construtora Exemplo Alfa', payment_days: 10, payment_days_business: true, notes: null, is_active: true, created_at: CRIADO },
  { id: 'dev-beta', company_id: EMPRESA_ID, name: 'Incorporadora Exemplo Beta', payment_days: 15, payment_days_business: false, notes: null, is_active: true, created_at: CRIADO },
  { id: 'dev-gama', company_id: EMPRESA_ID, name: 'Construtora Exemplo Gama', payment_days: null, payment_days_business: true, notes: null, is_active: true, created_at: CRIADO },
]

export const costCenters: CostCenter[] = [
  { id: 'cc-mar', company_id: EMPRESA_ID, name: 'Residencial Exemplo Mar', developer: 'Construtora Exemplo Alfa', developer_id: 'dev-alfa', trigger_note: '50% da comissão quando o cliente paga 5% do valor do imóvel; 50% ao atingir 8%.', is_active: true, created_at: CRIADO },
  { id: 'cc-parque', company_id: EMPRESA_ID, name: 'Torre Exemplo Parque', developer: 'Incorporadora Exemplo Beta', developer_id: 'dev-beta', trigger_note: 'Comissão integral quando o cliente paga 10% do valor do imóvel.', is_active: true, created_at: CRIADO },
  { id: 'cc-vista', company_id: EMPRESA_ID, name: 'Vista Exemplo Center', developer: 'Construtora Exemplo Gama', developer_id: 'dev-gama', trigger_note: null, is_active: true, created_at: CRIADO },
]

function contato(id: string, name: string, type: Contact['type'], extra: Partial<Contact> = {}): Contact {
  return { id, type, name, document: null, phone: null, email: null, notes: null, is_active: true, created_at: CRIADO, ...extra }
}

export const CORRETORA_ID = 'ct-ana'
export const contacts: Contact[] = [
  contato(CORRETORA_ID, 'Ana Corretora Exemplo', 'broker', { phone: '(47) 90000-0001' }),
  contato('ct-bruno', 'Bruno Corretor Exemplo', 'broker', { phone: '(47) 90000-0002' }),
  contato('ct-contab', 'Contabilidade Exemplo', 'supplier'),
  contato('ct-sala', 'Locadora Exemplo', 'supplier'),
]

function conta(id: string, name: string, type: Account['type'], saldo: number, ordem: number, color: string): Account {
  return {
    id, company_id: EMPRESA_ID, name, type, bank: 'Banco Exemplo', opening_balance: saldo,
    opening_date: dia(-240), color, is_active: true, sort_order: ordem,
    card_closing_day: null, card_due_day: null, card_limit: null, created_at: CRIADO,
  }
}

export const accounts: Account[] = [
  conta('ac-pj', 'Conta Exemplo PJ', 'checking', 18500, 1, 'rgb(30, 58, 138)'),
  conta('ac-reserva', 'Reserva Exemplo', 'savings', 42000, 2, 'rgb(228, 178, 60)'),
]

function categoria(id: string, name: string, kind: TransactionKind, dre: DreGroup, ordem: number): Category {
  return { id, company_id: EMPRESA_ID, kind, name, dre_group: dre, is_recurring_default: false, sort_order: ordem, icon: null, color: null, created_at: CRIADO }
}

export const categories: Category[] = [
  categoria('cat-receita', 'Comissões de Venda', 'income', 'revenue', 1),
  categoria('cat-corretor', 'Comissões de Corretores', 'expense', 'cost_of_sale', 2),
  categoria('cat-imposto', 'Impostos e Taxas', 'expense', 'variable_expense', 3),
  categoria('cat-aluguel', 'Aluguel', 'expense', 'operating_expense', 4),
  categoria('cat-contab', 'Contabilidade', 'expense', 'operating_expense', 5),
  categoria('cat-marketing', 'Marketing', 'expense', 'operating_expense', 6),
  categoria('cat-ferramentas', 'Ferramentas/Assinaturas', 'expense', 'operating_expense', 7),
  categoria('cat-lucro', 'Distribuição de Lucro', 'withdrawal', 'withdrawal', 8),
]

export const transfers: Transfer[] = [
  { id: 'tr-1', from_account_id: 'ac-pj', to_account_id: 'ac-reserva', amount: 5000, date: dia(-35), description: 'Reserva do mês (exemplo)', created_at: CRIADO },
]

export const usuarios: UsuarioDoSistema[] = [
  { id: 'us-admin', role: 'admin', contact_id: null, name: 'Rafael Exemplo', is_active: true, email: 'admin@exemplo.local', ultimoAcesso: null },
  { id: 'us-ana', role: 'corretor', contact_id: CORRETORA_ID, name: 'Corretor Exemplo', is_active: true, email: 'ana@exemplo.local', ultimoAcesso: null },
]

// ---------------------------------------------------------------------------
// Lançamentos e vendas, gravados como o banco gravaria
// ---------------------------------------------------------------------------

export const transactions: Transaction[] = []

function lancar(t: Partial<Transaction> & Pick<Transaction, 'id' | 'kind' | 'category' | 'description' | 'amount' | 'competence_date' | 'status'>) {
  transactions.push({
    company_id: EMPRESA_ID, dre_group: null, settled_date: null, due_date: null, is_recurring: false,
    contact_id: null, counterparty: null, property_value: null, commission_pct: null, broker_pct: null,
    group_id: null, installment_index: null, installment_count: null, account_id: null,
    cost_center_id: null, card_cycle_month: null, sale_id: null, sale_installment_id: null,
    created_at: CRIADO, updated_at: CRIADO,
    ...t,
  })
  return t.id
}

interface PlanoParcela {
  /** Vencimento combinado, em dias a partir de hoje. */
  dias: number
  estado: 'prevista' | 'recebida' | 'cancelada'
  /** Recebida em (dias a partir de hoje). */
  recebidaEm?: number
  corretorPago?: boolean
  simplesPago?: boolean
  /** Desconto combinado com o corretor no pagamento. */
  desconto?: number
}

interface PlanoVenda {
  id: string
  title: string
  cc: string
  unit: string
  cliente: string
  vendaEm: number
  vgv: number | null
  pctComissao: number | null
  comissao: number
  retemIss: boolean
  corretor: string | null
  pctCorretor: number | null
  status: Sale['status']
  /** Venda do Rafael como pessoa física: fora do razão da imobiliária. */
  pf?: boolean
  notes?: string
  parcelas: PlanoParcela[]
}

export const sales: Sale[] = []
export const installments: SaleInstallment[] = []

function venda(p: PlanoVenda) {
  const s: Sale = {
    id: p.id, company_id: EMPRESA_ID, title: p.title, cost_center_id: p.cc, unit: p.unit, client_name: p.cliente,
    sale_date: dia(p.vendaEm), property_value: p.vgv, commission_pct: p.pctComissao, commission_total: p.comissao,
    partner_name: null, partner_share_pct: null,
    issues_invoice: !p.pf, simples_pct: p.pf ? 0 : 6, retains_iss: !p.pf && p.retemIss,
    iss_pct: !p.pf && p.retemIss ? 3 : 0,
    broker_id: p.pf ? null : p.corretor, broker_pct: p.pf ? null : p.pctCorretor, owner_profit_pct: null,
    status: p.status, is_personal: !!p.pf,
    notes: p.notes ?? null, legacy_group_id: null, created_at: CRIADO, updated_at: CRIADO,
  }
  sales.push(s)
  const n = p.parcelas.length
  const nomeCorretor = contacts.find((c) => c.id === p.corretor)?.name ?? 'corretor'
  const valores = p.parcelas.map((_, k) => (k < n - 1 ? r2(p.comissao / n) : r2(p.comissao - r2(p.comissao / n) * (n - 1))))

  p.parcelas.forEach((pp, k) => {
    const idx = k + 1
    const iid = `${p.id}-p${idx}`
    const amount = valores[k]
    const iss = s.retains_iss ? r2((amount * s.iss_pct) / 100) : 0
    const simples = r2(((amount - iss) * s.simples_pct) / 100)
    const broker = !p.pf && p.corretor && p.pctCorretor != null ? r2(((amount - iss - simples) * p.pctCorretor) / 100) : 0
    const venc = dia(pp.dias)
    const recebida = pp.estado === 'recebida'
    const dataRec = recebida ? dia(pp.recebidaEm ?? pp.dias) : null
    const sufixo = n > 1 ? ` — Pc ${idx}/${n}` : ''
    const base = {
      group_id: s.id, installment_index: n > 1 ? idx : null, installment_count: n > 1 ? n : null,
      cost_center_id: s.cost_center_id, sale_id: s.id, sale_installment_id: iid, competence_date: s.sale_date,
    }
    const inst: SaleInstallment = {
      id: iid, sale_id: s.id, idx, count: n, expected_date: venc, amount, iss_amount: iss, simples_amount: simples,
      broker_amount: broker, broker_adjustment: pp.desconto ?? 0, owner_amount: 0,
      net_amount: r2(amount - iss - simples - broker), status: pp.estado, received_date: dataRec,
      received_amount: recebida ? r2(amount - iss) : null, account_id: recebida ? 'ac-pj' : null, notes: null,
      trigger_note: null,
      // Marcos de exemplo: a 1ª parcela prevista de cada venda já teve o
      // gatilho atingido, e a 2ª já está com a nota emitida.
      // Venda de pessoa física não tem gatilho nem nota da imobiliária.
      trigger_met_date: p.pf ? null : recebida ? dia(pp.dias - 20) : idx <= 2 ? dia(pp.dias - 12) : null,
      invoice_issued_date: p.pf ? null : recebida ? dia(pp.dias - 10) : idx === 2 ? dia(pp.dias - 6) : null,
      invoice_number: null,
      revenue_tx_id: null, iss_tx_id: null, simples_tx_id: null, broker_tx_id: null, owner_tx_id: null, other_tx_id: null,
    }
    installments.push(inst)
    // Parcela cancelada: o cancel_sale apaga os lançamentos pendentes.
    if (pp.estado === 'cancelada') return
    // Venda de pessoa física não escreve no razão da imobiliária (026).
    if (p.pf) return

    inst.revenue_tx_id = lancar({
      ...base, id: `${iid}-rec`, kind: 'income', category: 'Comissões de Venda', dre_group: 'revenue',
      description: `${s.title}${sufixo}`, amount, counterparty: s.client_name, property_value: s.property_value,
      commission_pct: s.commission_pct, broker_pct: s.broker_pct,
      status: recebida ? 'settled' : 'pending', settled_date: dataRec, due_date: recebida ? null : venc,
      account_id: recebida ? 'ac-pj' : null,
    })
    if (iss > 0) {
      inst.iss_tx_id = lancar({
        ...base, id: `${iid}-iss`, kind: 'expense', category: 'Impostos e Taxas', dre_group: 'variable_expense',
        description: `ISS retido na fonte ${s.iss_pct}% — ${s.title}${sufixo}`, amount: iss,
        status: recebida ? 'settled' : 'pending', settled_date: dataRec, due_date: recebida ? null : venc,
        account_id: recebida ? 'ac-pj' : null,
      })
    }
    if (recebida && dataRec) {
      // Recebida: o imposto vai para a guia do mês, não fica na parcela.
      if (simples > 0) somarNaGuia(dataRec, simples, !!pp.simplesPago)
    } else if (simples > 0) {
      // Ainda prevista: a previsão continua presa à venda que a gerou.
      inst.simples_tx_id = lancar({
        ...base, id: `${iid}-das`, kind: 'expense', category: 'Impostos e Taxas', dre_group: 'variable_expense',
        description: `Simples ${s.simples_pct}% — ${s.title}${sufixo}`, amount: simples,
        status: 'pending', settled_date: null, due_date: vencDas(venc), account_id: null,
      })
    }
    if (broker > 0) {
      const pago = recebida && pp.corretorPago
      inst.broker_tx_id = lancar({
        ...base, id: `${iid}-cor`, kind: 'expense', category: 'Comissões de Corretores', dre_group: 'cost_of_sale',
        description: `Comissão ${nomeCorretor} ${p.pctCorretor}% — ${s.title}${sufixo}${pp.desconto ? ` (desconto de ${pp.desconto})` : ''}`,
        amount: pago ? r2(broker - (pp.desconto ?? 0)) : broker, contact_id: p.corretor, broker_pct: p.pctCorretor,
        status: pago ? 'settled' : 'pending', settled_date: pago && dataRec ? dia((pp.recebidaEm ?? pp.dias) + 5) : null,
        due_date: pago ? null : recebida ? dataRec : venc, account_id: pago ? 'ac-pj' : null,
      })
    }
  })
}

/** Id da venda de exemplo mais completa (use em #/vendas/:id). */
export const VENDA_EXEMPLO = 'venda-exemplo-mar-1204'

// 1. Três parcelas: recebida e paga, recebida com comissão liberada, prevista.
venda({
  id: VENDA_EXEMPLO, title: 'Residencial Exemplo Mar — 1204', cc: 'cc-mar', unit: '1204', cliente: 'Cliente Exemplo Um',
  vendaEm: -150, vgv: 850000, pctComissao: 4, comissao: 34000, retemIss: true, corretor: CORRETORA_ID, pctCorretor: 40,
  status: 'ativa',
  parcelas: [
    { dias: -120, estado: 'recebida', recebidaEm: -118, corretorPago: true, simplesPago: true },
    { dias: -40, estado: 'recebida', recebidaEm: -38 },
    { dias: 30, estado: 'prevista' },
  ],
})

// 2. Construtora sem retenção de ISS; uma parcela prevista com data passada.
venda({
  id: 'venda-exemplo-parque-803', title: 'Torre Exemplo Parque — 803', cc: 'cc-parque', unit: '803', cliente: 'Cliente Exemplo Dois',
  vendaEm: -70, vgv: 560000, pctComissao: 4, comissao: 22400, retemIss: false, corretor: 'ct-bruno', pctCorretor: 35,
  status: 'ativa',
  parcelas: [
    { dias: -18, estado: 'prevista' },
    { dias: 60, estado: 'prevista' },
  ],
})

// 3. Quatro parcelas, cobrindo recebida paga com desconto, liberada antiga,
//    prevista vencida há poucos dias e prevista futura.
venda({
  id: 'venda-exemplo-vista-1502', title: 'Vista Exemplo Center — 1502', cc: 'cc-vista', unit: '1502', cliente: 'Cliente Exemplo Três',
  vendaEm: -230, vgv: 1200000, pctComissao: 3, comissao: 36000, retemIss: true, corretor: CORRETORA_ID, pctCorretor: 40,
  status: 'ativa',
  parcelas: [
    { dias: -200, estado: 'recebida', recebidaEm: -198, corretorPago: true, simplesPago: true, desconto: 150 },
    { dias: -95, estado: 'recebida', recebidaEm: -90, simplesPago: true },
    { dias: -4, estado: 'prevista' },
    { dias: 90, estado: 'prevista' },
  ],
})

// 4. Parcela única, tudo pago: venda concluída.
venda({
  id: 'venda-exemplo-mar-305', title: 'Residencial Exemplo Mar — 305', cc: 'cc-mar', unit: '305', cliente: 'Cliente Exemplo Quatro',
  vendaEm: -100, vgv: 420000, pctComissao: 4, comissao: 16800, retemIss: true, corretor: 'ct-bruno', pctCorretor: 35,
  status: 'concluida',
  parcelas: [{ dias: -60, estado: 'recebida', recebidaEm: -58, corretorPago: true, simplesPago: true }],
})

// 5. Cancelada depois da primeira parcela.
venda({
  id: 'venda-exemplo-parque-1101', title: 'Torre Exemplo Parque — 1101', cc: 'cc-parque', unit: '1101', cliente: 'Cliente Exemplo Cinco',
  vendaEm: -180, vgv: 610000, pctComissao: 4, comissao: 24400, retemIss: false, corretor: CORRETORA_ID, pctCorretor: 40,
  status: 'cancelada', notes: 'cancelada (exemplo): distrato do cliente',
  parcelas: [
    { dias: -150, estado: 'recebida', recebidaEm: -149, corretorPago: true, simplesPago: true },
    { dias: -20, estado: 'cancelada' },
  ],
})

// 6. Venda direta (sem corretor), VGV não informado, só previsão.
venda({
  id: 'venda-exemplo-vista-402', title: 'Vista Exemplo Center — 402', cc: 'cc-vista', unit: '402', cliente: 'Cliente Exemplo Seis',
  vendaEm: -3, vgv: null, pctComissao: null, comissao: 15000, retemIss: true, corretor: null, pctCorretor: null,
  status: 'ativa',
  parcelas: [
    { dias: 15, estado: 'prevista' },
    { dias: 45, estado: 'prevista' },
  ],
})

// 7. Venda feita antes da imobiliária: a comissão entra para o Rafael como
//    pessoa física. Nenhum lançamento no razão da empresa.
venda({
  id: 'venda-exemplo-pf-902', title: 'Recanto Exemplo Sul — 902', cc: 'cc-parque', unit: '902', cliente: 'Cliente Exemplo Sete',
  vendaEm: -240, vgv: 480000, pctComissao: 3, comissao: 14400, retemIss: false, corretor: null, pctCorretor: null,
  status: 'ativa', pf: true,
  notes: 'Venda feita quando o Rafael ainda estava em outra imobiliária: a comissão entra para ele como pessoa física.',
  parcelas: [
    { dias: -60, estado: 'recebida', recebidaEm: -58 },
    { dias: 55, estado: 'prevista' },
  ],
})

// As guias do Simples, uma por mês, depois de todas as vendas lançadas.
for (const [comp, g] of [...guiaDoMes.entries()].sort()) {
  const mes = MESES[Number(comp.slice(5, 7)) - 1]
  lancar({
    id: `das-${comp.slice(0, 7)}`, kind: 'expense', category: 'Impostos e Taxas', dre_group: 'variable_expense',
    description: `DAS Simples — ${mes}/${comp.slice(0, 4)}`, amount: g.total,
    competence_date: comp, status: g.paga ? 'settled' : 'pending',
    settled_date: g.paga ? vencDas(comp) : null, due_date: g.paga ? null : vencDas(comp),
    account_id: g.paga ? 'ac-pj' : null,
  })
}

// ---------------------------------------------------------------------------
// Despesas da estrutura: pagas, vencidas e a vencer
// ---------------------------------------------------------------------------

function despesa(id: string, description: string, category: string, amount: number, data: number, paga: boolean, contact: string | null = null) {
  lancar({
    id, kind: 'expense', category, dre_group: 'operating_expense', description, amount,
    competence_date: dia(data), status: paga ? 'settled' : 'pending',
    settled_date: paga ? dia(data) : null, due_date: paga ? null : dia(data),
    account_id: paga ? 'ac-pj' : null, contact_id: contact, is_recurring: category === 'Aluguel',
  })
}

for (const m of [-90, -60, -30]) {
  despesa(`dp-aluguel${m}`, 'Aluguel da sala (exemplo)', 'Aluguel', 2800, m, true, 'ct-sala')
  despesa(`dp-contab${m}`, 'Honorários Contabilidade Exemplo', 'Contabilidade', 650, m + 2, true, 'ct-contab')
}
despesa('dp-aluguel-0', 'Aluguel da sala (exemplo)', 'Aluguel', 2800, -1, true, 'ct-sala')
despesa('dp-marketing-pago', 'Anúncios Exemplo', 'Marketing', 1200, -8, true)
despesa('dp-crm-vencida', 'Assinatura CRM Exemplo', 'Ferramentas/Assinaturas', 389.9, -6, false)
despesa('dp-contab-vencida', 'Honorários Contabilidade Exemplo', 'Contabilidade', 650, -2, false, 'ct-contab')
despesa('dp-marketing-avencer', 'Anúncios Exemplo', 'Marketing', 1500, 5, false)
despesa('dp-aluguel-avencer', 'Aluguel da sala (exemplo)', 'Aluguel', 2800, 29, false, 'ct-sala')

/*
 * Compras da imobiliária no cartão pessoal do Rafael: duas parceladas, uma
 * fatura por mês. Na tela de A pagar elas viram UMA linha por mês, que abre o
 * detalhe — é o caso que fez essa regra existir.
 */
for (const k of [0, 1, 2, 3]) {
  despesa(`dp-cartao-crm${k}`, `Assinatura CRM Exemplo (${k + 7}/12) — cartão pessoal do Rafael`, 'Ferramentas/Assinaturas', 249.5, 4 + k * 30, false)
  despesa(`dp-cartao-note${k}`, `Notebook Exemplo (${k + 9}/18) — cartão pessoal do Rafael`, 'Material de Escritório', 164, 6 + k * 30, false)
}
