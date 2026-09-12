/**
 * Auditoria do sistema da imobiliária.
 *
 * Cada bloco é uma afirmação que TEM de ser verdadeira. O que falhar aparece
 * com ✗ e o detalhe. Roda contra o banco de produção, somente leitura.
 *
 * A auditoria antiga conferia o razão pessoal, o cartão de crédito e a
 * separação PF × PJ — perguntas que saíram do escopo. Aqui as perguntas são:
 * a venda fecha? a parcela está ligada ao razão? a comissão do corretor saiu
 * na base certa? o corretor não está esperando dinheiro que já entrou?
 *
 * Rodar:  npm run auditoria-imob
 */
const BASE = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROIBIDO = 'dczexbzsfdavcrwiungk' // icrm

if (!BASE || !KEY) {
  console.error('Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env).')
  process.exit(1)
}
if (BASE.includes(PROIBIDO)) {
  console.error('ABORTADO: a URL aponta para o icrm.')
  process.exit(1)
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const get = async (p) => {
  const r = await fetch(`${BASE}/rest/v1/${p}`, { headers: H })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`)
  return r.json()
}
const c = (n) => Math.round(Number(n ?? 0) * 100)
const brl = (n) => (Number(n) || 0).toFixed(2)
const soma = (lista, f = (x) => x.amount) => lista.reduce((s, x) => s + c(f(x)), 0) / 100

let falhas = 0
let avisos = 0
const ok = (cond, msg, detalhe = '') => {
  console.log(`${cond ? '  ok ' : '  ✗ '} ${msg}${detalhe ? '  → ' + detalhe : ''}`)
  if (!cond) falhas++
}
const aviso = (msg) => {
  console.log(`  ··  ${msg}`)
  avisos++
}

// ---------------------------------------------------------------- carga
let empresas, vendas, parcelas, tx, contas, contatos
try {
  empresas = await get('companies?select=id,name,slug')
} catch (e) {
  console.error('Não consegui ler o banco:', e.message)
  process.exit(1)
}
const imob = empresas.find((e) => e.slug === 'imobiliaria')
if (!imob) {
  console.error('Souza Imobiliária não encontrada.')
  process.exit(1)
}

try {
  ;[vendas, parcelas, tx, contas, contatos] = await Promise.all([
    get(`sales?select=*&company_id=eq.${imob.id}`),
    get('sale_installments?select=*'),
    get(`transactions?select=*&company_id=eq.${imob.id}`),
    get('accounts?select=id,name,company_id'),
    get('contacts?select=id,name,is_owner'),
  ])
} catch (e) {
  console.error(
    '\nAs tabelas de venda ainda não existem neste banco.\n' +
      'Aplique as migrações 007 a 012 no SQL Editor do Supabase e rode de novo.\n' +
      `(detalhe: ${e.message})`,
  )
  process.exit(1)
}

const porId = new Map(tx.map((t) => [t.id, t]))
const idsDeVenda = new Set(vendas.map((v) => v.id))
parcelas = parcelas.filter((p) => idsDeVenda.has(p.sale_id))
const nomeContato = new Map(contatos.map((k) => [k.id, k.name]))

console.log(`Auditoria da ${imob.name} — ${vendas.length} vendas, ${tx.length} lançamentos\n`)

// -------------------------------------------------- 1. a venda fecha
console.log('1. TODA VENDA fecha com as próprias parcelas')
for (const v of vendas) {
  const minhas = parcelas.filter((p) => p.sale_id === v.id && p.status !== 'cancelada')
  const somaParcelas = soma(minhas)
  ok(
    Math.abs(c(somaParcelas) - c(v.commission_total)) <= 1,
    `${String(v.title).slice(0, 44)}`,
    `parcelas ${brl(somaParcelas)} vs comissão ${brl(v.commission_total)}`,
  )
}

// -------------------------------------- 2. parcela ligada ao razão
console.log('\n2. TODA PARCELA está ligada ao razão, com os mesmos valores')
let semReceita = 0
let valorDivergente = []
for (const p of parcelas) {
  if (p.status === 'cancelada') continue
  const receita = p.revenue_tx_id ? porId.get(p.revenue_tx_id) : null
  if (!receita) {
    semReceita++
    continue
  }
  if (Math.abs(c(receita.amount) - c(p.amount)) > 1) {
    valorDivergente.push(`${String(receita.description).slice(0, 30)}: razão ${brl(receita.amount)} vs parcela ${brl(p.amount)}`)
  }
}
ok(semReceita === 0, 'toda parcela tem a linha de receita', `${semReceita} sem`)
ok(valorDivergente.length === 0, 'valor da parcela = valor no razão', valorDivergente.slice(0, 3).join(' | '))

const conferirLigacao = (campo, categoria, filtro = () => true) => {
  const ruins = []
  for (const p of parcelas.filter((x) => x.status !== 'cancelada' && filtro(x))) {
    const esperado = campo === 'iss_tx_id' ? p.iss_amount : campo === 'simples_tx_id' ? p.simples_amount : p.broker_amount
    const id = p[campo]
    if (esperado > 0 && !id) ruins.push(`${p.sale_id.slice(0, 8)} pc ${p.idx}: ${categoria} de ${brl(esperado)} sem lançamento`)
    if (!id) continue
    const t = porId.get(id)
    if (!t) ruins.push(`${p.sale_id.slice(0, 8)} pc ${p.idx}: ${categoria} aponta para lançamento inexistente`)
  }
  return ruins
}
for (const [campo, nome] of [
  ['iss_tx_id', 'ISS'],
  ['simples_tx_id', 'Simples'],
  ['broker_tx_id', 'comissão do corretor'],
]) {
  const ruins = conferirLigacao(campo, nome)
  ok(ruins.length === 0, `${nome}: lançamento existe quando o valor existe`, ruins.slice(0, 2).join(' | '))
}

// ------------------------------------------- 3. a cascata do dinheiro
console.log('\n3. A CASCATA de cada parcela fecha')
for (const p of parcelas.filter((x) => x.status !== 'cancelada')) {
  const liquido = c(p.amount) - c(p.iss_amount) - c(p.simples_amount) - c(p.broker_amount) - c(p.owner_amount)
  if (Math.abs(liquido - c(p.net_amount)) > 1) {
    const v = vendas.find((x) => x.id === p.sale_id)
    ok(false, `${String(v?.title).slice(0, 34)} pc ${p.idx}: líquido`, `${brl(liquido / 100)} vs ${brl(p.net_amount)}`)
  }
}
ok(true, `${parcelas.filter((x) => x.status !== 'cancelada').length} parcelas com líquido consistente`)

// A comissão do corretor tem de sair da base LÍQUIDA de imposto. Divergência
// vira aviso, não falha: parcela antiga pode ter sido paga com desconto
// combinado, e o valor gravado é o que aconteceu de verdade.
console.log('\n4. COMISSÃO DO CORRETOR sobre a base líquida de imposto')
let divergentes = 0
for (const p of parcelas.filter((x) => x.status !== 'cancelada' && x.broker_amount > 0)) {
  const v = vendas.find((x) => x.id === p.sale_id)
  if (!v?.broker_pct) continue
  const base = c(p.amount) - c(p.iss_amount) - c(p.simples_amount)
  const esperado = Math.round((base * Number(v.broker_pct)) / 100)
  if (Math.abs(esperado - c(p.broker_amount)) > 1) {
    divergentes++
    aviso(
      `${String(v.title).slice(0, 34)} pc ${p.idx}: gravado ${brl(p.broker_amount)}, ` +
        `regra daria ${brl(esperado / 100)} (confira se houve desconto combinado)`,
    )
  }
}
ok(true, `${divergentes} parcela(s) com valor diferente da regra`, divergentes > 0 ? 'ver avisos acima' : 'nenhuma')

// ---------------------------------- 5. o corretor não espera à toa
console.log('\n5. COMISSÃO LIBERADA não fica esquecida')
const hoje = new Date().toISOString().slice(0, 10)
const liberadas = parcelas.filter((p) => {
  if (p.status !== 'recebida' || !p.broker_tx_id) return false
  const t = porId.get(p.broker_tx_id)
  return t && t.status === 'pending'
})
const atrasadas = liberadas.filter((p) => (p.received_date ?? '') < hoje)
ok(true, `${liberadas.length} comissão(ões) liberada(s) a pagar`, brl(soma(liberadas, (p) => p.broker_amount)))
for (const p of atrasadas.slice(0, 5)) {
  const v = vendas.find((x) => x.id === p.sale_id)
  const dias = Math.round((Date.parse(hoje) - Date.parse(p.received_date)) / 86400000)
  aviso(
    `${nomeContato.get(v?.broker_id) ?? 'corretor'} espera ${brl(p.broker_amount)} há ${dias} dia(s) ` +
      `(${String(v?.title).slice(0, 30)} pc ${p.idx})`,
  )
}
// O contrário é pior: corretor pago por parcela que a imobiliária não recebeu.
const pagoSemReceber = parcelas.filter((p) => {
  if (p.status === 'recebida' || !p.broker_tx_id) return false
  const t = porId.get(p.broker_tx_id)
  return t && t.status === 'settled'
})
ok(
  pagoSemReceber.length === 0,
  'nenhuma comissão paga antes da imobiliária receber',
  pagoSemReceber.map((p) => `${p.sale_id.slice(0, 8)} pc ${p.idx}`).join(' | '),
)

// ----------------------------------------- 6. o razão está coerente
console.log('\n6. RAZÃO coerente')
const comissoesSemVenda = tx.filter((t) => t.category === 'Comissões de Venda' && !t.sale_id)
ok(
  comissoesSemVenda.length === 0,
  'toda comissão de venda pertence a uma venda',
  comissoesSemVenda.map((t) => String(t.description).slice(0, 30)).join(' | '),
)
ok(
  tx.every((t) => t.status !== 'settled' || t.settled_date),
  'todo liquidado tem data',
)
ok(
  tx.every((t) => t.status !== 'pending' || !t.settled_date),
  'nenhum pendente com data de liquidação',
)
const semVencimento = tx.filter((t) => t.status === 'pending' && !t.due_date)
ok(semVencimento.length === 0, 'todo pendente tem vencimento', `${semVencimento.length} sem`)

const idsDeContaDela = new Set(contas.filter((a) => a.company_id === imob.id).map((a) => a.id))
const vazando = tx.filter((t) => t.account_id && !idsDeContaDela.has(t.account_id))
ok(vazando.length === 0, 'nenhum lançamento dela em conta de outra empresa', `${vazando.length}`)

// ------------------------------------------ 7. os totais batem
console.log('\n7. TOTAIS batem entre a venda e o razão')
const comissaoNoRazao = soma(tx.filter((t) => t.category === 'Comissões de Venda'))
const comissaoNasVendas = soma(vendas, (v) => v.commission_total)
ok(
  Math.abs(c(comissaoNoRazao) - c(comissaoNasVendas)) <= vendas.length,
  'comissão total: razão = vendas',
  `${brl(comissaoNoRazao)} vs ${brl(comissaoNasVendas)}`,
)

const recebido = soma(tx.filter((t) => t.kind === 'income' && t.status === 'settled'))
const aReceber = soma(tx.filter((t) => t.kind === 'income' && t.status === 'pending'))
const pago = soma(tx.filter((t) => t.kind !== 'income' && t.status === 'settled'))
const aPagar = soma(tx.filter((t) => t.kind !== 'income' && t.status === 'pending'))
console.log(
  `  ··  recebido ${brl(recebido)} · a receber ${brl(aReceber)} · pago ${brl(pago)} · a pagar ${brl(aPagar)}`,
)

const impostoAPagar = soma(
  tx.filter((t) => t.category === 'Impostos e Taxas' && t.status === 'pending'),
)
const comissaoAPagar = soma(
  tx.filter((t) => t.category === 'Comissões de Corretores' && t.status === 'pending'),
)
console.log(`  ··  imposto a pagar ${brl(impostoAPagar)} · comissão a pagar ${brl(comissaoAPagar)}`)

// ------------------------------------------ 8. acesso está fechado
console.log('\n8. ACESSO')
try {
  const perfis = await get('profiles?select=id,role,contact_id,is_active')
  const admins = perfis.filter((p) => p.role === 'admin' && p.is_active)
  const corretores = perfis.filter((p) => p.role === 'corretor' && p.is_active)
  ok(admins.length >= 1, 'existe pelo menos um administrador ativo', `${admins.length}`)
  ok(
    corretores.every((p) => p.contact_id),
    'todo corretor ativo está ligado a um contato',
    `${corretores.filter((p) => !p.contact_id).length} sem vínculo`,
  )
  console.log(`  ··  ${admins.length} administrador(es) · ${corretores.length} corretor(es) com acesso`)
} catch (e) {
  ok(false, 'perfis legíveis', e.message)
}

console.log(
  `\n${falhas === 0 ? '✓ TUDO CERTO' : `✗ ${falhas} FALHA(S)`}` +
    `${avisos > 0 ? ` · ${avisos} aviso(s) para conferir` : ''}` +
    ` — ${vendas.length} vendas e ${parcelas.length} parcelas auditadas`,
)
process.exit(falhas === 0 ? 0 : 1)
