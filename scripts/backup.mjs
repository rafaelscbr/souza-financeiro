/**
 * Backup completo do souza-financeiro — etapa E0 do plano de reestruturação.
 *
 * O que este script garante e por quê:
 *
 * · SÓ LÊ. Nenhum método diferente de GET é usado. Não existe caminho de
 *   escrita aqui, de propósito: o backup é a última linha de defesa e não
 *   pode ser o script que estraga algo.
 * · Descobre as tabelas pelo OpenAPI do PostgREST, em vez de usar uma lista
 *   fixa. Lista fixa envelhece calada: uma tabela nova ficaria fora do backup
 *   sem ninguém notar.
 * · Pagina sempre (1000 por página, ordenado por id). O limite do Supabase é
 *   1000 linhas por resposta; sem paginar, uma tabela que cresça passa a ser
 *   truncada silenciosamente.
 * · Grava JSON (fiel, para restaurar) e CSV (legível, para conferir no Excel
 *   ou reconstruir à mão se tudo mais falhar).
 * · Escreve um manifesto com contagem, soma dos valores e SHA-256 de cada
 *   arquivo. Sem manifesto, "tenho um backup" é uma crença, não um fato.
 * · Soma dinheiro em centavos inteiros, nunca acumulando float.
 *
 * Rodar:  npm run backup                 (destino padrão em ~/Documents)
 *         npm run backup -- /caminho     (destino explícito)
 */
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Guarda de projeto. O icrm é o CRM de produção e NUNCA deve ser alvo de
// nenhum script deste repositório, nem para leitura — se a URL apontar para
// ele, alguém trocou o .env e o resto do script não deve rodar.
const PROJETO_ALVO = 'iejmrzcgoeoxhhcnqodn' // souza-financeiro
const PROJETO_PROIBIDO = 'dczexbzsfdavcrwiungk' // icrm

if (!BASE || !KEY) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.')
  process.exit(1)
}
if (BASE.includes(PROJETO_PROIBIDO)) {
  console.error('ABORTADO: a URL aponta para o projeto icrm. Este script nunca toca no icrm.')
  process.exit(1)
}
if (!BASE.includes(PROJETO_ALVO)) {
  console.error(`ABORTADO: a URL não é do souza-financeiro (esperado ${PROJETO_ALVO}).`)
  process.exit(1)
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const PAGINA = 1000

/** GET com retentativa: rede doméstica cai, e um backup não pode falhar por isso. */
async function pegar(caminho, extra = {}) {
  let ultimoErro
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const r = await fetch(`${BASE}${caminho}`, { headers: { ...H, ...extra } })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
      const texto = await r.text()
      return { texto, dados: texto ? JSON.parse(texto) : null, range: r.headers.get('content-range') }
    } catch (e) {
      ultimoErro = e
      if (tentativa < 4) await new Promise((ok) => setTimeout(ok, 800 * tentativa))
    }
  }
  throw new Error(`${caminho} falhou depois de 4 tentativas: ${ultimoErro.message}`)
}

const agora = new Date()
const ts =
  `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}` +
  `-${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}`
const destino =
  process.argv[2] && !process.argv[2].startsWith('-')
    ? process.argv[2]
    : join(homedir(), 'Documents', `souza-financeiro-backup-${ts}`)

for (const sub of ['dados', 'csv', 'esquema', 'esquema/migracoes']) {
  mkdirSync(join(destino, sub), { recursive: true })
}
console.log(`Backup do souza-financeiro em ${destino}\n`)

// ---------------------------------------------------------------- esquema
const spec = (await pegar('/rest/v1/')).dados
writeFileSync(join(destino, 'esquema', 'openapi.json'), JSON.stringify(spec, null, 1))
const definicoes = spec.definitions ?? {}
const tabelas = Object.keys(definicoes).sort()
const rpcs = Object.keys(spec.paths ?? {}).filter((p) => p.startsWith('/rpc/'))
console.log(`${tabelas.length} tabelas descobertas · ${rpcs.length} funções RPC expostas`)

const sha = (texto) => createHash('sha256').update(texto).digest('hex')
const cents = (v) => Math.round(Number(v) * 100)

function paraCsv(linhas, colunas) {
  const escapa = (v) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [colunas.join(','), ...linhas.map((l) => colunas.map((c) => escapa(l[c])).join(','))].join('\n') + '\n'
}

