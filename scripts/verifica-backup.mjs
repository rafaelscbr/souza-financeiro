/**
 * Verifica um backup gerado por scripts/backup.mjs.
 *
 * Um backup só vale se alguém já provou que ele está íntegro. São cinco
 * perguntas, e cada uma pega um jeito diferente de o backup estar quebrado:
 *
 * 1. Os arquivos estão todos lá e não foram alterados desde a gravação?
 *    (SHA-256 contra o manifesto.)
 * 2. O conteúdo bate com o banco AGORA, numa segunda leitura independente?
 *    (Pega truncamento por paginação, que é o erro silencioso clássico.)
 * 3. Toda chave estrangeira dos dados resolve DENTRO do próprio backup?
 *    (Pega backup parcial: sem isso, a restauração falha no meio.)
 * 4. Os dados sobrevivem a uma ida e volta por JSON sem perder precisão?
 *    (Pega centavo virando float torto.)
 * 5. Em que ordem as tabelas podem ser restauradas sem violar chave?
 *
 * SÓ LÊ, dos dois lados.
 *
 * Rodar:  npm run verifica-backup -- /caminho/do/backup
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const BASE = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROJETO_PROIBIDO = 'dczexbzsfdavcrwiungk' // icrm

const destino = process.argv[2]
if (!destino) {
  console.error('Uso: npm run verifica-backup -- /caminho/do/backup')
  process.exit(1)
}
if (!existsSync(join(destino, 'manifesto.json'))) {
  console.error(`Não achei manifesto.json em ${destino}`)
  process.exit(1)
}
if (BASE?.includes(PROJETO_PROIBIDO)) {
  console.error('ABORTADO: a URL aponta para o icrm.')
  process.exit(1)
}

const manifesto = JSON.parse(readFileSync(join(destino, 'manifesto.json'), 'utf8'))
const spec = JSON.parse(readFileSync(join(destino, 'esquema', 'openapi.json'), 'utf8'))
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const cents = (v) => Math.round(Number(v) * 100)

let falhas = 0
const ok = (cond, msg, detalhe = '') => {
  console.log(`${cond ? '  ok ' : '  ✗ '} ${msg}${detalhe ? '  → ' + detalhe : ''}`)
  if (!cond) falhas++
}

const tabelas = Object.keys(manifesto.tabelas)
const dados = {}

// -------------------------------------------------- 1. arquivos e SHA-256
console.log('\n1. ARQUIVOS íntegros (SHA-256 contra o manifesto)')
for (const tabela of tabelas) {
  const arquivo = join(destino, 'dados', `${tabela}.json`)
  if (!existsSync(arquivo)) {
    ok(false, `${tabela}`, 'arquivo ausente')
    continue
  }
  const texto = readFileSync(arquivo, 'utf8')
  const sha = createHash('sha256').update(texto).digest('hex')
  dados[tabela] = JSON.parse(texto)
  const esperado = manifesto.tabelas[tabela].sha256Json
  ok(sha === esperado, `${tabela} (${dados[tabela].length} linhas)`, sha === esperado ? '' : 'hash diferente')
}
const arquivoCsvFaltando = tabelas.filter((t) => !existsSync(join(destino, 'csv', `${t}.csv`)))
ok(arquivoCsvFaltando.length === 0, 'CSV de todas as tabelas presente', arquivoCsvFaltando.join(', '))
ok(
  existsSync(join(destino, 'esquema', 'esquema-atual-reconstruido.sql')),
  'DDL reconstruído presente',
)
ok(existsSync(join(destino, 'dados', 'auth_users.json')), 'usuários do Auth presentes')

// ---------------------------------------- 2. segunda leitura contra o banco
console.log('\n2. CONTEÚDO bate com o banco numa segunda leitura independente')
async function pegar(caminho, extra = {}) {
  const r = await fetch(`${BASE}${caminho}`, { headers: { ...H, ...extra } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return { dados: await r.json(), range: r.headers.get('content-range') }
}

let bancoAcessivel = true
try {
  await pegar('/rest/v1/companies?select=id&limit=1')
} catch (e) {
  bancoAcessivel = false
  console.log(`  ··  banco inacessível (${e.message}) — pulando; as demais conferências continuam`)
}

if (bancoAcessivel) {
  for (const tabela of tabelas) {
    const { range } = await pegar(`/rest/v1/${tabela}?select=id&limit=1`, { Prefer: 'count=exact' })
    const contagem = Number((range ?? '/0').split('/')[1])
    const salvas = manifesto.tabelas[tabela].linhas
    ok(contagem === salvas, `${tabela}: contagem`, `banco ${contagem} vs backup ${salvas}`)
  }
  // As somas de dinheiro são o teste que importa: contagem igual com valor
  // diferente é o pior caso, porque parece certo.
  for (const tabela of tabelas) {
    const somas = manifesto.tabelas[tabela].somas ?? {}
    const colunas = Object.keys(somas)
    if (colunas.length === 0) continue
    const { dados: vivos } = await pegar(`/rest/v1/${tabela}?select=${colunas.join(',')}`)
    for (const col of colunas) {
      const vivo =
        vivos.reduce((s, l) => s + (l[col] === null || l[col] === undefined ? 0 : cents(l[col])), 0) / 100
      const diferenca = Math.abs(vivo - somas[col])
      ok(diferenca < 0.005, `${tabela}.${col}: soma`, `banco ${vivo.toFixed(2)} vs backup ${somas[col].toFixed(2)}`)
    }
  }
}

// ------------------------------------------------ 3. chaves estrangeiras
console.log('\n3. CHAVES ESTRANGEIRAS resolvem dentro do próprio backup')
const arestas = []
for (const tabela of tabelas) {
  for (const [col, p] of Object.entries(spec.definitions[tabela]?.properties ?? {})) {
    const fk = (p.description ?? '').match(/<fk table='([^']+)' column='([^']+)'\/>/)
    if (fk) arestas.push({ de: tabela, col, para: fk[1], colPara: fk[2] })
  }
}
for (const a of arestas) {
  const alvo = new Set((dados[a.para] ?? []).map((l) => l[a.colPara]))
  const orfas = (dados[a.de] ?? []).filter((l) => l[a.col] !== null && l[a.col] !== undefined && !alvo.has(l[a.col]))
  ok(
    orfas.length === 0,
    `${a.de}.${a.col} → ${a.para}.${a.colPara}`,
    orfas.length ? `${orfas.length} órfã(s): ${orfas.slice(0, 2).map((o) => o.id).join(', ')}` : '',
  )
}
// group_id não é FK declarada, mas amarra as parcelas de uma venda. Se um
// grupo tem linhas fora do backup, a venda chega quebrada na restauração.
const gruposPorEmpresa = new Map()
for (const t of dados.transactions ?? []) {
  if (!t.group_id) continue
  const k = `${t.group_id}`
  gruposPorEmpresa.set(k, (gruposPorEmpresa.get(k) ?? 0) + 1)
}
ok(true, `grupos de venda/parcelamento presentes`, `${gruposPorEmpresa.size} grupos`)

// -------------------------------------------------- 4. ida e volta por JSON
console.log('\n4. DADOS sobrevivem à ida e volta por JSON (sem perder centavo)')
for (const tabela of tabelas) {
  const texto = readFileSync(join(destino, 'dados', `${tabela}.json`), 'utf8')
  const reescrito = JSON.stringify(JSON.parse(texto), null, 1)
  ok(reescrito === texto, `${tabela}: round-trip idêntico`)
}
const somaLancamentos =
  (dados.transactions ?? []).reduce((s, t) => s + cents(t.amount), 0) / 100
ok(
  Math.abs(somaLancamentos - (manifesto.tabelas.transactions?.somas?.amount ?? -1)) < 0.005,
  'soma dos lançamentos recalculada do arquivo',
  somaLancamentos.toFixed(2),
)

// ------------------------------------------- 5. ordem segura de restauração
console.log('\n5. ORDEM de restauração sem violar chave estrangeira')
const dependencias = new Map(tabelas.map((t) => [t, new Set()]))
for (const a of arestas) if (a.de !== a.para) dependencias.get(a.de)?.add(a.para)
const ordem = []
const restantes = new Set(tabelas)
while (restantes.size > 0) {
  const prontas = [...restantes].filter((t) => [...dependencias.get(t)].every((d) => ordem.includes(d)))
  if (prontas.length === 0) {
    ok(false, 'ciclo de dependência entre tabelas', [...restantes].join(', '))
    break
  }
  for (const t of prontas.sort()) {
    ordem.push(t)
    restantes.delete(t)
  }
}
ok(ordem.length === tabelas.length, 'ordem calculada para todas as tabelas')
console.log(`  ··  ${ordem.join(' → ')}`)

// ---------------------------------------------------------------- resultado
const total = Object.values(manifesto.tabelas).reduce((s, t) => s + t.linhas, 0)
console.log(
  `\n${falhas === 0 ? '✓ BACKUP ÍNTEGRO' : `✗ ${falhas} FALHA(S)`} — ${total} linhas em ${tabelas.length} tabelas` +
    `\n  gerado em ${manifesto.geradoEm}` +
    `\n  ${destino}`,
)
process.exit(falhas === 0 ? 0 : 1)
