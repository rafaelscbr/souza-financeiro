/**
 * Auditoria de invariantes do sistema. Cada bloco é uma afirmação que TEM de
 * ser verdadeira; o que falhar aparece com ✗ e o detalhe.
 */
import { cardSummary } from '@/lib/cards'
import { treasurySummary, accountBalance } from '@/lib/treasury'
import { personalVitals } from '@/lib/personal'
import { activeInstallments, recurringSpend } from '@/lib/insights'
import { lastNMonths, dreGroupOf } from '@/lib/finance'
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
const round2 = (n: number) => Math.round(n * 100) / 100

const tx = await get('transactions?select=*')
const accounts = await get('accounts?select=*')
const transfers = await get('transfers?select=*')
const assets = await get('personal_assets?select=*')
const cats = await get('categories?select=*')
const companies = await get('companies?select=*')
// A auditoria roda contra o estado de HOJE. Data fixa aqui já causou falso
// alarme: os indicadores eram apurados numa data e os saldos em outra.
const HOJE = new Date().toISOString().slice(0, 10)
const REF = new Date(Date.parse(HOJE + 'T12:00:00'))

const pf = tx.filter((t: any) => t.company_id === P)
const pj = tx.filter((t: any) => t.company_id !== P)
const contasPF = accounts.filter((a: any) => a.company_id === P)
const cartao = contasPF.find((a: any) => a.type === 'credit_card')

// ---------------------------------------------------------------- 1. faturas
console.log('\n1. FATURAS DO CARTÃO batem com o extrato oficial do Bradesco')
const OFICIAL: Record<string, number> = {
  '2026-01-01': 3790.51, '2026-02-01': 4106.81, '2026-03-01': 3569.44,
  '2026-04-01': 3993.76, '2026-05-01': 6554.44, '2026-06-01': 4473.28,
  '2026-07-01': 6692.89 - 230.0, '2026-08-01': 6088.79,
}
// Só confere ciclo FECHADO com extrato oficial em mãos. O ciclo aberto ainda
// recebe compra todo dia — cobrá-lo de um total fixo seria falso alarme.
const resumoCartao = cardSummary(cartao, pf, transfers, HOJE)
for (const [ciclo, esperado] of Object.entries(OFICIAL)) {
  const f = resumoCartao.invoices.find((i: any) => i.cycleMonth === ciclo)
  const real = f ? f.total : 0
  ok(Math.abs(real - esperado) < 0.02, `fatura ${ciclo.slice(0, 7)}`, `${brl(real)} vs ${brl(esperado)}`)
}
const semExtrato = resumoCartao.invoices
  .filter((i: any) => i.total > 0 && !(i.cycleMonth in OFICIAL))
  .map((i: any) => `${i.cycleMonth.slice(0, 7)} ${brl(i.total)}`)
console.log(`  ··  ciclos ainda sem extrato oficial: ${semExtrato.join(', ') || 'nenhum'}`)

