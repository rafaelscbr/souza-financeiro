/**
 * Auditoria de invariantes do sistema. Cada bloco é uma afirmação que TEM de
 * ser verdadeira; o que falhar aparece com ✗ e o detalhe.
 */
import { cardSummary } from '@/lib/cards'
import { treasurySummary, accountBalance } from '@/lib/treasury'
import { personalVitals } from '@/lib/personal'
import { activeInstallments, recurringSpend } from '@/lib/insights'
import { lastNMonths } from '@/lib/finance'
import { personalCashflow } from '@/lib/cashflow'
import { saleSplits } from '@/lib/commissions'

const URL = process.env.VITE_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const P = 'ce20350d-3685-416b-a397-5bbaea735798'
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const get = async (p: string) => (await fetch(`${URL}/rest/v1/${p}`, { headers: h })).json()

let falhas = 0
const ok = (cond: boolean, msg: string, detalhe = '') => {
  console.log(`${cond ? '  ok ' : '  ✗ '} ${msg}${detalhe ? '  → ' + detalhe : ''}`)
  if (!cond) falhas++
}
const brl = (n: number) => n.toFixed(2)

const tx = await get('transactions?select=*')
const accounts = await get('accounts?select=*')
const transfers = await get('transfers?select=*')
const assets = await get('personal_assets?select=*')
const cats = await get('categories?select=*')
const companies = await get('companies?select=*')
const HOJE = '2026-07-28'

const pf = tx.filter((t: any) => t.company_id === P)
const pj = tx.filter((t: any) => t.company_id !== P)
const contasPF = accounts.filter((a: any) => a.company_id === P)
const cartao = contasPF.find((a: any) => a.type === 'credit_card')

// ---------------------------------------------------------------- 1. faturas
console.log('\n1. FATURAS DO CARTÃO batem com o extrato oficial do Bradesco')
const OFICIAL: Record<string, number> = {
  '2026-01-01': 3790.51, '2026-02-01': 4106.81, '2026-03-01': 3569.44,
  '2026-04-01': 3993.76, '2026-05-01': 6554.44, '2026-06-01': 4473.28,
  '2026-07-01': 6692.89 - 230.0, '2026-08-01': 3767.91,
}
const resumoCartao = cardSummary(cartao, pf, transfers, HOJE)
for (const [ciclo, esperado] of Object.entries(OFICIAL)) {
  const f = resumoCartao.invoices.find((i: any) => i.cycleMonth === ciclo)
  const real = f ? f.total : 0
  // O extrato do app foi puxado em 28/07: compra feita depois disso (ou parcela
  // que posta depois) entra legitimamente no ciclo e não é divergência.
  const posteriores =
    ciclo === '2026-08-01'
      ? pf
          .filter((t: any) => t.card_cycle_month === ciclo && t.kind === 'expense')
          .filter((t: any) => (t.settled_date ?? '') >= '2026-07-28')
          .reduce((s: number, t: any) => s + t.amount, 0)
      : 0
  const alvo = esperado + posteriores
  ok(Math.abs(real - alvo) < 0.02, `fatura ${ciclo.slice(0, 7)}`, `${brl(real)} vs ${brl(alvo)}`)
}

// ------------------------------------------------------------- 2. saldo/limite
console.log('\n2. SALDOS')
const saldoCartao = accountBalance(cartao, pf, transfers, HOJE).balance
ok(Math.abs(saldoCartao + 4165.95) < 0.02, 'saldo devedor do cartão = fatura aberta', brl(saldoCartao))
const tes = treasurySummary(contasPF, pf, transfers, HOJE)
ok(Math.abs(tes.available - 5218.81) < 0.02, 'disponível (Nubank + Bradesco)', brl(tes.available))
ok(
  resumoCartao.limitAvailable != null && resumoCartao.limitAvailable > 0,
  'limite disponível positivo',
  `usado ${brl(resumoCartao.limitUsed)} de 30000`,
)

