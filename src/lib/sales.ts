import { toDateOnly } from './format'
import type {
  BrokerStatus,
  Contact,
  CostCenter,
  Sale,
  SaleInstallment,
  Transaction,
  TransactionStatus,
} from '@/types'

/**
 * A leitura da venda para as telas.
 *
 * A conta do dinheiro mora no banco (migração 009) e os valores chegam aqui
 * GRAVADOS, parcela por parcela. Este arquivo não recalcula imposto nem
 * comissão: só soma, classifica e ordena. A razão é concreta — a regra de
 * imposto mudou entre janeiro e agosto de 2026 (antes 6% sobre o bruto, depois
 * ISS retido 3% + 6% sobre o líquido) e uma comissão foi paga com desconto
 * combinado. Recalcular na tela reescreveria o passado a cada mudança de regra.
 */

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function soma(lista: number[]): number {
  return r2(lista.reduce((s, v) => s + v, 0))
}

// ---------------------------------------------------------------------------
// Situação
// ---------------------------------------------------------------------------

/**
 * Situação da comissão do corretor numa parcela — a mesma regra da função
 * `broker_status` do banco, para as duas telas dizerem a mesma coisa:
 *
 * · prevista → a imobiliária ainda não recebeu
 * · liberada → a imobiliária recebeu e ainda não pagou o corretor
 * · recebida → já foi paga a ele
 */
export function brokerStatusOf(
  inst: SaleInstallment,
  statusPorTx: Map<string, TransactionStatus>,
): BrokerStatus {
  if (inst.status === 'cancelada') return 'cancelada'
  if (inst.status === 'prevista') return 'prevista'
  if (inst.broker_tx_id && statusPorTx.get(inst.broker_tx_id) === 'settled') return 'recebida'
  return 'liberada'
}

/** Vencida: prevista e a data já passou. */
export function isOverdue(inst: SaleInstallment, hoje: string): boolean {
  return inst.status === 'prevista' && inst.expected_date < hoje
}

// ---------------------------------------------------------------------------
// A cascata
// ---------------------------------------------------------------------------

export interface Cascade {
  /** Comissão bruta da imobiliária (só a parte dela, em parceria). */
  commission: number
  iss: number
  simples: number
  broker: number
  brokerAdjustment: number
  owner: number
  /** Comissão − impostos − corretor − sócio. */
  net: number
  /** Fatia da comissão que fica com a imobiliária (0–1). */
  netShare: number
}

export function cascadeOf(installments: SaleInstallment[]): Cascade {
  const vivas = installments.filter((i) => i.status !== 'cancelada')
  const commission = soma(vivas.map((i) => i.amount))
  const iss = soma(vivas.map((i) => i.iss_amount))
  const simples = soma(vivas.map((i) => i.simples_amount))
  const brokerAdjustment = soma(vivas.map((i) => i.broker_adjustment))
  const broker = r2(soma(vivas.map((i) => i.broker_amount)) - brokerAdjustment)
  const owner = soma(vivas.map((i) => i.owner_amount))
  const net = r2(commission - iss - simples - broker - owner)
  return {
    commission,
    iss,
    simples,
    broker,
    brokerAdjustment,
    owner,
    net,
    netShare: commission > 0 ? net / commission : 0,
  }
}

// ---------------------------------------------------------------------------
// A venda pronta para a tela
// ---------------------------------------------------------------------------

export interface SaleView extends Sale {
  installments: SaleInstallment[]
  development: string | null
  developer: string | null
  brokerName: string | null
  cascade: Cascade
  /** Comissão já recebida pela imobiliária. */
  received: number
  toReceive: number
  /** Comissão do corretor ainda a pagar (liberada + prevista). */
  brokerToPay: number
  brokerReleased: number
  brokerPaid: number
  /** Imposto desta venda ainda a pagar. */
  taxToPay: number
  progress: number
  hasOverdue: boolean
  nextDate: string | null
}

