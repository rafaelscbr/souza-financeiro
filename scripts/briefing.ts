/**
 * Retrato financeiro em JSON — a fonte de contexto dos agentes.
 *
 * A regra que faz isto funcionar: o agente NUNCA lê tabela crua. Ele lê daqui,
 * e daqui os números saem das MESMAS funções que alimentam as telas
 * (`survival`, `insights`, `cards`, `treasury`, `personal`). Assim o conselho
 * que ele dá e o número que o Rafael vê na tela não podem divergir.
 *
 * Consultar o banco direto seria mais "poderoso" e muito pior: o agente
 * recalcularia à mão regras que custaram caro para acertar — fatura por ciclo
 * carimbado, parcela que ainda não foi lançada, despesa da empresa fora do
 * custo de vida, estorno abatido — e erraria com voz de certeza.
 *
 * Uso:  npm run briefing            (tudo)
 *       npm run briefing -- pessoal (só PF)
 *       npm run briefing -- empresas
 */
import { cardPayables, cardSummary } from '@/lib/cards'
import { activeInstallments, cardIdsOf, cardSpendByCategory, categoryTrends, recurringSpend, topMerchants } from '@/lib/insights'
import { nextObligations, survival } from '@/lib/survival'
import { ownerIncome, personalVitals, netWorth } from '@/lib/personal'
import { treasurySummary } from '@/lib/treasury'
import { inMonth, isOwnerPayout, lastNMonths, personalSummary } from '@/lib/finance'
import { toDateOnly } from '@/lib/format'

const URL = process.env.VITE_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PESSOAL = 'ce20350d-3685-416b-a397-5bbaea735798'
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const get = async (p: string) => (await fetch(`${URL}/rest/v1/${p}`, { headers: h })).json()

const escopo = process.argv[2] ?? 'tudo'
const hoje = toDateOnly(new Date())
const periodo = new Date()
periodo.setDate(1)

const [tx, accounts, transfers, assets, companies] = await Promise.all([
  get('transactions?select=*'),
  get('accounts?select=*'),
  get('transfers?select=*'),
  get('personal_assets?select=*'),
  get('companies?select=*'),
])

const pf = tx.filter((t: any) => t.company_id === PESSOAL)
const pj = tx.filter((t: any) => t.company_id !== PESSOAL)
const contasPF = accounts.filter((a: any) => a.company_id === PESSOAL)
const meses = lastNMonths(periodo, 6)
const r2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- PESSOAL
function briefingPessoal() {
  const tes = treasurySummary(contasPF, pf, transfers, hoje)
  const vitals = personalVitals(pf, pj, contasPF, transfers, periodo, 'cash')
  const rec = recurringSpend(pf, meses, 'cash')
  const parcelas = activeInstallments(pf, hoje)
  const fixo = rec.monthlyTotal + parcelas.reduce((s, p) => s + p.monthly, 0)
  const folego = survival({
    liquid: vitals.liquid,
    livingCostAvg: vitals.livingCostAvg,
    fixedCommitment: fixo,
    assets,
  })
  const cartoes = contasPF.filter((a: any) => a.type === 'credit_card')
  const faturas = cardPayables(cartoes.map((c: any) => cardSummary(c, pf, transfers, hoje)))
  const pendentes = pf.filter((t: any) => t.status === 'pending')
  const proximos = nextObligations(
    [
      ...faturas.filter((f: any) => f.state !== 'future').map((f: any) => ({
        label: `Fatura ${f.account.name}`, amount: f.amount, date: f.dueDate,
      })),
      ...pendentes.map((t: any) => ({
        label: t.description || t.category,
        amount: t.amount,
        date: t.due_date ?? t.competence_date,
      })),
    ],
    hoje,
    8,
  )

  return {
    folego: {
      liquido: folego.liquid,
      custoDeVidaMes: folego.livingCost,
      compromissoFixoMes: folego.fixedCommitment,
      autonomiaMeses: folego.runwayMonths,
      autonomiaDias: folego.runwayDays,
      faixa: folego.faixa,
      faltaParaReserva6Meses: folego.reserveGap,
      endividamento: folego.leverage,
    },
    contas: tes.balances.map((b: any) => ({
      nome: b.account.name, tipo: b.account.type, saldo: b.balance,
    })),
    disponivel: tes.available,
    dividaCartao: tes.cardDebt,
    patrimonio: netWorth(contasPF, pf, transfers, assets, hoje),
    bensEDividas: assets.filter((a: any) => a.is_active).map((a: any) => ({
      tipo: a.kind, nome: a.name, valor: a.value, avaliadoEm: a.valued_at,
    })),
    proximosVencimentos: proximos,
    faturasCartao: cartoes.flatMap((c: any) =>
      cardSummary(c, pf, transfers, hoje)
        .invoices.filter((i: any) => i.cycleMonth >= hoje.slice(0, 8) + '01')
        .slice(0, 8)
        .map((i: any) => ({ cartao: c.name, ciclo: i.cycleMonth.slice(0, 7), total: i.total, vencimento: i.dueDate, estado: i.state })),
    ),
    limiteCartao: cartoes.map((c: any) => {
      const s = cardSummary(c, pf, transfers, hoje)
      return { cartao: c.name, limite: c.card_limit, comprometido: s.limitUsed, disponivel: s.limitAvailable }
    }),
    gastosFixosRecorrentes: rec.rows.map((x) => ({ onde: x.merchant, categoria: x.category, porMes: x.monthly })),
    parcelamentosEmCurso: parcelas.map((p) => ({
      o_que: p.label, porMes: p.monthly, faltam: p.remaining, de: p.count, terminaEm: p.endsAt, restaPagar: p.outstanding,
    })),
    serieMensal: vitals.series.map((p) => ({
      mes: p.monthKey, entrou: p.inflow, custoDeVida: p.livingCost, sobrou: p.surplus,
    })),
    gastoNoCartaoPorCategoria: cardSpendByCategory(pf, cardIdsOf(accounts, PESSOAL), meses, 'cash')
      .map((c) => ({ categoria: c.category, total: c.total, fatia: r2(c.share * 100) })),
    ondeMaisGasta: topMerchants(pf, meses, 'cash', 10)
      .map((m) => ({ onde: m.merchant, total: m.total, vezes: m.count, categoria: m.category })),
    oQueMudouNoMes: categoryTrends(pf, periodo, meses.slice(0, -1), 'cash')
      .slice(0, 6)
      .map((t) => ({ categoria: t.category, esteMes: t.current, normal: t.average, diferenca: t.diff })),
    rendaDasEmpresas: ownerIncome(pj, companies, meses, 'cash'),
    resumoDoMes: personalSummary(pf, pj, periodo, 'cash'),
  }
}

