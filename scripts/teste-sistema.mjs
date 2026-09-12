/**
 * Teste do sistema novo, ponta a ponta, sem tocar em produção.
 *
 * POR QUE ISTO EXISTE: não é possível aplicar DDL no souza-financeiro por API
 * (nem a service_role executa `create table`), então as migrações 007 a 011 só
 * entram quando o Rafael as cola no SQL Editor. Colar SQL não testado num
 * banco com dados reais é o tipo de coisa que se paga caro. Aqui as migrações
 * rodam num Postgres de verdade (PGlite, WASM, sem Docker e sem rede), sobre os
 * DADOS REAIS do backup, e cada operação da venda é exercitada.
 *
 * Também é o único lugar onde as políticas RLS podem ser testadas de fato: o
 * teste troca de papel (`set role authenticated`) e simula dois usuários — o
 * administrador e um corretor — para provar que o corretor não lê tabela
 * nenhuma e não vê a venda de outro.
 *
 * Rodar:  npm run teste-sistema -- /caminho/do/backup
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const destino = process.argv[2]
if (!destino || !existsSync(join(destino, 'manifesto.json'))) {
  console.error('Uso: npm run teste-sistema -- /caminho/do/backup')
  process.exit(1)
}
const repo = new URL('..', import.meta.url).pathname
const manifesto = JSON.parse(readFileSync(join(destino, 'manifesto.json'), 'utf8'))
const dado = (t) => JSON.parse(readFileSync(join(destino, 'dados', `${t}.json`), 'utf8'))

let falhas = 0
const ok = (cond, msg, detalhe = '') => {
  console.log(`${cond ? '  ok ' : '  ✗ '} ${msg}${detalhe ? '  → ' + detalhe : ''}`)
  if (!cond) falhas++
}
const brl = (n) => Number(n).toFixed(2)
const perto = (a, b, tol = 0.011) => Math.abs(Number(a) - Number(b)) <= tol
/** Consulta isolada: erro de SQL vira falha relatada, não queda do teste. */
async function consultar(sql, params = []) {
  try {
    return (await db.query(sql, params)).rows
  } catch (e) {
    return { erro: e.message }
  }
}

const db = await new PGlite()
console.log('Teste do sistema novo sobre os dados reais do backup')
console.log(`Postgres local: ${(await db.query('select version() as v')).rows[0].v.split(',')[0]}\n`)

// ---------------------------------------------------------------- 1. ambiente
console.log('1. AMBIENTE parecido com o Supabase (papéis + auth.uid)')
for (const papel of ['anon', 'authenticated', 'service_role']) {
  await db.exec(`do $$ begin if not exists (select 1 from pg_roles where rolname='${papel}')
    then create role ${papel}; end if; end $$;`)
}
// auth.uid() é a peça do Supabase que decide quem está falando. O stub lê de
// uma variável de sessão, o que permite trocar de usuário no teste.
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key, email text unique, created_at timestamptz default now());
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
`)
const usuarios = dado('auth_users')
for (const u of usuarios) {
  await db.query('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [u.id, u.email])
}
ok(usuarios.length > 0, 'usuários do Auth carregados do backup', usuarios.map((u) => u.email).join(', '))

// ------------------------------------------------------------- 2. migrações
console.log('\n2. SCHEMA e as 11 migrações aplicam em sequência')
let ddl = readFileSync(join(destino, 'esquema', 'esquema-atual-reconstruido.sql'), 'utf8')
ddl = ddl.replace(/create extension if not exists pgcrypto;/g, '')
try {
  await db.exec(ddl)
  ok(true, 'schema base (reconstruído do backup)')
} catch (e) {
  ok(false, 'schema base', e.message.slice(0, 160))
}

const dirMig = join(repo, 'supabase', 'migrations')
for (const arq of readdirSync(dirMig).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(dirMig, arq), 'utf8'))
    ok(true, arq)
  } catch (e) {
    ok(false, arq, e.message.slice(0, 200))
  }
}

// Grants como no Supabase: quem barra o corretor é a RLS, não a falta de grant.
await db.exec(`
  grant usage on schema public to authenticated, anon;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