export function buildSaleViews(params: {
  sales: Sale[]
  installments: SaleInstallment[]
  costCenters: CostCenter[]
  contacts: Contact[]
  transactions: Transaction[]
  today?: string
}): SaleView[] {
  const { sales, installments, costCenters, contacts, transactions } = params
  const hoje = params.today ?? toDateOnly(new Date())

  const porVenda = new Map<string, SaleInstallment[]>()
  for (const i of installments) {
    const a = porVenda.get(i.sale_id)
    if (a) a.push(i)
    else porVenda.set(i.sale_id, [i])
  }
  const statusPorTx = new Map<string, TransactionStatus>()
  const valorPorTx = new Map<string, number>()
  for (const t of transactions) {
    statusPorTx.set(t.id, t.status)
    valorPorTx.set(t.id, t.amount)
  }
  const cc = new Map(costCenters.map((c) => [c.id, c]))
  const ct = new Map(contacts.map((c) => [c.id, c]))

  return sales
    .map<SaleView>((s) => {
      const parcelas = (porVenda.get(s.id) ?? []).sort((a, b) => a.idx - b.idx)
      const vivas = parcelas.filter((i) => i.status !== 'cancelada')
      const recebidas = vivas.filter((i) => i.status === 'recebida')
      const cascade = cascadeOf(parcelas)

      let brokerPaid = 0
      let brokerReleased = 0
      let brokerToPay = 0
      for (const i of vivas) {
        if (i.broker_amount <= 0) continue
        const st = brokerStatusOf(i, statusPorTx)
        // O valor pago é o que está no razão: pode ter saído com desconto.
        const pago = i.broker_tx_id ? valorPorTx.get(i.broker_tx_id) ?? i.broker_amount : i.broker_amount
        if (st === 'recebida') brokerPaid = r2(brokerPaid + pago)
        else if (st === 'liberada') {
          brokerReleased = r2(brokerReleased + i.broker_amount)
          brokerToPay = r2(brokerToPay + i.broker_amount)
        } else if (st === 'prevista') brokerToPay = r2(brokerToPay + i.broker_amount)
      }

      const taxToPay = soma(
        vivas.flatMap((i) =>
          [i.iss_tx_id, i.simples_tx_id]
            .filter((id): id is string => !!id && statusPorTx.get(id) === 'pending')
            .map((id) => valorPorTx.get(id) ?? 0),
        ),
      )

      const received = soma(recebidas.map((i) => i.amount))
      const pendentes = vivas.filter((i) => i.status === 'prevista')

      return {
        ...s,
        installments: parcelas,
        development: s.cost_center_id ? cc.get(s.cost_center_id)?.name ?? null : null,
        developer: s.cost_center_id ? cc.get(s.cost_center_id)?.developer ?? null : null,
        brokerName: s.broker_id ? ct.get(s.broker_id)?.name ?? null : null,
        cascade,
        received,
        toReceive: soma(pendentes.map((i) => i.amount)),
        brokerToPay,
        brokerReleased,
        brokerPaid,
        taxToPay,
        progress: cascade.commission > 0 ? received / cascade.commission : 0,
        hasOverdue: pendentes.some((i) => i.expected_date < hoje),
        nextDate: pendentes.map((i) => i.expected_date).sort()[0] ?? null,
      }
    })
    .sort((a, b) => (a.sale_date < b.sale_date ? 1 : a.sale_date > b.sale_date ? -1 : 0))
}

// ---------------------------------------------------------------------------
// Listas de dinheiro a entrar e a sair
// ---------------------------------------------------------------------------

/** De onde vem uma linha de "a pagar" — decide qual ação a tela oferece. */
export type PayableKind = 'comissao' | 'imposto' | 'despesa' | 'socio'

export interface MoneyItem {
  tx: Transaction
  date: string
  amount: number
  label: string
  /** Venda de origem, quando houver. */
  sale: SaleView | null
  installment: SaleInstallment | null
  overdue: boolean
  kind: PayableKind | 'comissao_venda' | 'outra_entrada'
  /** Comissão liberada = a imobiliária já recebeu a parcela. */
  released: boolean
}