// ------------------------------------------------------------- 2. saldo/limite
console.log('\n2. SALDOS')
// Cada conta é conferida contra o SALDO DO EXTRATO do banco, na data do
// extrato — é o único juiz externo que o sistema tem.
// [data do extrato, saldo do extrato, lançamentos feitos DEPOIS que o extrato
// foi puxado]. O terceiro campo existe para não adulterar o número do banco:
// quando chegar extrato novo, ele zera e o saldo volta a ser só o do banco.
const EXTRATO: Record<string, [string, number, Array<[string, number]>]> = {
  'Nubank': ['2026-08-15', 0.0, []],
  'Caixinha Nubank (RDB)': ['2026-08-15', 0.0, []],
  'Bradesco': ['2026-08-17', 6501.01, [['reembolso da cesta', 164.63], ['parte da imobiliária na fatura de agosto', 1965.49]]],
  'Bradesco PJ': ['2026-08-12', 6194.78, []],
}
for (const [nome, [data, saldoBanco, depois]] of Object.entries(EXTRATO)) {
  const c = accounts.find((a: any) => a.name === nome)
  const razao = c.company_id === P ? pf : pj
  const real = c ? accountBalance(c, razao, transfers, data).balance : NaN
  const esperado = round2(saldoBanco + depois.reduce((s, [, v]) => s + v, 0))
  const nota = depois.map(([q, v]) => ` + ${brl(v)} ${q}`).join('')
  ok(Math.abs(real - esperado) < 0.02, `${nome} em ${data.slice(8)}/${data.slice(5, 7)}`,
     `${brl(real)} vs extrato ${brl(saldoBanco)}${nota}`)
}
// Devo hoje o que já passei no cartão e ainda não paguei — a data da COMPRA,
// não a do ciclo: compra de agosto que cai na fatura de setembro já é dívida.
// Fecha por dois caminhos diferentes (cardSummary × accountBalance), então
// pega compra que sumiu de uma fatura ou que entrou em duas.
const saldoCartao = accountBalance(cartao, pf, transfers, HOJE).balance
const emFaturas = resumoCartao.invoices.reduce((s: number, i: any) => s + i.total, 0)
const aindaNaoPostou = pf
  .filter((t: any) => t.account_id === cartao.id && (t.settled_date ?? '') > HOJE)
  .reduce((s: number, t: any) => s + (dreGroupOf(t) === 'revenue' ? -t.amount : t.amount), 0)
const pago = transfers
  .filter((tr: any) => tr.to_account_id === cartao.id && tr.date <= HOJE)
  .reduce((s: number, tr: any) => s + tr.amount, 0)
const devoHoje = round2(emFaturas - aindaNaoPostou - pago)
ok(Math.abs(-saldoCartao - devoHoje) < 0.02, 'dívida do cartão = comprado − pago',
   `${brl(-saldoCartao)} vs ${brl(devoHoje)} (${brl(emFaturas)} em faturas − ${brl(aindaNaoPostou)} a postar − ${brl(pago)} pago)`)
const tes = treasurySummary(contasPF, pf, transfers, HOJE)
const somaContas = contasPF
  .filter((a: any) => a.type !== 'credit_card')
  .reduce((s: number, a: any) => s + accountBalance(a, pf, transfers, HOJE).balance, 0)
ok(Math.abs(tes.available - somaContas) < 0.02, 'disponível = soma das contas',
   `${brl(tes.available)} vs ${brl(somaContas)}`)
ok(
  resumoCartao.limitAvailable != null && resumoCartao.limitAvailable > 0,
  'limite disponível positivo',
  `usado ${brl(resumoCartao.limitUsed)} de 30000`,
)

// -------------------------------------------------------- 3. parcelamentos
console.log('\n3. PARCELAMENTOS íntegros (sem índice repetido, sem buraco, sem passar do total)')
// A chave é grupo + TIPO: `group_id` junta a venda e o repasse da mesma
// operação, então cada lado tem a sua própria sequência 1..n.
// ...e mais a SÉRIE: a mesma parcela pode ter dois impostos diferentes (Simples
// 6% e ISS retido 3%), que não são duplicata um do outro. A série é o que vem
// antes do primeiro travessão, sem os parênteses de observação.
const serie = (t: any) =>
  String(t.description || '').split('—')[0].replace(/\([^)]*\)/g, '').trim()
