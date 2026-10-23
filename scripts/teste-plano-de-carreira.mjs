/**
 * Teste da migração 041 (plano de carreira) sobre os DADOS REAIS do backup,
 * num Postgres local (PGlite), antes de aplicar em produção.
 *
 * Diferente de teste-sistema.mjs (que aplica as migrações antes dos dados e
 * por isso não roda mais as que dependem de dado real), este carrega o banco
 * de hoje inteiro, aplica SÓ a 041 e prova:
 *   1. nenhum valor existente muda (contagens e somas idênticas);
 *   2. venda com gestor: corretor novo 40% + gestão 3% sobre a base;
 *   3. recebimento libera a gestão junto com o corretor;
 *   4. bônus 8% recalcula só a gestão ainda não paga;
 *   5. desfazer e cancelar levam a gestão junto;
 *   6. o gestor não ganha gestão sobre a própria venda;
 *   7. a função nova não abre para quem não está logado.
 *
 * Rodar:  node scripts/teste-plano-de-carreira.mjs /caminho/do/backup
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const destino = process.argv[2]
if (!destino || !existsSync(join(destino, 'manifesto.json'))) {
  console.error('Uso: node scripts/teste-plano-de-carreira.mjs /caminho/do/backup')
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
const perto = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.011
const db = await new PGlite()
const q = async (sql, p = []) => (await db.query(sql, p)).rows

// ---------------------------------------------------------------- 1. banco de hoje
console.log('1. BANCO DE HOJE (schema + dados do backup)')
for (const papel of ['anon', 'authenticated', 'service_role']) {
  await db.exec(`do $$ begin if not exists (select 1 from pg_roles where rolname='${papel}') then create role ${papel}; end if; end $$;`)
}
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text unique, created_at timestamptz default now());
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('teste.role', true), ''), 'authenticated') $$;
  create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
`)
for (const u of dado('auth_users')) await db.query('insert into auth.users (id, email) values ($1, $2)', [u.id, u.email])

let ddl = readFileSync(join(destino, 'esquema', 'esquema-atual-reconstruido.sql'), 'utf8').replace(/create extension if not exists pgcrypto;/g, '')
await db.exec(ddl)
// As funções de produção que a 041 usa e não substitui (lidas do banco real).
await db.exec(readFileSync(join(repo, 'scripts', 'fixtures', 'funcoes-de-producao-2026-10-23.sql'), 'utf8'))
// O esquema reconstruído perde o ON DELETE das chaves; em produção a parcela
// solta o lançamento apagado (SET NULL). Espelhar isso, senão o teste acusa
// um erro que produção não tem.
for (const col of ['revenue_tx_id', 'iss_tx_id', 'simples_tx_id', 'broker_tx_id', 'owner_tx_id', 'other_tx_id']) {
  await db.exec(`alter table public.sale_installments drop constraint if exists sale_installments_${col}_fkey;
    alter table public.sale_installments add constraint sale_installments_${col}_fkey
      foreign key (${col}) references public.transactions(id) on delete set null;`)
}
await db.exec(`set session_replication_role = replica;`)
for (const tabela of Object.keys(manifesto.tabelas)) {
  const linhas = dado(tabela)
  if (!linhas.length) continue
  const colunas = manifesto.tabelas[tabela].colunas
  for (const l of linhas) {
    await db.query(
      `insert into public.${tabela} (${colunas.join(',')}) values (${colunas.map((_, k) => `$${k + 1}`).join(',')}) on conflict do nothing`,
      colunas.map((c) => (l[c] !== null && typeof l[c] === 'object' ? JSON.stringify(l[c]) : l[c] ?? null)),
    ).catch((e) => ok(false, `carga ${tabela}`, e.message.slice(0, 120)))
  }
}
await db.exec(`set session_replication_role = origin;`)
const IMOB = (await q(`select id from public.companies where slug='imobiliaria'`))[0].id
const admin = (await q(`select id from public.profiles where role='admin' limit 1`))[0]?.id
await db.exec(`set teste.uid = '${admin}'; set teste.role = 'authenticated';`)
ok((await q('select public.is_admin() a'))[0].a === true, 'administrador reconhecido')

const foto = async () => (await q(`
  select (select count(*) from transactions where company_id=$1)::int n,
         (select coalesce(sum(amount),0) from transactions where company_id=$1)::numeric soma,
         (select count(*) from sales)::int vendas,
         (select coalesce(sum(net_amount),0) from sale_installments)::numeric liquido,
         (select coalesce(sum(broker_amount),0) from sale_installments)::numeric corretor`, [IMOB]))[0]
const antes = await foto()
ok(antes.n > 0, 'dados carregados', `${antes.n} lançamentos, ${antes.vendas} vendas`)

// ---------------------------------------------------------------- 2. a migração
console.log('\n2. MIGRAÇÃO 041')
try {
  await db.exec(readFileSync(join(repo, 'supabase', 'migrations', '041_plano_de_carreira.sql'), 'utf8'))
  ok(true, '041 aplicou')
} catch (e) {
  ok(false, '041 aplicou', e.message.slice(0, 300))
}
try {
  await db.exec(readFileSync(join(repo, 'supabase', 'migrations', '041_plano_de_carreira.sql'), 'utf8'))
  ok(true, '041 aplicada de novo não quebra (idempotente)')
} catch (e) {
  ok(false, '041 idempotente', e.message.slice(0, 200))
}
const depois = await foto()
ok(depois.n === antes.n && perto(depois.soma, antes.soma), 'nenhum lançamento mudou', `${depois.n} · ${depois.soma}`)
ok(perto(depois.liquido, antes.liquido) && perto(depois.corretor, antes.corretor), 'nenhuma parcela mudou')
ok((await q(`select count(*)::int c from sales where product_type is null`))[0].c === 0, 'vendas de hoje marcadas como lançamento')
const cfg = (await q(`select * from commission_settings where company_id=$1`, [IMOB]))[0]
ok(cfg && Number(cfg.manager_base_pct) === 3 && Number(cfg.manager_bonus_pct) === 8 && Number(cfg.resale_commission_pct) === 6, 'configuração inicial gravada', cfg ? `${cfg.manager_base_pct}% / ${cfg.manager_bonus_pct}%` : 'sem linha')
ok((await q(`select count(*)::int c from sales_goals where company_id=$1`, [IMOB]))[0].c === 2, 'metas: imobiliária e Dionata')
ok((await q(`select level_override from broker_profiles where contact_id='116f89db-990f-4547-9a8b-41ff43b9f4dc'`))[0]?.level_override === 'senior', 'Dionata Sênior e gestor')

// ---------------------------------------------------------------- 3. venda com gestor
console.log('\n3. VENDA DO CORRETOR NOVO COM GESTÃO DO DIONATA')
const novo = (await q(`insert into contacts (type, name, is_active) values ('broker', 'Corretor Teste', true) returning id`))[0].id
const DIONATA = '116f89db-990f-4547-9a8b-41ff43b9f4dc'
const venda = (await q(`select public.register_sale($1::jsonb) as id`, [JSON.stringify({
  title: 'Venda teste 1M', sale_date: '2026-11-05', property_value: 1000000, commission_pct: 5, commission_total: 50000,
  issues_invoice: true, simples_pct: 6, retains_iss: true, iss_pct: 3, product_type: 'lancamento',
  broker_id: novo, broker_pct: 40, manager_id: DIONATA, manager_pct: 3,
  installments: [{ idx: 1, amount: 25000, expected_date: '2026-11-20' }, { idx: 2, amount: 25000, expected_date: '2027-05-20' }],
})]))[0].id
const p1 = (await q(`select * from sale_installments where sale_id=$1 order by idx`, [venda]))
// 25.000 − ISS 750 = 24.250 → DAS 1.455 → base 22.795 → corretor 40% 9.118 → gestão 3% 683,85
ok(perto(p1[0].broker_amount, 9118) && perto(p1[0].manager_amount, 683.85), 'parcela: corretor 9.118,00 e gestão 683,85', `${p1[0].broker_amount} / ${p1[0].manager_amount}`)
ok(perto(p1[0].net_amount, 22795 - 9118 - 683.85), 'imobiliária fica com 12.993,15 na parcela', p1[0].net_amount)
const tg = (await q(`select * from transactions where id=$1`, [p1[0].manager_tx_id]))[0]
ok(tg && tg.category === 'Gestão de Equipe' && tg.dre_group === 'cost_of_sale' && tg.contact_id === DIONATA, 'lançamento da gestão: custo direto, no nome do Dionata')

const propria = await q(`select public.register_sale($1::jsonb) as id`, [JSON.stringify({
  title: 'Venda do gestor', sale_date: '2026-11-06', commission_total: 1000, broker_id: DIONATA, broker_pct: 50, manager_id: DIONATA, manager_pct: 3,
  installments: [{ idx: 1, amount: 1000, expected_date: '2026-12-01' }],
})]).catch((e) => ({ erro: e.message }))
ok(propria.erro?.includes('própria venda'), 'gestor não ganha gestão sobre a própria venda')

// ---------------------------------------------------------------- 4. recebimento e bônus
console.log('\n4. RECEBER, BÔNUS, DESFAZER, CANCELAR')
await q(`select public.receive_installment($1, '2026-11-20')`, [p1[0].id])
const tg1 = (await q(`select * from transactions where id=$1`, [p1[0].manager_tx_id]))[0]
ok(perto(tg1.amount, 683.85) && tg1.status === 'pending' && String(tg1.due_date).length > 0, 'recebida: gestão liberada para pagar')
const pagas = (await q(`select public.apply_manager_bonus('2026-11-01', 8) n`))[0].n
const p1b = (await q(`select * from sale_installments where sale_id=$1 order by idx`, [venda]))
ok(pagas === 0 && perto(p1b[0].manager_amount, 1823.6) && perto(p1b[1].manager_amount, 1823.6), 'bônus 8%: gestão vira 1.823,60 por parcela', `${p1b[0].manager_amount}`)
const tg2 = (await q(`select amount, description from transactions where id=$1`, [p1[0].manager_tx_id]))[0]
ok(perto(tg2.amount, 1823.6) && tg2.description.includes(' 8% — '), 'lançamento da gestão acompanha o bônus', tg2.description)
await q(`select public.apply_manager_bonus('2026-11-01', 3)`)
ok(perto((await q(`select manager_amount from sale_installments where id=$1`, [p1[0].id]))[0].manager_amount, 683.85), 'bônus desfeito volta a 3%')
await q(`select public.undo_receive_installment($1)`, [p1[0].id])
const desf = (await q(`select status, manager_amount from sale_installments where id=$1`, [p1[0].id]))[0]
ok(desf.status === 'prevista' && perto(desf.manager_amount, 683.85), 'desfazer recebimento mantém a gestão prevista')
await q(`select public.cancel_sale($1, 'teste')`, [venda])
ok((await q(`select count(*)::int c from transactions where sale_id=$1 and category='Gestão de Equipe'`, [venda]))[0].c === 0, 'cancelar a venda tira a gestão prevista')

// ---------------------------------------------------------------- 5. segurança
console.log('\n5. SEGURANÇA')
await db.exec(`set teste.uid = ''; set role anon;`)
const fora = await q(`select public.apply_manager_bonus('2026-11-01', 8)`).catch((e) => ({ erro: e.message }))
ok(Boolean(fora.erro), 'sem login, o bônus não roda', fora.erro?.slice(0, 80))
const leitura = await q(`select count(*)::int c from public.sales_goals`).catch((e) => ({ erro: e.message }))
ok(Boolean(leitura.erro) || leitura[0]?.c === 0, 'sem login, não lê metas')
await db.exec(`reset role;`)

console.log(falhas === 0 ? '\nTUDO CERTO' : `\n✗ ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