function rotulo(t: Transaction, venda: SaleView | null, parcela: SaleInstallment | null): string {
  if (!venda) return t.description || t.category
  const pc = parcela && parcela.count > 1 ? ` · parcela ${parcela.idx}/${parcela.count}` : ''
  return `${venda.title}${pc}`
}

function indexar(vendas: SaleView[]) {
  const porId = new Map(vendas.map((v) => [v.id, v]))
  const parcelaPorId = new Map<string, SaleInstallment>()
  for (const v of vendas) for (const i of v.installments) parcelaPorId.set(i.id, i)
  return { porId, parcelaPorId }
}

/** O que ainda entra: parcelas de venda e outras receitas pendentes. */
export function receivablesOf(
  transactions: Transaction[],
  vendas: SaleView[],
  hoje = toDateOnly(new Date()),
): MoneyItem[] {
  const { porId, parcelaPorId } = indexar(vendas)
  return transactions
    .filter((t) => t.kind === 'income' && t.status === 'pending')
    .map((t) => {
      const venda = t.sale_id ? porId.get(t.sale_id) ?? null : null
      const parcela = t.sale_installment_id ? parcelaPorId.get(t.sale_installment_id) ?? null : null
      const date = t.due_date ?? t.competence_date
      return {
        tx: t,
        date,
        amount: t.amount,
        label: rotulo(t, venda, parcela),
        sale: venda,
        installment: parcela,
        overdue: date < hoje,
        kind: venda ? ('comissao_venda' as const) : ('outra_entrada' as const),
        released: false,
      }
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** O que sai: comissão liberada, imposto e despesa. */
export function payablesOf(
  transactions: Transaction[],
  vendas: SaleView[],
  hoje = toDateOnly(new Date()),
): MoneyItem[] {
  const { porId, parcelaPorId } = indexar(vendas)
  return transactions
    .filter((t) => t.kind !== 'income' && t.status === 'pending')
    .map((t) => {
      const venda = t.sale_id ? porId.get(t.sale_id) ?? null : null
      const parcela = t.sale_installment_id ? parcelaPorId.get(t.sale_installment_id) ?? null : null
      const date = t.due_date ?? t.competence_date
      const kind: PayableKind =
        t.category === 'Comissões de Corretores'
          ? 'comissao'
          : t.category === 'Impostos e Taxas'
            ? 'imposto'
            : t.kind === 'withdrawal'
              ? 'socio'
              : 'despesa'
      return {
        tx: t,
        date,
        amount: t.amount,
        label: rotulo(t, venda, parcela),
        sale: venda,
        installment: parcela,
        overdue: date < hoje,
        kind,
        /*
         * Devido de verdade é o que a imobiliária já deve. Comissão e imposto
         * de parcela que a construtora ainda não pagou são PREVISÃO — decisão
         * do Rafael em 21/09/2026, depois que a guia mensal do Simples (027)
         * deixou a diferença à vista: a tela dizia "imposto de parcela
         * recebida" e somava também o da parcela que não entrou.
         *
         * Lançamento de imposto sem parcela (a guia do mês, a despesa avulsa)
         * é devido: ele só existe porque o dinheiro já entrou.
         */
        released: kind === 'comissao' || kind === 'imposto' ? (parcela ? parcela.status === 'recebida' : true) : true,
      }
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

// ---------------------------------------------------------------------------
// O que precisa de atenção (bloco principal do Início)
// ---------------------------------------------------------------------------

export interface AttentionItem {
  id: string
  tone: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  amount: number
  /** Para onde a tela deve levar ao toque. */
  to: string
}

export function attentionOf(params: {
  vendas: SaleView[]
  receber: MoneyItem[]
  pagar: MoneyItem[]
  today?: string
}): AttentionItem[] {
  const hoje = params.today ?? toDateOnly(new Date())
  const itens: AttentionItem[] = []

  const vencidas = params.receber.filter((i) => i.overdue)
  for (const v of vencidas.slice(0, 4)) {
    const dias = Math.round((Date.parse(hoje) - Date.parse(v.date)) / 86400000)
    itens.push({
      id: `receber-${v.tx.id}`,
      tone: 'critical',
      title: v.label,
      detail: dias === 0 ? 'vence hoje' : `vencida há ${dias} dia${dias > 1 ? 's' : ''}`,
      amount: v.amount,
      to: v.sale ? `/vendas/${v.sale.id}` : '/receber',
    })
  }
  if (vencidas.length > 4) {
    itens.push({
      id: 'receber-mais',
      tone: 'critical',
      title: `mais ${vencidas.length - 4} parcela(s) vencida(s)`,
      detail: 'ver todas em A receber',
      amount: soma(vencidas.slice(4).map((v) => v.amount)),
      to: '/receber',
    })
  }

  const comissoes = params.pagar.filter((i) => i.kind === 'comissao' && i.released)
  const porCorretor = new Map<string, { nome: string; total: number; n: number }>()
  for (const c of comissoes) {
    const nome = c.sale?.brokerName ?? 'corretor'
    const e = porCorretor.get(nome) ?? { nome, total: 0, n: 0 }
    e.total = r2(e.total + c.amount)
    e.n += 1
    porCorretor.set(nome, e)
  }
  for (const [nome, e] of porCorretor) {
    itens.push({
      id: `comissao-${nome}`,
      tone: 'warning',
      title: `${nome}: comissão liberada`,
      detail: `${e.n} parcela${e.n > 1 ? 's' : ''} recebida${e.n > 1 ? 's' : ''} · a pagar`,
      amount: e.total,
      to: '/pagar',
    })
  }

  // Só o imposto que já é devido: previsão não precisa de atenção hoje.
  const impostos = params.pagar.filter((i) => i.kind === 'imposto' && i.released)
  if (impostos.length > 0) {
    const vencidos = impostos.filter((i) => i.overdue)
    itens.push({
      id: 'imposto',
      tone: vencidos.length > 0 ? 'critical' : 'info',
      title: 'Imposto a pagar',
      detail:
        vencidos.length > 0
          ? `${vencidos.length} guia(s) vencida(s)`
          : `próxima guia em ${impostos[0].date.slice(8, 10)}/${impostos[0].date.slice(5, 7)}`,
      amount: soma(impostos.map((i) => i.amount)),
      to: '/pagar',
    })
  }

  const despesas = params.pagar.filter((i) => (i.kind === 'despesa' || i.kind === 'socio') && i.overdue)
  if (despesas.length > 0) {
    itens.push({
      id: 'despesa-vencida',
      tone: 'warning',
      title: `${despesas.length} despesa(s) vencida(s)`,
      detail: 'ver em A pagar',
      amount: soma(despesas.map((d) => d.amount)),
      to: '/pagar',
    })
  }

  const ordem = { critical: 0, warning: 1, info: 2 }
  return itens.sort((a, b) => ordem[a.tone] - ordem[b.tone])
}

// ---------------------------------------------------------------------------
// Produção por corretor
// ---------------------------------------------------------------------------

export interface BrokerProduction {
  contact: Contact
  sales: number
  /** VGV das vendas em que o valor do imóvel foi informado. */
  vgv: number
  salesWithoutVgv: number
  commissionTotal: number
  paid: number
  released: number
  expected: number
  hasAccess: boolean
}

export function brokerProduction(params: {
  vendas: SaleView[]
  contacts: Contact[]
  comAcesso: Set<string>
  /** Só as vendas deste ano; `null` = todas. */
  year?: number | null
}): BrokerProduction[] {
  const { vendas, contacts, comAcesso } = params
  const ano = params.year ?? null

  return contacts
    .filter((c) => c.type === 'broker')
    .map<BrokerProduction>((contact) => {
      const minhas = vendas.filter(
        (v) =>
          v.broker_id === contact.id &&
          v.status !== 'cancelada' &&
          (ano === null || Number(v.sale_date.slice(0, 4)) === ano),
      )
      return {
        contact,
        sales: minhas.length,
        vgv: soma(minhas.map((v) => v.property_value ?? 0)),
        salesWithoutVgv: minhas.filter((v) => v.property_value == null).length,
        commissionTotal: soma(minhas.map((v) => r2(v.brokerPaid + v.brokerToPay))),
        paid: soma(minhas.map((v) => v.brokerPaid)),
        released: soma(minhas.map((v) => v.brokerReleased)),
        expected: soma(minhas.map((v) => r2(v.brokerToPay - v.brokerReleased))),
        hasAccess: comAcesso.has(contact.id),
      }
    })
    .filter((p) => p.sales > 0 || p.hasAccess)
    .sort((a, b) => b.commissionTotal - a.commissionTotal)
}

// ---------------------------------------------------------------------------
// Resultado por empreendimento
// ---------------------------------------------------------------------------

export interface DevelopmentResult {
  id: string | null
  name: string
  developer: string | null
  sales: number
  commission: number
  tax: number
  brokerCost: number
  net: number
  margin: number
}

export function developmentResults(vendas: SaleView[]): DevelopmentResult[] {
  const mapa = new Map<string, DevelopmentResult>()
  for (const v of vendas) {
    if (v.status === 'cancelada') continue
    const chave = v.cost_center_id ?? '—'
    const atual =
      mapa.get(chave) ??
      ({
        id: v.cost_center_id,
        name: v.development ?? 'Sem empreendimento',
        developer: v.developer,
        sales: 0,
        commission: 0,
        tax: 0,
        brokerCost: 0,
        net: 0,
        margin: 0,
      } satisfies DevelopmentResult)
    atual.sales += 1
    atual.commission = r2(atual.commission + v.cascade.commission)
    atual.tax = r2(atual.tax + v.cascade.iss + v.cascade.simples)
    atual.brokerCost = r2(atual.brokerCost + v.cascade.broker)
    atual.net = r2(atual.net + v.cascade.net)
    mapa.set(chave, atual)
  }
  return [...mapa.values()]
    .map((d) => ({ ...d, margin: d.commission > 0 ? d.net / d.commission : 0 }))
    .sort((a, b) => b.commission - a.commission)
}

// ---------------------------------------------------------------------------
// Parcelas sugeridas no formulário
// ---------------------------------------------------------------------------

/**
 * Divide a comissão em N parcelas mensais. A última absorve o arredondamento,
 * então a soma sempre fecha com o total — o banco recusa uma venda cujas
 * parcelas não somem a comissão.
 */
export function suggestInstallments(
  total: number,
  count: number,
  firstDate: string,
): { idx: number; expected_date: string; amount: number }[] {
  const base = Math.floor((total / count) * 100) / 100
  const [y, m, d] = firstDate.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const ultimoDiaDoMes = new Date(y, m - 1 + i + 1, 0).getDate()
    const data = new Date(y, m - 1 + i, Math.min(d, ultimoDiaDoMes))
    return {
      idx: i + 1,
      expected_date: toDateOnly(data),
      amount: i === count - 1 ? r2(total - base * (count - 1)) : base,
    }
  })
}

/** Prévia da cascata no formulário, antes de gravar. Espelha a função do banco. */
export function previewCascade(params: {
  amount: number
  issuesInvoice: boolean
  simplesPct: number
  retainsIss: boolean
  issPct: number
  brokerPct: number | null
}): { iss: number; simples: number; base: number; broker: number; net: number } {
  const iss = params.retainsIss ? r2((params.amount * params.issPct) / 100) : 0
  const simples = params.issuesInvoice ? r2(((params.amount - iss) * params.simplesPct) / 100) : 0
  const base = r2(params.amount - iss - simples)
  const broker = params.brokerPct ? r2((base * params.brokerPct) / 100) : 0
  return { iss, simples, base, broker, net: r2(base - broker) }
}