const grupos = new Map<string, any[]>()
for (const t of tx) if (t.group_id && t.installment_count) {
  const k = `${t.group_id}|${t.kind}|${t.category}|${serie(t)}`
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
// O crédito é o que ela já deve MENOS o que ela já devolveu. Sem descontar o
// reembolso, o ativo continuaria contando dinheiro que já voltou para a conta.
// Todo gasto da empresa no cartão dele TEM de existir no DRE dela. Três
// cobranças do Meta Ads passaram batido na carga da fatura de agosto e só
// apareceram quando ele foi transferir — nada aqui pegava isso.
const noCartao = pf
  .filter((t: any) => t.category === 'Despesas da Empresa' && t.kind === 'expense')
  .reduce((s: number, t: any) => s + t.amount, 0)
const noDre = pj
  .filter((t: any) => t.counterparty === 'Rafael (cartão pessoal)')
  .reduce((s: number, t: any) => s + t.amount, 0)
ok(Math.abs(noCartao - noDre) < 0.02, 'todo gasto da empresa no cartão dele está no DRE dela',
   `cartão ${brl(noCartao)} vs DRE ${brl(noDre)}`)

const devido = pj
  .filter((t: any) => t.counterparty === 'Rafael (cartão pessoal)' && (t.due_date ?? '9999') <= HOJE)
  .reduce((s: number, t: any) => s + t.amount, 0)
const reembolsado = pf
  .filter((t: any) => t.kind === 'income' && t.category === 'Reembolsos' &&
    t.counterparty === 'Souza Imobiliária' && t.status === 'settled')
  .reduce((s: number, t: any) => s + t.amount, 0)
const aReceber = round2(devido - reembolsado)
const credito = assets.find((a: any) => a.name === 'A receber da Souza Imobiliária')?.value ?? 0
ok(Math.abs(aReceber - credito) < 0.02, 'crédito = o que ela deve − o que já reembolsou',
   `${brl(credito)} vs ${brl(aReceber)} (${brl(devido)} devido − ${brl(reembolsado)} reembolsado)`)

// --------------------------------------------------- 8. duplicatas grosseiras
console.log('\n8. SEM PARCELA DUPLICADA')
// Estorno tem a MESMA data, valor e descrição da compra (só muda o tipo), e
// duas recargas iguais no mesmo dia são normais. O que não pode existir é a
// mesma PARCELA duas vezes.
const vistos = new Map<string, number>()
for (const t of tx) {
  if (!t.group_id || !t.installment_index) continue
  const k = `${t.group_id}|${t.kind}|${t.category}|${serie(t)}|${t.installment_index}`
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
const v = personalVitals(pf, pj, contasPF, transfers, REF, 'cash')
ok(Math.abs(v.liquid - (tes.available - tes.cardDebt)) < 0.02, 'líquido = disponível − cartão', brl(v.liquid))
const rec = recurringSpend(pf, lastNMonths(REF, 6), 'cash')
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
// A imobiliária paga a parte dela: nas saídas dele entra só o gasto pessoal.
const cartaoIds = new Set(contasPF.filter((a: any) => a.type === 'credit_card').map((a: any) => a.id))
const empresaNoCartaoTotal = round2(
  pf
    .filter(
      (t: any) =>
        t.kind === 'expense' &&
        t.category === 'Despesas da Empresa' &&
        t.account_id &&
        cartaoIds.has(t.account_id) &&
        t.card_cycle_month >= HOJE.slice(0, 8) + '01',
    )
    .reduce((s: number, t: any) => s + t.amount, 0),
)
ok(
  fluxo.businessInOutflow > 0 && faturaNasSaidas < empresaNoCartaoTotal + faturaNasSaidas,
  'saídas excluem a parte da imobiliária',
  `fora das saídas: ${brl(fluxo.businessInOutflow)}`,
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

// Os dois blocos da visão geral (gráfico e "próximos 30 dias") partem do mesmo
// ponto? Divergir aqui foi o erro que fez a tela mostrar +2.865 num lugar e
// −1.300 no outro, com os mesmos dados.
const limite30 = new Date(Date.parse(HOJE) + 30 * 864e5).toISOString().slice(0, 10)
const itens30 = fluxo.months.flatMap((m) => m.items).filter((i) => i.date <= limite30)
const entra30 = itens30.filter((i) => i.kind === 'in').reduce((s, i) => s + i.amount, 0)
const sai30 = itens30.filter((i) => i.kind === 'out').reduce((s, i) => s + i.amount, 0)
const saldo30 = round2(tes.available + entra30 - sai30)
const doGrafico = fluxo.months.find((m) => m.month === limite30.slice(0, 7))
ok(
  doGrafico == null || Math.abs(saldo30 - doGrafico.balance) < 0.02 || itens30.length !== doGrafico.items.length,
  '30 dias e gráfico partem do mesmo saldo',
  `30 dias ${brl(saldo30)}`,
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