// ------------------------------------------------------------- tabelas
const manifesto = {
  projeto: PROJETO_ALVO,
  url: BASE,
  geradoEm: agora.toISOString(),
  geradoPor: 'scripts/backup.mjs',
  observacao:
    'Backup de DADOS via API REST (service_role). O dump nativo do Postgres (pg_dump) exige a senha do banco e um cliente postgres; ver LEIA-ME.md.',
  tabelas: {},
  autenticacao: {},
  armazenamento: {},
  rpcsExpostas: rpcs,
}

let totalLinhas = 0
for (const tabela of tabelas) {
  const colunas = Object.keys(definicoes[tabela].properties ?? {})
  const temId = colunas.includes('id')

  // Contagem exata primeiro: é o número contra o qual a paginação é conferida.
  const cabeca = await pegar(`/rest/v1/${tabela}?select=id&limit=1`, { Prefer: 'count=exact' })
  const contagemExata = Number((cabeca.range ?? '/0').split('/')[1])

  const linhas = []
  for (let deslocamento = 0; ; deslocamento += PAGINA) {
    const ordem = temId ? '&order=id' : ''
    const { dados } = await pegar(`/rest/v1/${tabela}?select=*${ordem}&limit=${PAGINA}&offset=${deslocamento}`)
    linhas.push(...dados)
    if (dados.length < PAGINA) break
  }

  if (linhas.length !== contagemExata) {
    console.error(`  ✗ ${tabela}: baixei ${linhas.length} linhas, o banco diz ${contagemExata}. ABORTADO.`)
    process.exit(1)
  }

  const json = JSON.stringify(linhas, null, 1)
  writeFileSync(join(destino, 'dados', `${tabela}.json`), json)
  writeFileSync(join(destino, 'csv', `${tabela}.csv`), paraCsv(linhas, colunas))

  // Estatísticas por coluna: é o que permite provar depois que nada mudou.
  const somas = {}
  const datas = {}
  const nulos = {}
  for (const col of colunas) {
    const f = definicoes[tabela].properties[col].format ?? ''
    const valores = linhas.map((l) => l[col])
    nulos[col] = valores.filter((v) => v === null || v === undefined).length
    if (/numeric|integer|smallint|bigint|double|real/.test(f)) {
      const presentes = valores.filter((v) => v !== null && v !== undefined)
      if (presentes.length > 0) {
        somas[col] = /numeric|double|real/.test(f)
          ? presentes.reduce((s, v) => s + cents(v), 0) / 100
          : presentes.reduce((s, v) => s + Number(v), 0)
      }
    }
    if (/date|timestamp/.test(f)) {
      const presentes = valores.filter((v) => v !== null && v !== undefined).sort()
      if (presentes.length > 0) datas[col] = { min: presentes[0], max: presentes[presentes.length - 1] }
    }
  }

  manifesto.tabelas[tabela] = {
    linhas: linhas.length,
    contagemExataDoBanco: contagemExata,
    colunas,
    sha256Json: sha(json),
    somas,
    intervalosDeData: datas,
    nulosPorColuna: nulos,
  }
  totalLinhas += linhas.length
  console.log(`  ok  ${tabela.padEnd(23)} ${String(linhas.length).padStart(5)} linhas`)
}

// --------------------------------------------------------- autenticação
// Usuários do Auth não saem no dump do schema public e são o que permite
// entrar no sistema. Sem eles, o backup restaura dados que ninguém acessa.
try {
  const usuarios = []
  for (let pagina = 1; ; pagina++) {
    const { dados } = await pegar(`/auth/v1/admin/users?page=${pagina}&per_page=200`)
    const lote = dados.users ?? []
    usuarios.push(...lote)
    if (lote.length < 200) break
  }
  const json = JSON.stringify(usuarios, null, 1)
  writeFileSync(join(destino, 'dados', 'auth_users.json'), json)
  manifesto.autenticacao = {
    usuarios: usuarios.length,
    sha256Json: sha(json),
    emails: usuarios.map((u) => u.email),
    aviso:
      'Os hashes de senha NÃO são expostos pela API de admin. Restaurar um usuário exige convite/redefinição de senha.',
  }
  console.log(`  ok  auth.users             ${String(usuarios.length).padStart(5)} usuários`)
} catch (e) {
  manifesto.autenticacao = { erro: e.message }
  console.log(`  ✗  auth.users: ${e.message}`)
}

