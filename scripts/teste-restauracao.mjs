/**
 * Teste de restauração: reconstrói o banco do zero a partir do backup e
 * confere se o resultado responde as mesmas perguntas do banco original.
 *
 * Por que isto existe: um backup que nunca foi restaurado é uma suposição.
 * Este teste roda um Postgres de verdade (PGlite, WASM, sem Docker e sem
 * tocar em nada remoto), aplica o DDL reconstruído + as migrações 001 a 006 e
 * carrega os dados. Se qualquer coisa no backup não for carregável, falha aqui
 * — não no dia em que for preciso.
 *
 * NÃO acessa a rede. NÃO escreve em nenhum banco remoto.
 *
 * Rodar:  npm run teste-restauracao -- /caminho/do/backup
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const destino = process.argv[2]
if (!destino || !existsSync(join(destino, 'manifesto.json'))) {
  console.error('Uso: npm run teste-restauracao -- /caminho/do/backup')
  process.exit(1)
}

const manifesto = JSON.parse(readFileSync(join(destino, 'manifesto.json'), 'utf8'))
const spec = JSON.parse(readFileSync(join(destino, 'esquema', 'openapi.json'), 'utf8'))
const tabelas = Object.keys(manifesto.tabelas)
const cents = (v) => Math.round(Number(v) * 100)

let falhas = 0
const ok = (cond, msg, detalhe = '') => {
  console.log(`${cond ? '  ok ' : '  ✗ '} ${msg}${detalhe ? '  → ' + detalhe : ''}`)
  if (!cond) falhas++
}

console.log(`Teste de restauração de ${destino}`)
const db = await new PGlite()
const versao = (await db.query('select version() as v')).rows[0].v
console.log(`Postgres local: ${versao.split(',')[0]}\n`)

// ------------------------------------------------------- 1. schema do zero
console.log('1. SCHEMA reconstruído aplica num banco vazio')

// As políticas RLS das migrações concedem acesso a papéis que o Supabase cria
// e um Postgres cru não tem. Sem eles, `create policy ... to authenticated`
// falharia por motivo que não diz nada sobre o backup.
for (const papel of ['anon', 'authenticated', 'service_role']) {
  await db.exec(`do $$ begin if not exists (select 1 from pg_roles where rolname = '${papel}')
    then create role ${papel}; end if; end $$;`)
}
ok(true, 'papéis anon/authenticated/service_role criados')

let ddl = readFileSync(join(destino, 'esquema', 'esquema-atual-reconstruido.sql'), 'utf8')
// pgcrypto não vem no PGlite; no PG13+ gen_random_uuid() é nativo, então a
// extensão é dispensável aqui (no Supabase ela existe).
ddl = ddl.replace(/create extension if not exists pgcrypto;/g, '')
try {
  await db.exec(ddl)
  ok(true, 'esquema-atual-reconstruido.sql aplicado')
} catch (e) {
  ok(false, 'esquema-atual-reconstruido.sql aplicado', e.message)
}

const criadas = (
  await db.query(`select table_name from information_schema.tables where table_schema='public' order by 1`)
).rows.map((r) => r.table_name)
ok(
  tabelas.every((t) => criadas.includes(t)),
  `${criadas.length} tabelas criadas`,
  tabelas.filter((t) => !criadas.includes(t)).join(', '),
)

console.log('\n2. MIGRAÇÕES 001 a 006 aplicam em cima (constraints, índices, RLS)')
const dirMig = join(destino, 'esquema', 'migracoes')
for (const arq of readdirSync(dirMig).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(dirMig, arq), 'utf8'))
    ok(true, arq)
  } catch (e) {
    ok(false, arq, e.message.slice(0, 160))
  }
}
const politicas = (await db.query(`select count(*)::int as n from pg_policies where schemaname='public'`)).rows[0].n
ok(politicas > 0, 'políticas RLS criadas pelas migrações', `${politicas} políticas`)

// --------------------------------------------------------- 3. carga de dados
console.log('\n3. DADOS carregam na ordem das chaves estrangeiras')
const dependencias = new Map(tabelas.map((t) => [t, new Set()]))
for (const t of tabelas) {
  for (const p of Object.values(spec.definitions[t]?.properties ?? {})) {
    const fk = (p.description ?? '').match(/<fk table='([^']+)'/)
    if (fk && fk[1] !== t && tabelas.includes(fk[1])) dependencias.get(t).add(fk[1])
  }
}
const ordem = []
const restantes = new Set(tabelas)
while (restantes.size > 0) {
  const prontas = [...restantes].filter((t) => [...dependencias.get(t)].every((d) => ordem.includes(d)))
  if (prontas.length === 0) break
  for (const t of prontas.sort()) {
    ordem.push(t)
    restantes.delete(t)
  }
}

const dados = {}
for (const tabela of ordem) {
  const linhas = JSON.parse(readFileSync(join(destino, 'dados', `${tabela}.json`), 'utf8'))
  dados[tabela] = linhas
  if (linhas.length === 0) {
    ok(true, `${tabela}: vazia no backup`)
    continue
  }
  const colunas = manifesto.tabelas[tabela].colunas
  try {
    for (let i = 0; i < linhas.length; i += 200) {
      const lote = linhas.slice(i, i + 200)
      const valores = []
      const marcadores = lote
        .map(
          (linha, j) =>
            '(' + colunas.map((_, k) => `$${j * colunas.length + k + 1}`).join(',') + ')',
        )
        .join(',')
      for (const linha of lote) for (const c of colunas) valores.push(linha[c] ?? null)
      await db.query(
        `insert into public.${tabela} (${colunas.join(',')}) values ${marcadores}`,
        valores,
      )
    }
    ok(true, `${tabela}: ${linhas.length} linha(s) inseridas`)
  } catch (e) {
    ok(false, `${tabela}: carga`, e.message.slice(0, 200))
  }
}

// ------------------------------------------ 4. o banco restaurado confere
// Cada conferência é isolada: uma tabela que não existe é uma FALHA a
// relatar, não um motivo para o teste inteiro morrer sem diagnóstico.
console.log('\n4. BANCO RESTAURADO bate com o manifesto')
async function consultar(sql, params = []) {
  try {
    return (await db.query(sql, params)).rows
  } catch (e) {
    return { erro: e.message }
  }
}
for (const tabela of tabelas) {
  const r = await consultar(`select count(*)::int as n from public.${tabela}`)
  if (r.erro) ok(false, `${tabela}: contagem`, r.erro.slice(0, 120))
  else ok(r[0].n === manifesto.tabelas[tabela].linhas, `${tabela}: contagem`, `${r[0].n} vs ${manifesto.tabelas[tabela].linhas}`)
}
for (const tabela of tabelas) {
  for (const [col, esperado] of Object.entries(manifesto.tabelas[tabela].somas ?? {})) {
    const r = await consultar(`select coalesce(sum(${col}), 0) as s from public.${tabela}`)
    if (r.erro) {
      ok(false, `${tabela}.${col}: soma`, r.erro.slice(0, 120))
      continue
    }
    const obtido = Number(r[0].s)
    ok(
      Math.abs(obtido - esperado) < 0.005,
      `${tabela}.${col}: soma`,
      `${obtido.toFixed(2)} vs ${Number(esperado).toFixed(2)}`,
    )
  }
}

// ------------------------------- 5. as perguntas do negócio, no banco novo
console.log('\n5. O BANCO RESTAURADO responde as perguntas do negócio')
const empresas = await consultar(`select id from public.companies where slug = 'imobiliaria'`)
const imob = Array.isArray(empresas) ? empresas[0]?.id : undefined
ok(!!imob, 'a Souza Imobiliária existe no banco restaurado', empresas.erro ?? '')

const caixaRows = await consultar(
  `select
     coalesce(sum(case when kind = 'income' then amount else 0 end), 0) as entrou,
     coalesce(sum(case when kind <> 'income' then amount else 0 end), 0) as saiu
   from public.transactions
   where company_id = $1 and status = 'settled'`,
  [imob],
)
const caixa = Array.isArray(caixaRows) ? caixaRows[0] : { entrou: 0, saiu: 0 }
console.log(
  `  ··  imobiliária, caixa realizado: entrou ${Number(caixa.entrou).toFixed(2)} · saiu ${Number(caixa.saiu).toFixed(2)}`,
)

const pendRows = await consultar(
  `select
     coalesce(sum(case when kind = 'income' then amount else 0 end), 0) as a_receber,
     coalesce(sum(case when kind <> 'income' then amount else 0 end), 0) as a_pagar
   from public.transactions
   where company_id = $1 and status = 'pending'`,
  [imob],
)
const pendentes = Array.isArray(pendRows) ? pendRows[0] : { a_receber: 0, a_pagar: 0 }
console.log(
  `  ··  imobiliária, em aberto: a receber ${Number(pendentes.a_receber).toFixed(2)} · a pagar ${Number(pendentes.a_pagar).toFixed(2)}`,
)

// Os mesmos números recalculados direto do arquivo JSON: se o SQL e o arquivo
// divergirem, a carga alterou algo no caminho.
const doArquivo = (filtro) =>
  (dados.transactions ?? []).filter(filtro).reduce((s, t) => s + cents(t.amount), 0) / 100
ok(
  Math.abs(Number(caixa.entrou) - doArquivo((t) => t.company_id === imob && t.status === 'settled' && t.kind === 'income')) < 0.005,
  'receita recebida da imobiliária: SQL = arquivo',
)
ok(
  Math.abs(Number(pendentes.a_pagar) - doArquivo((t) => t.company_id === imob && t.status === 'pending' && t.kind !== 'income')) < 0.005,
  'a pagar da imobiliária: SQL = arquivo',
)

const vendasRows = await consultar(
  `select count(distinct group_id)::int as n
   from public.transactions
   where company_id = $1 and group_id is not null
     and kind = 'income' and category = 'Comissões de Venda'`,
  [imob],
)
const vendas = Array.isArray(vendasRows) ? vendasRows[0].n : 0
ok(vendas > 0, 'vendas da imobiliária recuperadas', `${vendas} vendas`)

const orfasRows = await consultar(
  `select count(*)::int as n from public.transactions t
    left join public.companies c on c.id = t.company_id
   where c.id is null`,
)
ok(
  Array.isArray(orfasRows) && orfasRows[0].n === 0,
  'nenhum lançamento sem empresa após a restauração',
  orfasRows.erro ?? '',
)

const corretor = await consultar(
  `select ct.name, count(*)::int as linhas, coalesce(sum(t.amount), 0) as total
     from public.transactions t join public.contacts ct on ct.id = t.contact_id
    where t.category = 'Comissões de Corretores'
    group by ct.name`,
)
if (Array.isArray(corretor)) {
  for (const c of corretor) {
    console.log(`  ··  comissões de ${c.name}: ${c.linhas} linha(s) · ${Number(c.total).toFixed(2)}`)
  }
}

await db.close()

const total = Object.values(manifesto.tabelas).reduce((s, t) => s + t.linhas, 0)
console.log(
  `\n${falhas === 0 ? '✓ RESTAURAÇÃO VALIDADA' : `✗ ${falhas} FALHA(S)`}` +
    ` — ${total} linhas recriadas do zero num Postgres vazio` +
    `\n  backup: ${destino}`,
)
process.exit(falhas === 0 ? 0 : 1)
