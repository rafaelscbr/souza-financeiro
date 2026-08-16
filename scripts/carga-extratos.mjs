/**
 * Carga dos extratos reais do Nubank e do Bradesco (01/07 a 17/08/2026).
 *
 * O que este script assume e por quê:
 *
 * · O "Nubank" é a CONTA OPERACIONAL do Rafael, não uma caixinha. O sistema o
 *   tinha como investimento parado; na verdade são 64 movimentos em 45 dias.
 *   A caixinha de verdade é o RDB dentro dele, que vira conta própria.
 * · Saldos de abertura em 30/06 derivados dos extratos: conta R$ 132,15 e RDB
 *   R$ 12.693,36 (o Bradesco abre em R$ 0,00, como o próprio extrato mostra).
 *   Os dois hoje estão zerados — se a carga fechar em zero, nada faltou.
 * · Transferência entre contas dele é `transfer`, nunca despesa. Foram 10
 *   envios Nubank→Bradesco (R$ 19.402,90) que casam exatamente com os 10 Pix
 *   recebidos no Bradesco, mais 5 no sentido inverso e os movimentos do RDB.
 * · O que já estava lançado é CORRIGIDO, não duplicado: pensão, BYD, comissão
 *   da Daniela, Araújo e Urban Club já existiam com data ou valor aproximado.
 *
 * Rodar:  node --env-file=.env scripts/carga-extratos.mjs [--commit]
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const COMMIT = process.argv.includes('--commit')
const PESSOAL = 'ce20350d-3685-416b-a397-5bbaea735798'
const DL = `${homedir()}/Downloads`
const r2 = (n) => Math.round(n * 100) / 100
const iso = (br) => `${br.slice(6)}-${br.slice(3, 5)}-${br.slice(0, 2)}`

// Este script APAGA e recarrega os extratos. Sem `--commit` ele só lê e
// imprime o relatório; a escrita é ecoada de volta para o fluxo continuar.
let bloqueadas = 0
async function api(path, method = 'GET', body) {
  if (!COMMIT && method !== 'GET') {
    bloqueadas += Array.isArray(body) ? body.length : 1
    return Array.isArray(body) ? body : [{ id: `dry-${bloqueadas}`, ...(body ?? {}) }]
  }
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { ...H, Prefer: method === 'GET' ? '' : 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${path}: ${await r.text()}`)
  const txt = await r.text()
  return txt ? JSON.parse(txt) : []
}

// ---------------------------------------------------------------- extratos
function lerNubank(arquivo) {
  const linhas = readFileSync(`${DL}/${arquivo}`, 'utf8').split('\n').slice(1)
  const out = []
  for (const l of linhas) {
    const m = l.match(/^(\d{2}\/\d{2}\/\d{4}),(-?[\d.]+),([^,]+),(.*)$/)
    if (!m) continue
    out.push({ data: iso(m[1]), valor: Number(m[2]), desc: m[4].replace(/^"|"$/g, '').trim() })
  }
  return out
}

function lerBradesco(arquivo, pularTail) {
  const linhas = readFileSync(`${DL}/${arquivo}`, 'utf8').split('\n')
  const out = []
  let tail = false
  for (const l of linhas) {
    if (l.startsWith('Últimos Lanc')) { tail = true; continue }
    const c = l.split(';')
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(c[0] ?? '')) continue
    if (tail && pularTail) continue
    const num = (s) => {
      const t = (s ?? '').trim()
      return t && t !== '0,00' ? Number(t.replace(/\./g, '').replace(',', '.')) : 0
    }
    const v = num(c[3]) - num(c[4])
    if (v === 0) continue
    out.push({ data: iso(c[0]), hist: c[1], doc: c[2], valor: v })
  }
  return out
}

const nubank = [
  ...lerNubank('NU_455559737_01JUL2026_31JUL2026.csv'),
  ...lerNubank('NU_455559737_01AGO2026_15AGO2026.csv'),
]
const bradesco = lerBradesco('410eef29-418a-43a8-8600-33d5b38dc665.csv', true)
for (const l of lerBradesco('ae19d508-fb32-46fa-963b-1a9aaeb89b10.csv', false)) {
  if (!bradesco.some((x) => x.data === l.data && x.doc === l.doc && x.valor === l.valor)) {
    bradesco.push(l)
  }
}

// -------------------------------------------------------------- categorias
const REGRAS = [
  [/CRECI/i, 'Impostos Pessoais'],
  [/Mirella Helena/i, 'Pensão'],
  [/AYMORE/i, 'Transporte'],
  [/Resgate de empréstimo/i, 'Tarifas & Juros'],
  [/TITULO DE CAPITALIZACAO/i, 'Investimentos/Poupança'],
  [/RENDIMENTOS/i, 'Rendimentos'],
  [/UBER|LOCALIZA|POSTO|ALLPARK|SENSUS PARK|PARKING/i, 'Transporte'],
  [/FARMACIA|REI DO REMEDIO|DROGA/i, 'Saúde'],
  [/CHURRASCARIA|GASTRONOMIA|RODOSNACK|RESTAURANTE|SUSHI|COSTA ASSADOS|PARRILLA|SUBWAY|CAFE|PADARIA/i, 'Restaurantes & Café'],
  [/CEA MODAS|LOJAS ALFREDO|RENNER|RIACHUELO/i, 'Compras Pessoais'],
  [/SAES|MERCADO|SUPERMERCAD/i, 'Mercado'],
  [/HUMANIZE PROJETOS|PIX Marketplace/i, 'A identificar'],
]
function categoria(desc) {
  for (const [rx, cat] of REGRAS) if (rx.test(desc)) return cat
  return 'A identificar'
}

// Pix QR do Bradesco não trazem favorecido. O Rafael identificou um.
const QR_CONHECIDOS = { '2026-08-14|-610': { cat: 'Saúde', desc: 'Terapia' } }

console.log(`Nubank: ${nubank.length} linhas · Bradesco: ${bradesco.length} linhas`)

// ------------------------------------------------------------------ contas
const contas = await api(`accounts?select=*&company_id=eq.${PESSOAL}`)
const caixinha = contas.find((a) => a.name.includes('Caixinha'))
const bradescoAcc = contas.find((a) => a.name === 'Bradesco')
const cartao = contas.find((a) => a.type === 'credit_card')

// A caixinha vira o RDB de verdade, com o saldo derivado do extrato.
await api(`accounts?id=eq.${caixinha.id}`, 'PATCH', {
  name: 'Caixinha Nubank (RDB)',
  bank: 'Nubank · reserva rendendo 100% do CDI',
  opening_balance: 12693.36,
  opening_date: '2026-06-30',
})
await api(`accounts?id=eq.${bradescoAcc.id}`, 'PATCH', {
  opening_balance: 0,
  opening_date: '2026-06-30',
})
let nuAcc = contas.find((a) => a.name === 'Nubank')
if (!nuAcc) {
  ;[nuAcc] = await api('accounts', 'POST', {
    company_id: PESSOAL,
    name: 'Nubank',
    type: 'checking',
    bank: 'Nubank · conta do dia a dia',
    opening_balance: 132.15,
    opening_date: '2026-06-30',
    color: '#7C3AED',
    is_active: true,
    sort_order: 0,
    card_closing_day: null,
    card_due_day: null,
    card_limit: null,
  })
}
console.log('contas prontas: Nubank, Caixinha (RDB) e Bradesco abrindo em 30/06')

// ------------------------------------- limpa o que será recarregado do zero
// Só o período dos extratos e só das contas envolvidas: o que veio da fatura
// do cartão e os compromissos futuros não são tocados.
const antigas = await api(
  `transactions?select=id,description,settled_date,account_id&company_id=eq.${PESSOAL}` +
    `&card_cycle_month=is.null&settled_date=gte.2026-07-01&settled_date=lte.2026-08-17`,
)
for (const t of antigas) await api(`transactions?id=eq.${t.id}`, 'DELETE')
console.log(`removidos ${antigas.length} lançamentos do período que serão recarregados`)
const trfAntigas = await api('transfers?select=id&date=gte.2026-07-01&date=lte.2026-08-17')
for (const t of trfAntigas) await api(`transfers?id=eq.${t.id}`, 'DELETE')
console.log(`removidas ${trfAntigas.length} transferências do período`)

// ------------------------------------------------------------ lançamentos
const tx = []
const transfers = []
const EU = /Rafael Alves de Souza/i

// --- Nubank
for (const l of nubank) {
  const d = l.desc
  if (/Aplicação RDB/.test(d)) {
    transfers.push({ from_account_id: nuAcc.id, to_account_id: caixinha.id, amount: -l.valor, date: l.data, description: 'Aplicação na caixinha' })
    continue
  }
  if (/Resgate RDB/.test(d)) {
    transfers.push({ from_account_id: caixinha.id, to_account_id: nuAcc.id, amount: l.valor, date: l.data, description: 'Resgate da caixinha' })
    continue
  }
  if (EU.test(d) && /BRADESCO/i.test(d)) {
    if (l.valor < 0) transfers.push({ from_account_id: nuAcc.id, to_account_id: bradescoAcc.id, amount: -l.valor, date: l.data, description: 'Nubank → Bradesco' })
    else transfers.push({ from_account_id: bradescoAcc.id, to_account_id: nuAcc.id, amount: l.valor, date: l.data, description: 'Bradesco → Nubank' })
    continue
  }
  if (EU.test(d) && /MERCADO PAGO/i.test(d)) {
    tx.push(mk(nuAcc.id, l.data, l.valor, 'A identificar', 'Recebido do Mercado Pago'))
    continue
  }
  const nome = d.replace(/^Compra no débito - /, '').replace(/^Transferência (recebida|enviada) pelo Pix - /, '').split(' - ')[0].trim()
  tx.push(mk(nuAcc.id, l.data, l.valor, l.valor > 0 ? receita(nome) : categoria(d), nome))
}

// --- Bradesco
for (const l of bradesco) {
  const chave = `${l.data}|${l.valor}`
  const conhecido = QR_CONHECIDOS[chave]
  if (l.hist === 'PIX RECEBIDO') continue // já virou transferência pelo lado do Nubank
  if (l.hist === 'PIX ENVIADO' && jaTransferido(l)) continue
  // Pagamento de fatura é TRANSFERÊNCIA conta → cartão, nunca despesa: a
  // despesa já foi reconhecida em cada compra, e contá-la de novo aqui
  // dobraria o gasto e quebraria a conciliação da fatura.
  if (/CARTAO DE CREDITO/i.test(l.hist)) {
    transfers.push({
      from_account_id: bradescoAcc.id,
      to_account_id: cartao.id,
      amount: -l.valor,
      date: l.data,
      description: 'Pagamento da fatura do cartão',
    })
    continue
  }
  const desc = conhecido?.desc ?? rotulo(l.hist)
  const cat = conhecido?.cat ?? (l.valor > 0 ? receita(l.hist) : categoria(l.hist))
  tx.push(mk(bradescoAcc.id, l.data, l.valor, cat, desc))
}

function jaTransferido(l) {
  return transfers.some((t) => t.date === l.data && Math.abs(t.amount - -l.valor) < 0.02 && t.from_account_id === bradescoAcc.id)
}
function rotulo(hist) {
  if (hist === 'COMPRA ELO DEBITO VISTA') return 'Compra no débito'
  if (hist.startsWith('PIX QR')) return 'Pix QR — a identificar'
  if (hist === 'PIX ENVIADO') return 'Pix enviado — a identificar'
  return hist.charAt(0) + hist.slice(1).toLowerCase()
}
function receita(nome) {
  if (/RENDIMENT/i.test(nome)) return 'Rendimentos'
  return 'Outros Recebimentos'
}
function mk(conta, data, valor, cat, desc) {
  return {
    company_id: PESSOAL,
    kind: valor > 0 ? 'income' : 'expense',
    category: cat,
    dre_group: null,
    description: desc.slice(0, 110),
    amount: Math.abs(valor),
    competence_date: data,
    status: 'settled',
    settled_date: data,
    due_date: null,
    is_recurring: false,
    counterparty: null,
    account_id: conta,
    group_id: null,
    installment_index: null,
    installment_count: null,
    card_cycle_month: null,
  }
}

const naoId = tx.filter((t) => t.category === 'A identificar')
console.log(`\nmontados ${tx.length} lançamentos e ${transfers.length} transferências`)
console.log(`  entradas: R$ ${r2(tx.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0))}`)
console.log(`  saídas:   R$ ${r2(tx.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0))}`)
console.log(`  a identificar: ${naoId.length} lançamentos · R$ ${r2(naoId.reduce((s, t) => s + t.amount, 0))}`)

for (let i = 0; i < tx.length; i += 100) await api('transactions', 'POST', tx.slice(i, i + 100))
for (let i = 0; i < transfers.length; i += 100) await api('transfers', 'POST', transfers.slice(i, i + 100))
console.log(
  COMMIT
    ? 'gravado.'
    : `SIMULAÇÃO — nada foi gravado (${bloqueadas} escritas bloqueadas). Rode com --commit para valer.`,
)