// ---------------------------------------------------------- armazenamento
try {
  const { dados: buckets } = await pegar('/storage/v1/bucket')
  manifesto.armazenamento = { buckets: (buckets ?? []).map((b) => b.name) }
  console.log(`  ok  storage               ${String((buckets ?? []).length).padStart(5)} buckets`)
} catch (e) {
  manifesto.armazenamento = { erro: e.message }
}

// ------------------------------------------------- reconstrução do schema
// O pg_dump não está disponível nesta máquina e exige a senha do banco. O que
// o OpenAPI entrega dá para recriar as tabelas: colunas, tipos, defaults,
// obrigatoriedade, chaves e comentários. O que ele NÃO entrega está listado no
// cabeçalho do arquivo gerado — e está, em boa parte, nas migrações copiadas.
const TIPO = {
  uuid: 'uuid',
  text: 'text',
  numeric: 'numeric',
  date: 'date',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  boolean: 'boolean',
  integer: 'integer',
  smallint: 'smallint',
  bigint: 'bigint',
  'character varying': 'text',
  json: 'json',
  jsonb: 'jsonb',
}

const partes = [
  `-- =============================================================================`,
  `-- souza-financeiro — schema RECONSTRUÍDO a partir do OpenAPI do PostgREST`,
  `-- Gerado em ${agora.toISOString()} por scripts/backup.mjs`,
  `--`,
  `-- ISTO NÃO É UM pg_dump. Reflete o estado das tabelas hoje (já com as`,
  `-- colunas adicionadas pelas migrações 001 a 006).`,
  `--`,
  `-- O QUE ESTE ARQUIVO CONTÉM: tabelas, colunas, tipos, defaults, NOT NULL,`,
  `-- chaves primárias, chaves estrangeiras e comentários de coluna.`,
  `--`,
  `-- O QUE NÃO É RECUPERÁVEL PELA API e precisa vir das migrações em`,
  `-- esquema/migracoes/ (ou de um pg_dump de verdade):`,
  `--   · CHECK constraints (ex.: accounts.type in ('checking', …))`,
  `--   · precisão dos numeric (o banco usa numeric(14,2); aqui sai numeric puro)`,
  `--   · índices, políticas RLS, triggers e funções`,
  `--   · hashes de senha dos usuários do Auth`,
  `--`,
  `-- PARA RESTAURAR DO ZERO: rode este arquivo, depois as migrações 001 a 006`,
  `-- (são idempotentes e trazem constraints, índices e políticas), depois carregue`,
  `-- os dados de dados/*.json com scripts/restaura-backup.mjs.`,
  `-- =============================================================================`,
  ``,
  `create extension if not exists pgcrypto;`,
  ``,
]

// As tabelas saem SEM as chaves estrangeiras embutidas, e as chaves vêm
// depois, em `alter table`. Emitir a FK dentro do `create table` obriga a
// respeitar a ordem de dependência entre as tabelas — e em ordem alfabética
// `accounts` referencia `companies` antes de ela existir, o que fazia o
// arquivo inteiro falhar na primeira instrução.
const chaves = []

for (const tabela of tabelas) {
  const props = definicoes[tabela].properties ?? {}
  const obrigatorias = new Set(definicoes[tabela].required ?? [])
  const linhasCol = []
  let pk = null

  for (const [col, p] of Object.entries(props)) {
    const tipo = TIPO[p.format] ?? p.format ?? 'text'
    let linha = `  ${col} ${tipo}`
    if (p.default !== undefined) {
      const d = p.default
      const literal =
        typeof d === 'string'
          ? /^(gen_random_uuid\(\)|now\(\)|current_date|CURRENT_DATE|current_timestamp)$/.test(d)
            ? d
            : `'${String(d).replace(/'/g, "''")}'`
          : String(d)
      linha += ` default ${literal}`
    }
    if (obrigatorias.has(col)) linha += ' not null'
    linhasCol.push(linha)

    const desc = p.description ?? ''
    if (/<pk\/>/.test(desc)) pk = col
    const fk = desc.match(/<fk table='([^']+)' column='([^']+)'\/>/)
    if (fk) chaves.push({ de: tabela, col, para: fk[1], coluna: fk[2] })
  }

  if (pk) linhasCol.push(`  primary key (${pk})`)

  partes.push(`-- ${tabela}`)
  partes.push(`create table if not exists public.${tabela} (`)
  partes.push(linhasCol.join(',\n'))
  partes.push(`);`)
  partes.push(`alter table public.${tabela} enable row level security;`)
  for (const [col, p] of Object.entries(props)) {
    const limpo = (p.description ?? '').replace(/\n*Note:[\s\S]*$/, '').trim()
    if (limpo) partes.push(`comment on column public.${tabela}.${col} is '${limpo.replace(/'/g, "''")}';`)
  }
  partes.push(``)
}

