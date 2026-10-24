import type { Contact, SaleInstallment, Transaction } from '@/types'
import { CATEGORIA_GESTAO, noPeriodo, type PeriodoDre } from './dre'
import { COST_OF_SALE_CATEGORIES } from './finance'
import type { SaleView } from './sales'

/*
 * COMISSÕES E REPASSES (Fase 5, 23/10/2026).
 *
 * O razão é a fonte: cada lançamento de comissão de corretor e de gestão de
 * equipe é de UMA pessoa. A pessoa é o contato gravado no lançamento; se ele
 * faltar (lançamentos antigos), a da venda — o corretor, ou o gestor quando
 * o lançamento é de gestão. Assim a soma por pessoa é, por construção, a
 * soma do razão.
 *
 * Três momentos, que nunca se somam entre si:
 *   pago      — saiu da conta no período (caixa, pela data da baixa);
 *   liberado  — a imobiliária já recebeu a parcela e ainda não repassou (hoje);
 *   previsto  — depende da construtora pagar a parcela (hoje).
 */

const r2 = (v: number) => Math.round(v * 100) / 100

export interface RepassesDaPessoa {
  contactId: string | null
  nome: string
  pagoComissao: number
  pagoGestao: number
  pago: number
  liberado: number
  previsto: number
  lancamentosPagos: Transaction[]
  lancamentosLiberados: Transaction[]
  lancamentosPrevistos: Transaction[]
}

export function ehRepasse(t: Transaction): boolean {
  return COST_OF_SALE_CATEGORIES.has(t.category)
}

export function repassesPorPessoa(p: {
  transactions: Transaction[]
  vendas: SaleView[]
  contacts: Contact[]
  installments: SaleInstallment[]
  periodo: PeriodoDre
}): RepassesDaPessoa[] {
  const vendaPorId = new Map(p.vendas.map((v) => [v.id, v]))
  const parcelaPorId = new Map(p.installments.map((i) => [i.id, i]))
  const nomePorId = new Map(p.contacts.map((c) => [c.id, c.name]))
  const porPessoa = new Map<string, RepassesDaPessoa>()

  for (const t of p.transactions) {
    if (!ehRepasse(t)) continue
    const venda = t.sale_id ? vendaPorId.get(t.sale_id) : undefined
    const gestao = t.category === CATEGORIA_GESTAO
    const contactId = t.contact_id ?? (gestao ? venda?.manager_id : venda?.broker_id) ?? null
    const chave = contactId ?? 'sem-pessoa'
    const linha =
      porPessoa.get(chave) ??
      ({
        contactId,
        nome: contactId ? nomePorId.get(contactId) ?? 'Corretor' : 'Sem corretor identificado',
        pagoComissao: 0,
        pagoGestao: 0,
        pago: 0,
        liberado: 0,
        previsto: 0,
        lancamentosPagos: [],
        lancamentosLiberados: [],
        lancamentosPrevistos: [],
      } satisfies RepassesDaPessoa)

    if (t.status === 'settled') {
      const d = (t.settled_date ?? t.competence_date).slice(0, 7)
      if (!noPeriodo(d, p.periodo)) continue
      if (gestao) linha.pagoGestao = r2(linha.pagoGestao + t.amount)
      else linha.pagoComissao = r2(linha.pagoComissao + t.amount)
      linha.pago = r2(linha.pago + t.amount)
      linha.lancamentosPagos.push(t)
    } else {
      // Pendente: liberado se a parcela de origem já entrou (ou se não há parcela), previsto se não.
      const parcela = t.sale_installment_id ? parcelaPorId.get(t.sale_installment_id) : undefined
      if (!parcela || parcela.status === 'recebida') {
        linha.liberado = r2(linha.liberado + t.amount)
        linha.lancamentosLiberados.push(t)
      } else if (parcela.status !== 'cancelada') {
        linha.previsto = r2(linha.previsto + t.amount)
        linha.lancamentosPrevistos.push(t)
      }
    }
    porPessoa.set(chave, linha)
  }

  return [...porPessoa.values()]
    .filter((l) => l.pago > 0 || l.liberado > 0 || l.previsto > 0)
    .sort((a, b) => b.pago - a.pago || b.liberado - a.liberado || b.previsto - a.previsto)
}

export function totaisDosRepasses(linhas: RepassesDaPessoa[]) {
  const soma = (f: (l: RepassesDaPessoa) => number) => r2(linhas.reduce((s, l) => s + f(l), 0))
  return {
    pago: soma((l) => l.pago),
    pagoComissao: soma((l) => l.pagoComissao),
    pagoGestao: soma((l) => l.pagoGestao),
    liberado: soma((l) => l.liberado),
    previsto: soma((l) => l.previsto),
  }
}