// -------------------------------------------------------- 3. parcelamentos
console.log('\n3. PARCELAMENTOS íntegros (sem índice repetido, sem buraco, sem passar do total)')
// A chave é grupo + TIPO: `group_id` junta a venda e o repasse da mesma
// operação, então cada lado tem a sua própria sequência 1..n.
const grupos = new Map<string, any[]>()
for (const t of tx) if (t.group_id && t.installment_count) {
  const k = `${t.group_id}|${t.kind}|${t.category}`
  const a = grupos.get(k) ?? []
  a.push(t); grupos.set(k, a)
}
let ruins: string[] = []
for (const [gid, items] of grupos) {
  const idx = items.map((i) => i.installment_index).sort((a, b) => a - b)
  const cnt = items[0].installment_count
  const nome = (items[0].description || '').slice(0, 34)
  if (new Set(idx).size !== idx.length) ruins.push(`${nome}: índice repetido`)
  if (idx[idx.length - 1] > cnt) ruins.push(`${nome}: índice ${idx[idx.length - 1]} > total ${cnt}`)
  for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1] + 1) ruins.push(`${nome}: pula de ${idx[i - 1]} para ${idx[i]}`)
}
ok(ruins.length === 0, `${grupos.size} parcelamentos`, ruins.slice(0, 5).join(' | '))

// ------------------------------------------- 4. compromissos fixos no futuro
console.log('\n4. COMPROMISSO FIXO tem ocorrência FUTURA (o erro que o Rafael pegou)')
const futurosPF = pf.filter((t: any) => (t.due_date ?? t.settled_date ?? t.competence_date) > HOJE)
for (const alvo of ['Financiamento BYD', 'Pensão']) {
  const n = futurosPF.filter((t: any) =>
    (t.description || '').includes(alvo) || t.category === alvo).length
  ok(n > 0, `${alvo} tem vencimento futuro`, `${n} ocorrência(s)`)
}
const parc = activeInstallments(pf, HOJE)
ok(parc.length > 0, 'parcelamentos em curso detectados', `${parc.length}`)

// ------------------------------------------------------- 5. razões separados
console.log('\n5. SEPARAÇÃO PF × PJ')
const idsPF = new Set(contasPF.map((a: any) => a.id))
const idsPJ = new Set(accounts.filter((a: any) => a.company_id !== P).map((a: any) => a.id))
ok(pj.every((t: any) => !t.account_id || !idsPF.has(t.account_id)), 'nenhum lançamento PJ em conta PF')
ok(pf.every((t: any) => !t.account_id || !idsPJ.has(t.account_id)), 'nenhum lançamento PF em conta PJ')

// ------------------------------------------------------- 6. categorias válidas
console.log('\n6. CATEGORIAS existem no cadastro')
const validas = new Set(cats.map((c: any) => `${c.company_id ?? 'null'}|${c.name}`))
const orfas = new Set<string>()
for (const t of tx) {
  if (!validas.has(`${t.company_id}|${t.category}`) && !validas.has(`null|${t.category}`))
    orfas.add(`${companies.find((c: any) => c.id === t.company_id)?.name}: ${t.category}`)
}
ok(orfas.size === 0, 'toda categoria usada existe', [...orfas].join(' | '))

// --------------------------------------------- 7. crédito contra a empresa
console.log('\n7. CRÉDITO do Rafael bate com o que a imobiliária deve a ele')
const devido = pj
  .filter((t: any) => t.counterparty === 'Rafael (cartão pessoal)' && (t.due_date ?? '9999') <= HOJE)
  .reduce((s: number, t: any) => s + t.amount, 0)
const credito = assets.find((a: any) => a.name === 'A receber da Souza Imobiliária')?.value ?? 0
ok(Math.abs(devido - credito) < 0.02, 'crédito = soma do que ela já deve', `${brl(credito)} vs ${brl(devido)}`)

// --------------------------------------------------- 8. duplicatas grosseiras
console.log('\n8. SEM PARCELA DUPLICADA')
// Estorno tem a MESMA data, valor e descrição da compra (só muda o tipo), e
// duas recargas iguais no mesmo dia são normais. O que não pode existir é a
// mesma PARCELA duas vezes.
const vistos = new Map<string, number>()
for (const t of tx) {
  if (!t.group_id || !t.installment_index) continue
  const k = `${t.group_id}|${t.kind}|${t.category}|${t.installment_index}`
  vistos.set(k, (vistos.get(k) ?? 0) + 1)
}
const dups = [...vistos.entries()].filter(([, n]) => n > 1)
ok(dups.length === 0, 'nenhuma parcela lançada em dobro', dups.slice(0, 3).map(([k, n]) => `${n}x ${k.slice(0, 60)}`).join(' | '))

// ------------------------------------------------------ 9. datas coerentes
console.log('\n9. COERÊNCIA de status e datas')
ok(tx.every((t: any) => t.status !== 'settled' || t.settled_date), 'todo settled tem data de liquidação')
ok(tx.every((t: any) => t.status !== 'pending' || !t.settled_date), 'nenhum pending com data de liquidação')
const semVenc = tx.filter((t: any) => t.status === 'pending' && !t.due_date)
ok(semVenc.length === 0, 'todo pending tem vencimento', `${semVenc.length} sem`)