partes.push(`-- Chaves estrangeiras (depois de todas as tabelas existirem).`)
for (const fk of chaves) {
  const nome = `${fk.de}_${fk.col}_fkey`
  partes.push(
    `do $$ begin\n` +
      `  if not exists (select 1 from pg_constraint where conname = '${nome}') then\n` +
      `    alter table public.${fk.de} add constraint ${nome}\n` +
      `      foreign key (${fk.col}) references public.${fk.para}(${fk.coluna});\n` +
      `  end if;\nend $$;`,
  )
}
partes.push(``)

writeFileSync(join(destino, 'esquema', 'esquema-atual-reconstruido.sql'), partes.join('\n'))

const dirMigracoes = join(process.cwd(), 'supabase', 'migrations')
let copiadas = 0
if (existsSync(dirMigracoes)) {
  for (const arq of readdirSync(dirMigracoes).filter((f) => f.endsWith('.sql'))) {
    copyFileSync(join(dirMigracoes, arq), join(destino, 'esquema', 'migracoes', arq))
    copiadas++
  }
}
console.log(`  ok  esquema reconstruído · ${copiadas} migrações copiadas`)

// ------------------------------------------------------------- resumo
// Os números de referência da imobiliária. É contra esta lista que a migração
// de vendas vai ser conferida mais tarde, então ela nasce junto com o backup.
const tx = JSON.parse(
  await (await fetch(`${BASE}/rest/v1/transactions?select=*`, { headers: H })).text(),
)
const empresas = JSON.parse(
  await (await fetch(`${BASE}/rest/v1/companies?select=id,name,slug`, { headers: H })).text(),
)
const nomeEmpresa = Object.fromEntries(empresas.map((c) => [c.id, c.name]))
const soma = (lista) => lista.reduce((s, t) => s + cents(t.amount), 0) / 100

const porEmpresa = {}
for (const t of tx) {
  const chave = `${nomeEmpresa[t.company_id] ?? t.company_id} · ${t.kind} · ${t.status}`
  porEmpresa[chave] = porEmpresa[chave] ?? []
  porEmpresa[chave].push(t)
}

const resumo = [
  `# Backup souza-financeiro — ${agora.toLocaleString('pt-BR')}`,
  ``,
  `${totalLinhas} linhas em ${tabelas.length} tabelas.`,
  ``,
  `## Linhas por tabela`,
  ``,
  `| tabela | linhas |`,
  `| --- | ---: |`,
  ...tabelas.map((t) => `| ${t} | ${manifesto.tabelas[t].linhas} |`),
  ``,
  `## Lançamentos por empresa, tipo e situação`,
  ``,
  `| empresa · tipo · situação | linhas | total |`,
  `| --- | ---: | ---: |`,
  ...Object.entries(porEmpresa)
    .sort()
    .map(([k, v]) => `| ${k} | ${v.length} | ${soma(v).toFixed(2)} |`),
  ``,
  `## Vendas da imobiliária (grupos com receita) — base de conferência da migração`,
  ``,
  `| venda | parcelas | comissão | impostos | corretores | recebido | a receber |`,
  `| --- | ---: | ---: | ---: | ---: | ---: | ---: |`,
]

const grupos = new Map()
for (const t of tx) {
  if (!t.group_id) continue
  if (!grupos.has(t.group_id)) grupos.set(t.group_id, [])
  grupos.get(t.group_id).push(t)
}
for (const [, linhas] of grupos) {
  const receitas = linhas.filter((t) => t.kind === 'income' && t.category === 'Comissões de Venda')
  if (receitas.length === 0) continue
  const titulo = (receitas[0].description ?? '')
    .replace(/\s*[—–-]\s*Pc\.?\s*\d+\s*\/\s*\d+.*$/i, '')
    .replace(/\s*—\s*\d\/\d.*$/, '')
    .trim()
  resumo.push(
    `| ${titulo} | ${receitas.length} | ${soma(receitas).toFixed(2)} | ` +
      `${soma(linhas.filter((t) => t.category === 'Impostos e Taxas')).toFixed(2)} | ` +
      `${soma(linhas.filter((t) => t.category === 'Comissões de Corretores')).toFixed(2)} | ` +
      `${soma(receitas.filter((t) => t.status === 'settled')).toFixed(2)} | ` +
      `${soma(receitas.filter((t) => t.status === 'pending')).toFixed(2)} |`,
  )
}