// --------------------------------------------------------------- EMPRESAS
function briefingEmpresas() {
  return companies
    .filter((c: any) => !c.is_personal)
    .map((c: any) => {
      const t = pj.filter((x: any) => x.company_id === c.id)
      const recebido = t.filter((x: any) => x.status === 'settled' && x.kind === 'income')
      const pago = t.filter((x: any) => x.status === 'settled' && x.kind === 'expense')
      const aReceber = t.filter((x: any) => x.status === 'pending' && x.kind === 'income')
      const aPagar = t.filter((x: any) => x.status === 'pending' && x.kind === 'expense')
      const soma = (a: any[]) => r2(a.reduce((s, x) => s + x.amount, 0))
      const porCategoria: Record<string, number> = {}
      for (const x of t) {
        if (x.kind !== 'expense') continue
        porCategoria[x.category] = r2((porCategoria[x.category] ?? 0) + x.amount)
      }
      return {
        empresa: c.name,
        caixa: r2(soma(recebido) - soma(pago)),
        recebido: soma(recebido),
        pago: soma(pago),
        aReceber: soma(aReceber),
        aPagar: soma(aPagar),
        devidoAoRafael: soma(aPagar.filter((x: any) => x.counterparty === 'Rafael (cartão pessoal)')),
        custoPorCategoria: porCategoria,
        proximosRecebimentos: aReceber
          .sort((a: any, b: any) => ((a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1))
          .slice(0, 6)
          .map((x: any) => ({ data: x.due_date, valor: x.amount, o_que: x.description })),
        proximosPagamentos: aPagar
          .filter((x: any) => x.counterparty !== 'Rafael (cartão pessoal)')
          .sort((a: any, b: any) => ((a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1))
          .slice(0, 6)
          .map((x: any) => ({ data: x.due_date, valor: x.amount, o_que: x.description })),
        retiradasNoMes: t
          .filter((x: any) => isOwnerPayout(x) && inMonth(x, periodo, 'cash'))
          .map((x: any) => ({ tipo: x.category, valor: x.amount })),
      }
    })
}

const saida: Record<string, unknown> = { geradoEm: hoje, escopo }
if (escopo !== 'empresas') saida.pessoal = briefingPessoal()
if (escopo !== 'pessoal') saida.empresas = briefingEmpresas()
console.log(JSON.stringify(saida, null, 1))