`)

// ----------------------------------------------------------------- 3. dados
console.log('\n3. DADOS REAIS do backup carregados')
const ordemCarga = [
  'companies', 'contacts', 'accounts', 'categories', 'cost_centers',
  'transactions', 'transfers', 'goals', 'objectives', 'period_closings',
  'personal_budgets', 'personal_assets', 'transaction_templates',
]
for (const tabela of ordemCarga) {
  const linhas = dado(tabela)
  if (linhas.length === 0) continue
  const colunas = manifesto.tabelas[tabela].colunas
  const valores = []
  const marcadores = linhas
    .map((_, j) => '(' + colunas.map((_, k) => `$${j * colunas.length + k + 1}`).join(',') + ')')
    .join(',')
  for (const l of linhas) for (const c of colunas) valores.push(l[c] ?? null)
  try {
    await db.query(`insert into public.${tabela} (${colunas.join(',')}) values ${marcadores}`, valores)
    ok(true, `${tabela}: ${linhas.length} linhas`)
  } catch (e) {
    ok(false, `${tabela}`, e.message.slice(0, 160))
  }
}

const IMOB = (await db.query(`select id from public.companies where slug='imobiliaria'`)).rows[0].id
const ADMIN = usuarios[0].id
const comoAdmin = async () => db.exec(`set role postgres; set teste.uid = '${ADMIN}';`)
await comoAdmin()
ok(
  (await db.query('select public.is_admin() as a')).rows[0].a === true,
  'is_admin() reconhece o Rafael como administrador',
)

// ------------------------------------------------------- 4. migração das vendas
console.log('\n4. MIGRAÇÃO das vendas antigas (011)')
const simulado = (await db.query('select public.migrate_legacy_sales(false) as r')).rows[0].r
ok(simulado.gravou === false, 'simulação não grava', `${simulado.vendas} venda(s) seriam migradas`)
ok(
  (await db.query('select count(*)::int n from public.sales')).rows[0].n === 0,
  'nenhuma venda criada na simulação',
)
for (const v of simulado.relatorio) {
  console.log(
    `  ··  ${String(v.titulo).slice(0, 46).padEnd(46)} ${String(v.parcelas).padStart(2)}x ` +
      `${brl(v.comissao).padStart(10)} · ${v.corretor ?? 'sem corretor'} ${v.corretor_pct ?? '-'}%` +
      ` · NF ${v.nf ? 'sim' : 'não'}${v.iss ? ' · ISS retido' : ''}`,
  )
}

const gravado = (await db.query('select public.migrate_legacy_sales(true) as r')).rows[0].r
ok(gravado.vendas === simulado.vendas, 'migração gravou o que a simulação previu', `${gravado.vendas} vendas`)
ok(
  perto(gravado.conferencia.comissao_no_razao, gravado.conferencia.comissao_nas_vendas),
  'comissão nas vendas = comissão no razão',
  `${brl(gravado.conferencia.comissao_no_razao)} vs ${brl(gravado.conferencia.comissao_nas_vendas)}`,
)
ok(
  gravado.conferencia.linhas_de_venda_sem_vinculo === 0,
  'nenhuma linha de comissão ficou sem venda',
  String(gravado.conferencia.linhas_de_venda_sem_vinculo),
)
// Rodar de novo não acha nada: as linhas do razão já apontam para a venda,
// então o grupo nem entra no laço. É o que idempotência significa aqui.
const repetida = (await db.query('select public.migrate_legacy_sales(true) as r')).rows[0].r
ok(repetida.vendas === 0, 'migração é idempotente (rodar de novo não duplica)',
  `${repetida.vendas} nova(s), ${repetida.puladas_ja_migradas} pulada(s)`)
ok(
  (await db.query('select count(*)::int n from public.sales')).rows[0].n === gravado.vendas,
  'continua com o mesmo número de vendas depois da segunda rodada',
)
for (const d of gravado.divergencias ?? []) {
  console.log(
    `  ··  divergência: ${d.venda} Pc ${d.parcela} — gravado ${brl(d.corretor_gravado)}, ` +
      `regra de hoje daria ${brl(d.corretor_calculado)} (${brl(d.diferenca)})`,
  )
}

// A venda 414-D é o caso completo: ISS retido, Simples sobre o líquido,
// corretor 65% e um desconto combinado na primeira parcela.
const v414 = (
  await db.query(
    `select s.*, i.idx, i.amount, i.iss_amount, i.simples_amount, i.broker_amount, i.status,
            i.received_amount
       from public.sales s join public.sale_installments i on i.sale_id = s.id
      where s.title ilike '%414-D%' order by i.idx`,
  )
).rows
ok(v414.length === 2, 'PortoVelas 414-D migrou com 2 parcelas')
if (v414.length === 2) {
  ok(v414[0].retains_iss === true && perto(v414[0].iss_pct, 3), '414-D: ISS retido 3% reconhecido')
  ok(perto(v414[0].simples_pct, 6), '414-D: Simples 6% reconhecido')
  ok(perto(v414[0].broker_pct, 65), '414-D: corretor 65% reconhecido')
  ok(perto(v414[0].iss_amount, 510.61) && perto(v414[1].iss_amount, 510.61), '414-D: ISS de cada parcela')
  ok(perto(v414[0].simples_amount, 990.58), '414-D: Simples da parcela 1')
  ok(perto(v414[0].broker_amount, 10000) && perto(v414[1].broker_amount, 10087.45),
    '414-D: comissão do corretor como foi gravada (com o desconto da parcela 1)')
  ok(v414[0].status === 'recebida' && v414[1].status === 'prevista', '414-D: situação das parcelas')
  ok(perto(v414[0].received_amount, 16509.75), '414-D: caiu na conta o líquido de ISS',
    brl(v414[0].received_amount))
}

// ------------------------------------------------- 5. registrar venda nova
console.log('\n5. REGISTRAR VENDA aplica a cascata na ordem certa')
const dionata = (await db.query(`select id from public.contacts where name ilike 'Dionata%'`)).rows[0].id
const cc = (await db.query(`select id from public.cost_centers where name ilike '%PortoVelas%'`)).rows[0].id
const novaVenda = (
  await db.query(`select public.register_sale($1::jsonb) as id`, [
    JSON.stringify({
      title: 'TESTE — Unid. 101, Ed. Exemplo',
      cost_center_id: cc,
      unit: '101',
      client_name: 'Cliente de Teste',
      sale_date: '2026-09-01',
      property_value: 500000,
      commission_pct: 5,
      commission_total: 25000,
      issues_invoice: true,
      simples_pct: 6,
      retains_iss: true,
      iss_pct: 3,
      broker_id: dionata,
      broker_pct: 65,
      installments: [
        { idx: 1, expected_date: '2026-10-10', amount: 12500 },
        { idx: 2, expected_date: '2026-11-10', amount: 12500 },
      ],
    }),
  ])
).rows[0].id
ok(!!novaVenda, 'venda registrada')

const p1 = (
  await db.query(
    `select * from public.sale_installments where sale_id = $1 and idx = 1`, [novaVenda],
  )
).rows[0]
// 12.500 − 3% (375) = 12.125 → Simples 6% = 727,50 → base 11.397,50 → 65% = 7.408,38
ok(perto(p1.iss_amount, 375), 'ISS 3% da parcela', brl(p1.iss_amount))
ok(perto(p1.simples_amount, 727.5), 'Simples 6% sobre a parcela líquida de ISS', brl(p1.simples_amount))
ok(perto(p1.broker_amount, 7408.38), 'corretor 65% sobre a base líquida dos dois impostos', brl(p1.broker_amount))
ok(perto(p1.net_amount, 12500 - 375 - 727.5 - 7408.38), 'líquido da imobiliária fecha', brl(p1.net_amount))

const linhas = (
  await db.query(
    `select category, kind, amount, status, due_date, dre_group
       from public.transactions where sale_installment_id = $1 order by category, amount desc`,
    [p1.id],
  )
).rows
ok(linhas.length === 4, 'a parcela gerou 4 linhas no razão (receita, ISS, Simples, corretor)',
  `${linhas.length}: ${linhas.map((l) => l.category).join(', ')}`)
ok(linhas.every((l) => l.status === 'pending'), 'tudo nasce pendente')

const somaErrada = await db
  .query(`select public.register_sale($1::jsonb) as id`, [
    JSON.stringify({
      title: 'TESTE — parcelas que não fecham', sale_date: '2026-09-01', commission_total: 10000,
      installments: [{ idx: 1, expected_date: '2026-10-10', amount: 4000 }],
    }),
  ])
  .then(() => null)
  .catch((e) => e.message)
ok(!!somaErrada && /fechar/.test(somaErrada), 'venda com parcelas que não somam a comissão é recusada')

// -------------------------------------------------------- 6. receber parcela
console.log('\n6. RECEBER PARCELA com ISS retido')
const conta = (await db.query(
  `select id from public.accounts where company_id = $1 and type = 'checking'`, [IMOB])).rows[0].id
await db.query(`select public.receive_installment($1, $2::date, $3, $4, $5, $6, $7)`, [
  p1.id, '2026-10-12', conta, 12125, 375, 0, 'recebido com ISS retido pela construtora',
])
const p1b = (await db.query(`select * from public.sale_installments where id = $1`, [p1.id])).rows[0]
ok(p1b.status === 'recebida', 'parcela marcada como recebida')
ok(perto(p1b.received_amount, 12125), 'recebido = parcela menos ISS', brl(p1b.received_amount))

const receita = (await db.query(
  `select status, settled_date, account_id, amount from public.transactions where id = $1`,
  [p1b.revenue_tx_id])).rows[0]
ok(receita.status === 'settled' && perto(receita.amount, 12500),
  'receita liquidada pelo valor cheio (base do imposto)', brl(receita.amount))
const issTx = (await db.query(
  `select status, settled_date, amount from public.transactions where id = $1`, [p1b.iss_tx_id])).rows[0]
ok(issTx.status === 'settled' && perto(issTx.amount, 375),
  'ISS lançado como saída no mesmo dia (efeito no saldo = líquido que caiu)')
// Datas são comparadas com to_char no próprio banco: um `date` devolvido ao
// JavaScript vira Date em UTC e, num fuso negativo, 2026-11-20 se imprime como
// 19/11 — falso alarme que não tem nada a ver com o dado gravado.
const simplesTx = (await db.query(
  `select status, to_char(due_date,'YYYY-MM-DD') as venc, amount
     from public.transactions where id = $1`, [p1b.simples_tx_id])).rows[0]
ok(simplesTx.status === 'pending' && simplesTx.venc === '2026-11-20',
  'Simples a pagar com a guia vencendo dia 20 do mês seguinte', simplesTx.venc)
const brokerTx = (await db.query(
  `select status, to_char(due_date,'YYYY-MM-DD') as venc, amount
     from public.transactions where id = $1`, [p1b.broker_tx_id])).rows[0]
ok(brokerTx.status === 'pending' && brokerTx.venc === '2026-10-12',
  'comissão do corretor liberada na data do recebimento', brokerTx.venc)
ok(
  (await db.query(`select public.broker_status(status, broker_tx_id) as s
                     from public.sale_installments where id = $1`, [p1.id])).rows[0].s === 'liberada',
  'para o corretor, a comissão desta parcela está "liberada"',
)

const contaErrada = await db
  .query(`select public.receive_installment($1, $2::date, $3, $4, $5, $6, null)`,
    [(await db.query(`select id from public.sale_installments where sale_id=$1 and idx=2`, [novaVenda])).rows[0].id,
      '2026-11-12', conta, 9000, 100, 0])
  .then(() => null)
  .catch((e) => e.message)
ok(!!contaErrada && /não fecha/.test(contaErrada), 'recebimento cuja conta não fecha é recusado')

// ------------------------------------------------------- 7. pagar comissão
console.log('\n7. PAGAR COMISSÃO, com desconto combinado')
await db.query(`select public.pay_broker_installments($1::uuid[], $2::date, $3, $4, $5)`, [
  [p1.id], '2026-10-15', conta, 408.38, 'desconto combinado da cesta',
])
const pago = (await db.query(
  `select status, amount, description from public.transactions where id = $1`, [p1b.broker_tx_id])).rows[0]
ok(pago.status === 'settled' && perto(pago.amount, 7000),
  'comissão paga pelo valor com desconto', brl(pago.amount))
ok(/desconto/.test(pago.description), 'o desconto fica registrado na descrição')

const desfazerBloqueado = await db
  .query(`select public.undo_receive_installment($1)`, [p1.id])
  .then(() => null)
  .catch((e) => e.message)
ok(!!desfazerBloqueado && /já foi paga/.test(desfazerBloqueado),
  'desfazer recebimento é bloqueado quando a comissão já foi paga')

// ------------------------------------------- 8. reagendar, desfazer, cancelar
console.log('\n8. REAGENDAR, DESFAZER e CANCELAR')
const p2 = (await db.query(
  `select * from public.sale_installments where sale_id=$1 and idx=2`, [novaVenda])).rows[0]
await db.query(`select public.reschedule_installment($1, $2::date, $3)`,
  [p2.id, '2026-12-05', 'construtora empurrou'])
const p2b = (await db.query(
  `select *, to_char(expected_date,'YYYY-MM-DD') as venc
     from public.sale_installments where id=$1`, [p2.id])).rows[0]
ok(p2b.venc === '2026-12-05', 'parcela reagendada', p2b.venc)
ok(/reagendada de 10\/11\/2026 para 05\/12\/2026/.test(p2b.notes ?? ''), 'a data anterior fica na nota')
const venc = (await db.query(
  `select count(*)::int as total,
          count(*) filter (where due_date = '2026-12-05')::int as na_data
     from public.transactions where sale_installment_id = $1 and status='pending'`, [p2.id])).rows[0]
ok(venc.total > 0 && venc.na_data === venc.total,
  'todas as linhas pendentes da parcela seguiram a nova data', `${venc.na_data}/${venc.total}`)

await db.query(`select public.receive_installment($1, $2::date, $3, null, null, 0, null)`,
  [p2.id, '2026-12-05', conta])
await db.query(`select public.undo_receive_installment($1)`, [p2.id])
const p2c = (await db.query(`select * from public.sale_installments where id=$1`, [p2.id])).rows[0]
ok(p2c.status === 'prevista' && p2c.received_date === null, 'desfazer volta a parcela para prevista')
ok(
  (await db.query(`select status from public.transactions where id=$1`, [p2c.revenue_tx_id])).rows[0].status === 'pending',
  'a receita volta a pendente',
)

const pendentesDePrevistas = async () =>
  (await db.query(
    `select count(*)::int n from public.transactions t
       join public.sale_installments i on i.id = t.sale_installment_id
      where t.sale_id = $1 and t.status = 'pending' and i.status = 'prevista'`, [novaVenda])).rows[0].n
const antesCancelar = await pendentesDePrevistas()
await db.query(`select public.cancel_sale($1, $2)`, [novaVenda, 'distrato de teste'])
ok(antesCancelar > 0 && (await pendentesDePrevistas()) === 0,
  'cancelar apaga o que ainda não tinha acontecido', `${antesCancelar} → 0`)
ok(
  (await db.query(`select count(*)::int n from public.transactions
     where sale_id=$1 and status='settled'`, [novaVenda])).rows[0].n > 0,
  'o que já havia sido recebido e pago continua no razão',
)
// O imposto de uma parcela JÁ RECEBIDA continua devido: o dinheiro entrou e a
// nota saiu. Cancelar a venda não desfaz obrigação com o governo.
const impostoQueSobra = (await db.query(
  `select coalesce(sum(t.amount),0) as s from public.transactions t
     join public.sale_installments i on i.id = t.sale_installment_id
    where t.sale_id = $1 and t.status = 'pending' and i.status = 'recebida'`, [novaVenda])).rows[0].s
ok(Number(impostoQueSobra) > 0,
  'o imposto de parcela já recebida continua a pagar depois do cancelamento', brl(impostoQueSobra))
ok(
  (await db.query(`select status from public.sales where id=$1`, [novaVenda])).rows[0].status === 'cancelada',
  'venda marcada como cancelada',
)

// ------------------------------------------------------ 9. área do corretor
console.log('\n9. ÁREA DO CORRETOR: só o que é dele, e nada de tabela')
const uidDionata = '11111111-1111-4111-8111-111111111111'
await db.query(`insert into auth.users (id, email) values ($1, $2)`, [uidDionata, 'dionata@exemplo.com'])
await db.query(
  `insert into public.profiles (id, role, contact_id, name) values ($1, 'corretor', $2, 'Dionata Alves')`,
  [uidDionata, dionata],
)

const comoCorretor = async () => db.exec(`set role authenticated; set teste.uid = '${uidDionata}';`)
await comoCorretor()
ok((await db.query('select public.is_admin() as a')).rows[0].a === false, 'corretor não é administrador')

// A prova que importa: com a RLS valendo, ele não lê nenhuma tabela.
for (const tabela of ['transactions', 'sales', 'sale_installments', 'accounts', 'contacts', 'companies']) {
  const n = (await db.query(`select count(*)::int n from public.${tabela}`)).rows[0].n
  ok(n === 0, `corretor não lê ${tabela}`, `${n} linha(s) visíveis`)
}
const seuPerfil = (await db.query('select count(*)::int n from public.profiles')).rows[0].n
ok(seuPerfil === 1, 'corretor lê só o próprio perfil', `${seuPerfil}`)

const home = (await db.query('select public.broker_home(2026) as r')).rows[0].r
ok(Number(home.commission_total) > 0, 'painel do corretor traz a comissão dele', brl(home.commission_total))
console.log(
  `  ··  Dionata em 2026: ${home.sales_count} venda(s) · VGV ${brl(home.vgv)}` +
    `${home.sales_without_vgv > 0 ? ` (${home.sales_without_vgv} sem VGV informado)` : ''}`,
)
console.log(
  `  ··  comissão ${brl(home.commission_total)} = recebida ${brl(home.commission_received)}` +
    ` + liberada ${brl(home.commission_released)} + prevista ${brl(home.commission_expected)}`,
)

const suasVendas = (await db.query('select * from public.broker_sales()')).rows
ok(suasVendas.length === 2, 'corretor vê só as 2 vendas dele (Urban Club e 414-D)',
  suasVendas.map((v) => String(v.title).slice(0, 28)).join(' | '))
ok(
  !suasVendas.some((v) => /513-B|714-B|San Pellegrino/.test(String(v.title))),
  'as vendas em que o corretor foi o próprio dono não aparecem para ele',
)

const recebimentos = (await db.query('select * from public.broker_installments()')).rows
ok(recebimentos.length > 0, 'cronograma de recebimentos do corretor', `${recebimentos.length} parcelas`)
const colunas = Object.keys(recebimentos[0] ?? {})
ok(!colunas.includes('net_amount'), 'o corretor NÃO recebe o líquido da imobiliária')
ok(
  colunas.includes('installment_amount') && colunas.includes('iss_amount') && colunas.includes('simples_amount'),
  'o corretor recebe a base do cálculo para conferir o próprio número',
)
const situacoes = [...new Set(recebimentos.map((r) => r.status))].sort()
ok(
  situacoes.every((s) => ['prevista', 'liberada', 'recebida'].includes(s)),
  'situações no vocabulário do corretor',
  situacoes.join(', '),
)
const doOutro = (await db.query('select public.broker_sale($1) as r', [
  (await (async () => { await comoAdmin(); const r = await db.query(
    `select id from public.sales where title ilike '%513-B%'`); await comoCorretor(); return r })()).rows[0].id,
])).rows[0].r
ok(doOutro === null, 'pedir a ficha de uma venda que não é dele devolve vazio')

// Escrita: o corretor é somente consulta.
await comoCorretor()
const tentouGravar = await db
  .query(`insert into public.transactions (company_id, kind, category, description, amount, competence_date, status)
          values ($1, 'expense', 'Outras Variáveis', 'invasão', 1, current_date, 'settled')`, [IMOB])
  .then(() => 'gravou')
  .catch(() => 'bloqueado')
ok(tentouGravar === 'bloqueado', 'corretor não consegue gravar lançamento')
const tentouRegistrar = await db
  .query(`select public.register_sale('{"title":"x","sale_date":"2026-09-01","commission_total":0,"installments":[]}'::jsonb)`)
  .then(() => 'passou')
  .catch((e) => e.message)
ok(/administrador/.test(String(tentouRegistrar)), 'corretor não consegue registrar venda')

// ------------------------------------------------- 10. o razão segue íntegro
console.log('\n10. O RAZÃO continua íntegro depois de tudo')
await comoAdmin()
const somaAtual = (await db.query(
  `select coalesce(sum(amount),0) s from public.transactions
    where company_id = $1 and sale_id is null`, [IMOB])).rows[0].s
const somaBackup = dado('transactions')
  .filter((t) => t.company_id === IMOB && !/^(Comissões de Venda|Impostos e Taxas|Comissões de Corretores)$/.test(t.category))
  .reduce((s, t) => s + Math.round(Number(t.amount) * 100), 0) / 100
ok(perto(somaAtual, somaBackup, 0.02),
  'lançamentos fora de venda intocados pela migração', `${brl(somaAtual)} vs ${brl(somaBackup)}`)
const pf = (await db.query(
  `select count(*)::int n from public.transactions t join public.companies c on c.id=t.company_id
    where c.is_personal`)).rows[0].n
ok(pf === 660, 'o razão pessoal segue intocado (será arquivado, não migrado)', `${pf} linhas`)
const orfas = (await db.query(
  `select count(*)::int n from public.transactions
    where sale_installment_id is not null and sale_id is null`)).rows[0].n
ok(orfas === 0, 'nenhum lançamento aponta para parcela sem venda')

// ------------------------------- 11. o app e o banco falam a mesma língua
// A classe de erro mais perigosa aqui: o app chamar uma função do banco com
// nome de parâmetro diferente do declarado. O supabase-js manda os argumentos
// por NOME, então um `p_date` virando `p_data` só falharia em produção, na mão
// do Rafael. Este bloco lê o código-fonte e confere cada chamada.
console.log('\n11. CHAMADAS do app conferem com as funções do banco')
const { readdirSync: lerDir, statSync } = await import('node:fs')
function arquivosDe(dir) {
  return lerDir(dir).flatMap((f) => {
    const caminho = join(dir, f)
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho)
    return /\.(ts|tsx)$/.test(f) ? [caminho] : []
  })
}
const fontes = arquivosDe(join(repo, 'src'))
const chamadas = new Map()
for (const arquivo of fontes) {
  const texto = readFileSync(arquivo, 'utf8')
  // .rpc('nome', { p_x: ..., p_y: ... })  ·  também pega .rpc('nome')
  for (const m of texto.matchAll(/(?:\.rpc|chamar)\(\s*'([a-z_0-9]+)'\s*(?:,\s*\{([^}]*)\})?/g)) {
    const nome = m[1]
    const args = (m[2] ?? '')
      .split(',')
      .map((a) => a.split(':')[0].trim())
      .filter((a) => /^[a-z_][a-z_0-9]*$/.test(a))
    const atual = chamadas.get(nome) ?? new Set()
    for (const a of args) atual.add(a)
    chamadas.set(nome, atual)
  }
}
ok(chamadas.size > 0, `${chamadas.size} função(ões) do banco chamadas pelo app`,
  [...chamadas.keys()].join(', '))

for (const [nome, args] of chamadas) {
  const r = await consultar(
    `select p.proname,
            coalesce(array_to_string(p.proargnames, ','), '') as nomes
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`,
    [nome],
  )
  if (r.erro || r.length === 0) {
    ok(false, `${nome}: existe no banco`, r.erro ?? 'função não encontrada')
    continue
  }
  const declarados = new Set(String(r[0].nomes).split(',').filter(Boolean))
  const faltando = [...args].filter((a) => !declarados.has(a))
  ok(faltando.length === 0, `${nome}(${[...args].join(', ') || 'sem argumentos'})`,
    faltando.length ? `parâmetro(s) inexistente(s): ${faltando.join(', ')}` : '')
}

// As tabelas e colunas que o app lê também precisam existir.
const leituras = new Map()
for (const arquivo of fontes) {
  const texto = readFileSync(arquivo, 'utf8')
  for (const m of texto.matchAll(/\.from\(\s*'([a-z_0-9]+)'\s*\)/g)) {
    leituras.set(m[1], (leituras.get(m[1]) ?? 0) + 1)
  }
}
for (const [tabela] of leituras) {
  const r = await consultar(
    `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
    [tabela],
  )
  ok(!r.erro && r.length === 1, `tabela ${tabela} existe`)
}