resumo.push(
  ``,
  `## Usuários de login`,
  ``,
  ...(manifesto.autenticacao.emails ?? ['(não foi possível ler)']).map((e) => `- ${e}`),
  ``,
)
writeFileSync(join(destino, 'resumo.md'), resumo.join('\n'))

const manifestoJson = JSON.stringify(manifesto, null, 1)
writeFileSync(join(destino, 'manifesto.json'), manifestoJson)

writeFileSync(
  join(destino, 'LEIA-ME.md'),
  `# Backup do souza-financeiro

Gerado em ${agora.toLocaleString('pt-BR')} por \`scripts/backup.mjs\` (somente leitura).
Projeto: \`${PROJETO_ALVO}\` (souza-financeiro). **Nunca** o icrm.

## O que tem aqui

| pasta | conteúdo |
| --- | --- |
| \`dados/\` | uma cópia JSON fiel de cada tabela, mais \`auth_users.json\` |
| \`csv/\` | a mesma coisa em CSV, para abrir no Excel ou conferir a olho |
| \`esquema/esquema-atual-reconstruido.sql\` | DDL das tabelas reconstruído da API |
| \`esquema/migracoes/\` | as migrações 001 a 006 do repositório (constraints, índices, RLS) |
| \`esquema/openapi.json\` | a resposta crua da API, evidência do schema no momento do backup |
| \`manifesto.json\` | contagem, somas, SHA-256 e nulos por coluna de cada tabela |
| \`resumo.md\` | os números de referência, inclusive as vendas da imobiliária |

## Como conferir que este backup está íntegro

\`\`\`bash
npm run verifica-backup -- "${destino}"
\`\`\`

Compara arquivo por arquivo contra o banco ao vivo (contagem, somas, SHA-256),
confere que toda chave estrangeira dos dados resolve dentro do próprio backup e
calcula a ordem de restauração segura.

## Como provar que ele restaura

\`\`\`bash
npm run teste-restauracao -- "${destino}"
\`\`\`

Sobe um Postgres de verdade na própria máquina (PGlite, em WASM, sem Docker e
sem rede), aplica o DDL reconstruído e as migrações, carrega todos os dados e
confere contagens, somas e as perguntas do negócio contra o manifesto. É o
teste que transforma "tenho um backup" em fato.

## Como restaurar

1. Num projeto Supabase **vazio**, rode no SQL Editor:
   \`esquema/esquema-atual-reconstruido.sql\`, depois \`esquema/migracoes/001\` a \`006\`
   (são idempotentes e trazem CHECK constraints, índices e políticas RLS).
2. Carregue os dados:
   \`\`\`bash
   node --env-file=.env scripts/restaura-backup.mjs "${destino}"          # simulação
   node --env-file=.env scripts/restaura-backup.mjs "${destino}" --commit # grava
   \`\`\`
3. Rode \`npm run verifica-backup\` apontando para o destino restaurado.

## O que este backup NÃO cobre

- **Dump nativo do Postgres.** \`pg_dump\` precisa da senha do banco (Supabase →
  Settings → Database) e de um cliente postgres, que não existe nesta máquina.
  Com os dois, o comando é:
  \`\`\`bash
  supabase db dump --db-url "postgresql://postgres:SENHA@db.${PROJETO_ALVO}.supabase.co:5432/postgres" -f schema.sql
  supabase db dump --db-url "..." --data-only -f dados.sql
  \`\`\`
  Isso traz CHECK constraints, precisão dos numeric, índices, triggers e RLS
  exatamente como estão. Enquanto não for feito, a recuperação depende da
  reconstrução acima mais as migrações.
- **Senhas dos usuários.** A API de admin não expõe os hashes. Restaurar um
  usuário significa convidá-lo de novo e ele definir a senha.
- **Configuração do projeto**: SMTP, modelos de e-mail, variáveis da Vercel.
`,
)

console.log(`\n${totalLinhas} linhas salvas · manifesto com SHA-256 de cada arquivo`)
console.log(`Destino: ${destino}`)
console.log(`\nConfira com:  npm run verifica-backup -- "${destino}"`)
