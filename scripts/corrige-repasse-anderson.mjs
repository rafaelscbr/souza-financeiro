/**
 * Corrige o repasse do Dionata na venda PortoVelas 414-D (Anderson).
 *
 * A ordem certa é: comissão → tira o imposto → só então aplica o % do corretor.
 * O lançamento original aplicava os 65% sobre a comissão BRUTA, o que paga o
 * parceiro a mais e reduz o líquido da imobiliária.
 *
 *   Pc 1: 17.020,36 − 1.021,22 = 15.999,14 × 65% = 10.399,44
 *   Pc 2: 17.020,35 − 1.021,22 = 15.999,13 × 65% = 10.399,43
 *
 * Rodar com:  node --env-file=.env scripts/corrige-repasse-anderson.mjs
 */
const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const NOVO = { 1: 10399.44, 2: 10399.43 }

const res = await fetch(
  `${URL}/rest/v1/transactions?select=id,amount,installment_index,description` +
    `&description=ilike.*Repasse%20Dionata%2065%25*414-D*`,
  { headers: H },
)
const linhas = await res.json()
if (!Array.isArray(linhas) || linhas.length === 0) {
  console.error('Nenhum repasse do 414-D encontrado — nada foi alterado.')
  process.exit(1)
}

for (const l of linhas) {
  const novo = NOVO[l.installment_index]
  if (novo == null) {
    console.error(`  parcela ${l.installment_index} sem valor previsto — pulada`)
    continue
  }
  const r = await fetch(`${URL}/rest/v1/transactions?id=eq.${l.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({
      amount: novo,
      description: `Repasse Dionata 65% (sobre comissão líquida de imposto) — PortoVelas 414-D — Pc ${l.installment_index}/2`,
    }),
  })
  const [novoReg] = await r.json()
  console.log(`  Pc ${l.installment_index}/2: ${l.amount.toFixed(2)} → ${novoReg.amount.toFixed(2)}`)
}

const conf = await (
  await fetch(
    `${URL}/rest/v1/transactions?select=kind,amount,description&description=ilike.*414-D*`,
    { headers: H },
  )
).json()
const soma = (f) => conf.filter(f).reduce((s, t) => s + t.amount, 0)
const com = soma((t) => t.kind === 'income')
const imp = soma((t) => t.description.includes('Imposto'))
const rep = soma((t) => t.description.includes('Repasse'))
console.log(`\ncomissão ${com.toFixed(2)} − imposto ${imp.toFixed(2)} − repasse ${rep.toFixed(2)}`)
console.log(`líquido da imobiliária: ${(com - imp - rep).toFixed(2)}`)