// ---------------------------------------- 12. arquivamento preserva, não apaga
console.log('\n12. ARQUIVAMENTO copia o que sai do escopo e não apaga nada')
await comoAdmin()
const antesPublic = (await db.query('select count(*)::int n from public.transactions')).rows[0].n
const simArq = (await db.query('select public.archive_out_of_scope(false) as r')).rows[0].r
ok(simArq.copiou === false, 'simulação do arquivamento não copia')
console.log(
  `  ··  fora do escopo: ${simArq.empresas_fora_do_escopo.map((e) => e.nome).join(', ')}`,
)
console.log(
  `  ··  linhas: ${Object.entries(simArq.linhas).filter(([, n]) => Number(n) > 0)
    .map(([t, n]) => `${t} ${n}`).join(' · ')}`,
)
ok(
  Number(simArq.linhas.transactions) === 668,
  'contou os 668 lançamentos fora do escopo (660 pessoais + 8 da Assessoria)',
  String(simArq.linhas.transactions),
)

const arq = (await db.query('select public.archive_out_of_scope(true) as r')).rows[0].r
ok(arq.copiou === true, 'arquivamento executado')
const noArquivo = (await db.query('select count(*)::int n from arquivo.transactions')).rows[0].n
ok(noArquivo === 668, 'o arquivo guarda os 668 lançamentos', String(noArquivo))
const depoisPublic = (await db.query('select count(*)::int n from public.transactions')).rows[0].n
ok(
  depoisPublic === antesPublic,
  'NADA foi apagado de public pelo arquivamento',
  `${antesPublic} antes, ${depoisPublic} depois`,
)
ok(
  (await db.query(
    `select count(*)::int n from public.companies where is_archived`)).rows[0].n === 3,
  'as três empresas fora do escopo ficam marcadas como arquivadas',
)
const semConfirmacao = await db
  .query(`select public.purge_archived('apagar')`)
  .then(() => null)
  .catch((e) => e.message)
ok(
  !!semConfirmacao && /Confirmação necessária/.test(semConfirmacao),
  'apagar exige a frase de confirmação exata',
)
// A exclusão NÃO é executada neste teste: ela é decisão do Rafael, depois de
// exportar o arquivo. O que se prova aqui é que a porta existe e está trancada.

await db.close()
console.log(
  `\n${falhas === 0 ? '✓ SISTEMA VALIDADO' : `✗ ${falhas} FALHA(S)`}` +
    ' — 12 migrações, dados reais, migração de vendas, operações e acesso' +
    `\n  backup usado: ${destino}`,
)
process.exit(falhas === 0 ? 0 : 1)
