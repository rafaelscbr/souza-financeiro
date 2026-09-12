/**
 * Restaura um backup gerado por scripts/backup.mjs para um projeto Supabase.
 *
 * Como este é o único script do repositório que grava em cima de dados
 * existentes, ele é paranoico de propósito:
 *
 * · Simulação por padrão. Sem `--commit`, nada é enviado.
 * · Nunca apaga nada. A gravação é upsert por chave primária
 *   (`resolution=merge-duplicates`): linha que existe é atualizada, linha que
 *   falta é criada. Um backup restaurado nunca deve destruir o que estava lá.
 * · Se a tabela de destino já tem linhas, ele PARA e exige `--force`. Restaurar
 *   em cima de um banco em uso é quase sempre engano.
 * · Insere na ordem topológica das chaves estrangeiras, senão a primeira
 *   transação já quebra por referência ausente.
 *
 * Rodar:  node --env-file=.env scripts/restaura-backup.mjs /caminho/do/backup
 *         node --env-file=.env scripts/restaura-backup.mjs /caminho --commit
 *         node --env-file=.env scripts/restaura-backup.mjs /caminho --commit --force
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROJETO_PROIBIDO = 'dczexbzsfdavcrwiungk' // icrm — NUNCA

const destino = process.argv[2]
const COMMIT = process.argv.includes('--commit')
const FORCE = process.argv.includes('--force')

if (!destino || !existsSync(join(destino, 'manifesto.json'))) {
  console.error('Uso: node --env-file=.env scripts/restaura-backup.mjs /caminho/do/backup [--commit] [--force]')
  process.exit(1)
}
if (!BASE || !KEY) {
  console.error('Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (BASE.includes(PROJETO_PROIBIDO)) {
  console.error('ABORTADO: o destino é o projeto icrm. Este script nunca escreve no icrm.')
  process.exit(1)
}

const manifesto = JSON.parse(readFileSync(join(destino, 'manifesto.json'), 'utf8'))
const spec = JSON.parse(readFileSync(join(destino, 'esquema', 'openapi.json'), 'utf8'))
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const tabelas = Object.keys(manifesto.tabelas)

console.log(`Restaurando ${destino}`)
console.log(`Destino: ${BASE}`)
console.log(COMMIT ? '\n⚠  MODO GRAVAÇÃO (--commit)\n' : '\nSIMULAÇÃO — nada será gravado. Use --commit para valer.\n')

// Ordem topológica pelas chaves estrangeiras declaradas no schema.
const dependencias = new Map(tabelas.map((t) => [t, new Set()]))
for (const tabela of tabelas) {
  for (const p of Object.values(spec.definitions[tabela]?.properties ?? {})) {
    const fk = (p.description ?? '').match(/<fk table='([^']+)' column='([^']+)'\/>/)
    if (fk && fk[1] !== tabela && tabelas.includes(fk[1])) dependencias.get(tabela).add(fk[1])
  }
}
const ordem = []
const restantes = new Set(tabelas)
while (restantes.size > 0) {
  const prontas = [...restantes].filter((t) => [...dependencias.get(t)].every((d) => ordem.includes(d)))
  if (prontas.length === 0) {
    console.error('Ciclo de dependência entre tabelas:', [...restantes].join(', '))
    process.exit(1)
  }
  for (const t of prontas.sort()) {
    ordem.push(t)
    restantes.delete(t)
  }
}

let bloqueadas = 0
let enviadas = 0

for (const tabela of ordem) {
  const linhas = JSON.parse(readFileSync(join(destino, 'dados', `${tabela}.json`), 'utf8'))
  if (linhas.length === 0) {
    console.log(`  --  ${tabela.padEnd(23)} vazia no backup, nada a fazer`)
    continue
  }

  // Quantas linhas já existem no destino? É a diferença entre restaurar e
  // atropelar.
  const r = await fetch(`${BASE}/rest/v1/${tabela}?select=id&limit=1`, {
    headers: { ...H, Prefer: 'count=exact' },
  })
  const existentes = Number((r.headers.get('content-range') ?? '/0').split('/')[1])
  if (existentes > 0 && !FORCE) {
    console.log(
      `  ✗   ${tabela.padEnd(23)} o destino já tem ${existentes} linha(s). Use --force para fazer upsert em cima.`,
    )
    bloqueadas++
    continue
  }

  if (!COMMIT) {
    console.log(`  ··  ${tabela.padEnd(23)} enviaria ${linhas.length} linha(s) (destino tem ${existentes})`)
    enviadas += linhas.length
    continue
  }

  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500)
    const resp = await fetch(`${BASE}/rest/v1/${tabela}`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lote),
    })
    if (!resp.ok) {
      console.error(`  ✗   ${tabela}: ${resp.status} ${(await resp.text()).slice(0, 300)}`)
      process.exit(1)
    }
    enviadas += lote.length
  }
  console.log(`  ok  ${tabela.padEnd(23)} ${linhas.length} linha(s) restauradas`)
}

console.log(
  `\n${COMMIT ? 'Gravado' : 'Simulado'}: ${enviadas} linha(s)` +
    (bloqueadas > 0 ? ` · ${bloqueadas} tabela(s) bloqueada(s) por já ter dados` : ''),
)
console.log(
  '\nUsuários do Auth não são restaurados por aqui: a API não expõe hashes de senha.' +
    '\nConvide cada um pelo painel do Supabase e peça para definir a senha.',
)
if (!COMMIT) console.log('\nNada foi gravado.')
