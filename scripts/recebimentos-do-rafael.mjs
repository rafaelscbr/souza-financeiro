/**
 * Lança o que o Rafael vai receber de cada venda, parcela a parcela.
 *
 * Regras que ele definiu (2026-07-29):
 *   PortoVelas 513-B (Daniela)  → 100% da comissão LÍQUIDA, como corretor
 *   PortoVelas 714-B (Andreia)  → 100% da comissão LÍQUIDA, como corretor
 *   Lago di San Pellegrino      → 50% da comissão líquida, como corretor (ele fez a venda)
 *   Urban Club (Rogga)          → 50% do que sobra para a empresa (sem NF: sem imposto)
 *   PortoVelas 414-D (Anderson) → 50% do que sobra para a empresa
 *
 * Natureza contábil, e a diferença importa:
 *   · quando ele foi o CORRETOR (513-B, 714-B e San Pellegrino) =
 *     `Comissões de Corretores` (cost_of_sale). É custo da venda: reduz o lucro
 *     da imobiliária, independentemente da fatia ser 100% ou 50%.
 *   · quando é a fatia dele no que SOBRA (Rogga e Anderson) =
 *     `Distribuição de Lucro` (withdrawal). Sai do lucro já apurado.
 *
 * Cada lançamento nasce `pending` com vencimento igual ao da parcela que o
 * origina — ele só recebe quando a empresa receber.
 *
 * Rodar:  node --env-file=.env scripts/recebimentos-do-rafael.mjs [--commit]
 */
const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const COMMIT = process.argv.includes('--commit')
const RAFAEL = 'Rafael Alves de Souza'
const r2 = (n) => Math.round(n * 100) / 100

const VENDAS = [
  { chave: '513-B', nome: 'PortoVelas 513-B (Daniela)', fatia: 1.0, tipo: 'corretor' },
  { chave: '714-B', nome: 'PortoVelas 714-B (Andreia)', fatia: 1.0, tipo: 'corretor' },
  { chave: 'Lago di San', nome: 'Lago di San Pellegrino 1302A', fatia: 0.5, tipo: 'corretor' },
  { chave: 'Urban Club', nome: 'Itajaí Urban Club (Rogga)', fatia: 0.5, tipo: 'lucro' },
  { chave: '414-D', nome: 'PortoVelas 414-D (Anderson)', fatia: 0.5, tipo: 'lucro' },
]

const tx = await (
  await fetch(
    `${URL}/rest/v1/transactions?select=*&company_id=neq.ce20350d-3685-416b-a397-5bbaea735798`,
    { headers: H },
  )
).json()

const novos = []
let totalGeral = 0

for (const v of VENDAS) {
  const daVenda = tx.filter((t) => (t.description || '').includes(v.chave))
  const comissoes = daVenda.filter((t) => t.kind === 'income')
  if (comissoes.length === 0) {
    console.log(`\n${v.nome}: nenhuma comissão encontrada — pulada`)
    continue
  }
  // Já existe repasse para o Rafael nesta venda? Não lançar em dobro.
  if (daVenda.some((t) => t.counterparty === RAFAEL)) {
    console.log(`\n${v.nome}: já tem lançamento para o Rafael — pulada`)
    continue
  }

  console.log(`\n${v.nome}  ·  ${v.fatia * 100}% ${v.tipo === 'corretor' ? '(comissão de corretor)' : '(distribuição de lucro)'}`)
  let subtotal = 0

  for (const c of comissoes.sort((a, b) => (a.installment_index ?? 0) - (b.installment_index ?? 0))) {
    const idx = c.installment_index
    const mesma = (t) => (idx == null ? true : t.installment_index === idx)
    // Imposto e repasse a terceiros da MESMA parcela, reconhecidos pela
    // CATEGORIA — nunca por texto da descrição. Filtrar por /Imposto/ na
    // descrição já quebrou uma vez: o repasse foi renomeado para "(sobre
    // comissão líquida de imposto)" e passou a ser contado como imposto,
    // jogando a base para negativo e sumindo com o lançamento.
    const imposto = daVenda
      .filter((t) => t.kind === 'expense' && t.category === 'Impostos e Taxas' && mesma(t))
      .reduce((s, t) => s + t.amount, 0)
    const repasseTerceiro = daVenda
      .filter(
        (t) =>
          t.kind === 'expense' &&
          t.category === 'Comissões de Corretores' &&
          t.counterparty !== RAFAEL &&
          mesma(t),
      )
      .reduce((s, t) => s + t.amount, 0)

    // 100% do corretor: base é a comissão líquida de imposto.
    // 50% do lucro: base é o que REALMENTE sobra (já fora o repasse ao parceiro).
    const base = v.tipo === 'corretor' ? c.amount - imposto : c.amount - imposto - repasseTerceiro
    const valor = r2(base * v.fatia)
    if (valor <= 0) continue
    subtotal += valor

    const venc = c.due_date ?? c.settled_date ?? c.competence_date
    const rotulo = idx != null ? ` — Pc ${idx}/${c.installment_count}` : ''
    novos.push({
      company_id: c.company_id,
      kind: v.tipo === 'corretor' ? 'expense' : 'withdrawal',
      category: v.tipo === 'corretor' ? 'Comissões de Corretores' : 'Distribuição de Lucro',
      dre_group: v.tipo === 'corretor' ? 'cost_of_sale' : 'withdrawal',
      description:
        v.tipo === 'corretor'
          ? `Comissão Rafael ${v.fatia * 100}% — ${v.nome}${rotulo}`
          : `Distribuição Rafael ${v.fatia * 100}% — ${v.nome}${rotulo}`,
      amount: valor,
      competence_date: c.competence_date,
      status: 'pending',
      settled_date: null,
      due_date: venc,
      is_recurring: false,
      counterparty: RAFAEL,
      account_id: null,
      group_id: c.group_id,
      installment_index: idx,
      installment_count: c.installment_count,
      card_cycle_month: null,
    })
    console.log(
      `  Pc ${String(idx ?? '-').padStart(2)}  comissão ${c.amount.toFixed(2).padStart(9)}` +
        `  − imposto ${imposto.toFixed(2).padStart(8)}` +
        (v.tipo === 'lucro' ? `  − parceiro ${repasseTerceiro.toFixed(2).padStart(9)}` : '') +
        `  = base ${base.toFixed(2).padStart(9)}  →  Rafael ${valor.toFixed(2).padStart(9)}  venc ${venc}`,
    )
  }
  totalGeral += subtotal
  console.log(`  subtotal: R$ ${subtotal.toFixed(2)}`)
}

console.log(`\n${novos.length} lançamentos · TOTAL A RECEBER: R$ ${totalGeral.toFixed(2)}`)

if (!COMMIT) {
  console.log('\n(simulação — rode com --commit para gravar)')
  process.exit(0)
}
for (let i = 0; i < novos.length; i += 100) {
  const r = await fetch(`${URL}/rest/v1/transactions`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(novos.slice(i, i + 100)),
  })
  if (!r.ok) {
    console.error('erro ao gravar:', await r.text())
    process.exit(1)
  }
  console.log(`  gravados +${novos.slice(i, i + 100).length}`)
}
console.log('OK')