// -------------------------------------------------------- 10. sobrevivência
console.log('\n10. INDICADORES batem entre si')
const v = personalVitals(pf, pj, contasPF, transfers, new Date(2026, 6, 1), 'cash')
ok(Math.abs(v.liquid - (tes.available - tes.cardDebt)) < 0.02, 'líquido = disponível − cartão', brl(v.liquid))
const rec = recurringSpend(pf, lastNMonths(new Date(2026, 6, 1), 6), 'cash')
ok(rec.monthlyTotal > 0 && v.livingCostAvg > 0, 'custo de vida e recorrentes apurados',
   `custo ${brl(v.livingCostAvg)} · recorrente ${brl(rec.monthlyTotal)}`)

// ------------------------------------------------ 11. previsão de caixa
console.log('\n11. PREVISÃO DE CAIXA sem contagem dupla')
const fluxo = personalCashflow({
  available: tes.available,
  personalTransactions: pf,
  businessTransactions: pj,
  accounts: contasPF,
  transfers,
  today: HOJE,
  months: 8,
})
ok(
  Math.abs(fluxo.opening - tes.available) < 0.02,
  'projeção parte do DISPONÍVEL, não do líquido',
  `${brl(fluxo.opening)} vs disponível ${brl(tes.available)}`,
)
// A fatura em aberto não pode estar no ponto de partida E nas saídas.
const faturaNasSaidas = fluxo.months.reduce((s, m) => s + m.card, 0)
ok(
  faturaNasSaidas > 0 && fluxo.opening > v.liquid,
  'fatura entra só uma vez (como saída futura)',
  `${brl(faturaNasSaidas)} em faturas · partida ${brl(fluxo.opening)}`,
)
// Saldo de cada mês tem de ser o anterior mais o líquido do mês.
let esperado = fluxo.opening
let cadeiaOk = true
for (const m of fluxo.months) {
  esperado = Math.round((esperado + m.net) * 100) / 100
  if (Math.abs(esperado - m.balance) > 0.02) cadeiaOk = false
}
ok(cadeiaOk, 'saldo acumulado fecha mês a mês')
ok(
  fluxo.months.every((m) => Math.abs(m.outflow - (m.card + m.bills)) < 0.02),
  'saída de cada mês = fatura + contas',
)

// ------------------------------------------- 12. divisão das comissões
console.log('\n12. DIVISÃO DAS COMISSÕES fecha')
const splits = saleSplits(pj)
const somaOk = splits.every(
  (s) => Math.abs(s.gross - (s.tax + s.partner + s.toOwner + s.toCompany)) < 0.05,
)
ok(somaOk, `${splits.length} venda(s): bruta = imposto + parceiro + Rafael + empresa`,
   splits.filter((s) => Math.abs(s.gross - (s.tax + s.partner + s.toOwner + s.toCompany)) >= 0.05)
     .map((s) => s.label.slice(0, 28)).join(' | '))
ok(
  splits.every((s) => s.toCompany >= -0.05),
  'nenhuma venda deixa saldo negativo para a empresa',
  splits.filter((s) => s.toCompany < -0.05).map((s) => `${s.label.slice(0, 24)} ${brl(s.toCompany)}`).join(' | '),
)

// ------------------------------------------------- 13. caixa das empresas
console.log('\n13. CAIXA DAS EMPRESAS bate com o que foi liquidado')
for (const c of companies.filter((x: any) => !x.is_personal)) {
  const seus = pj.filter((t: any) => t.company_id === c.id && t.status === 'settled')
  const ent = seus.filter((t: any) => t.kind === 'income').reduce((s: number, t: any) => s + t.amount, 0)
  const sai = seus.filter((t: any) => t.kind !== 'income').reduce((s: number, t: any) => s + t.amount, 0)
  const temConta = accounts.some((a: any) => a.company_id === c.id && a.type !== 'credit_card')
  ok(
    ent - sai >= -0.02,
    `${c.name}: caixa não negativo`,
    `entrou ${brl(ent)} − saiu ${brl(sai)} = ${brl(ent - sai)}${temConta ? '' : ' (sem conta bancária cadastrada — é aritmética, não saldo)'}`,
  )
}

console.log(`\n${falhas === 0 ? '✓ TUDO CERTO' : `✗ ${falhas} FALHA(S)`} — ${tx.length} lançamentos auditados`)
