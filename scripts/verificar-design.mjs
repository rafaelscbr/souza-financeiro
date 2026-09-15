#!/usr/bin/env node
// A trava do design (docs/souza-os-fundamentos.md, seção 10, Fase 1, e seção 3.6).
//
// Varre src/**/*.{ts,tsx} e procura o que o documento proíbe.
//   - Violação de nível "erro" em arquivo fora de ISENTOS: falha (código de saída 1).
//   - Violação em arquivo de ISENTOS: só avisa (e é contada).
//   - Regras de nível "aviso": nunca falham.
//
// Uso:
//   node scripts/verificar-design.mjs                    varre tudo, respeita ISENTOS
//   node scripts/verificar-design.mjs --arquivo=CAMINHO  checa um arquivo só, ignorando ISENTOS
//   node scripts/verificar-design.mjs --sem-isentos      varre tudo como se ISENTOS estivesse vazio
//   node scripts/verificar-design.mjs --limpeza          liga as regras da limpeza final
//                                                        (text-xs…text-4xl) e ignora ISENTOS
//   node scripts/verificar-design.mjs --resumo           só as contagens, sem listar cada ocorrência

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)))

// ─────────────────────────────────────────────────────────────────────────────
// ISENTOS: telas e componentes ainda não migrados.
// só diminui. Um arquivo sai daqui quando migra inteiro (seção 10, Fase 6) e
// nunca volta. Nenhum arquivo novo entra. Um caminho por linha, em ordem.
// ─────────────────────────────────────────────────────────────────────────────
const ISENTOS = [
  'src/admin/BaixarLancamento.tsx',
  'src/admin/FolhaDeLancamento.tsx',
  'src/admin/LancarDespesa.tsx',
  'src/admin/PagarComissao.tsx',
  'src/admin/ReceberParcela.tsx',
  'src/admin/RegistrarVenda.tsx',
  'src/admin/pages/Config.tsx',
  'src/admin/pages/Corretores.tsx',
  'src/admin/pages/Despesas.tsx',
  'src/admin/pages/Inicio.tsx',
  'src/admin/pages/Pagar.tsx',
  'src/admin/pages/Receber.tsx',
  'src/admin/pages/Relatorios.tsx',
  'src/admin/pages/Venda.tsx',
  'src/admin/pages/Vendas.tsx',
  'src/auth/LoginPage.tsx',
  'src/auth/TrocarSenha.tsx',
  'src/components/ui/Painel.tsx',
  'src/components/ui/Secao.tsx',
  'src/corretor/pages/Inicio.tsx',
  'src/corretor/pages/MinhasVendas.tsx',
  'src/corretor/pages/Recebimentos.tsx',
  'src/lib/situacao.ts',
]

// ─── Escopos ─────────────────────────────────────────────────────────────────

const FORMULARIOS = new Set([
  'src/admin/BaixarLancamento.tsx',
  'src/admin/FolhaDeLancamento.tsx',
  'src/admin/LancarDespesa.tsx',
  'src/admin/PagarComissao.tsx',
  'src/admin/ReceberParcela.tsx',
  'src/admin/RegistrarVenda.tsx',
])

const emComponenteDeBase = (p) =>
  p.startsWith('src/components/ui/') || p.startsWith('src/components/layout/')

const ehTelaOuFormulario = (p) =>
  p.startsWith('src/admin/pages/') || p.startsWith('src/corretor/pages/') || FORMULARIOS.has(p)

const ehTela = (p) => ehTelaOuFormulario(p) || p.startsWith('src/auth/')

const ehLogin = (p) => p === 'src/auth/LoginPage.tsx'
const ehMarca = (p) => p.startsWith('src/components/marca/')

// ─── Regras ──────────────────────────────────────────────────────────────────
// Cada regra: id, nivel ('erro' | 'aviso'), secao do documento, o que é, re
// (sempre com /g), aplica(caminho) opcional, ignora(linha, match) opcional.
// Borda de classe: início de linha, espaço, aspas, crase, ":" de variante
// (lg:-mx-4) e "!" de important.

const B = `(?:^|[\\s"'\`:!])`

const REGRAS = [
  {
    id: 'margem-negativa',
    nivel: 'erro',
    secao: '3.6, P1',
    oque: 'margem negativa (a sangria deixou de existir)',
    re: new RegExp(`${B}-(?:m|mx|my|mt|mb|ml|mr|ms|me|inset-x)-`, 'g'),
  },
  {
    id: 'margem-fora-de-componente',
    nivel: 'erro',
    secao: '3.6, P2',
    oque: 'margem fora de src/components/ui e src/components/layout (use gap do pai)',
    re: new RegExp(`${B}(?:m|mx|my|mt|mb|ml|mr|ms|me)-(?:\\d|px\\b|auto\\b|\\[)`, 'g'),
    aplica: (p) => !emComponenteDeBase(p),
  },
  {
    id: 'meio-degrau',
    nivel: 'erro',
    secao: '3.1, P3',
    oque: 'degrau de espaço fora da escala (0.5, 1.5, 2.5, 3.5, 7, 9, 11, 14)',
    re: /\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-(?:0\.5|1\.5|2\.5|3\.5|7|9|11|14)\b/g,
  },
  {
    id: 'espaco-arbitrario',
    nivel: 'erro',
    secao: '3.6, P3',
    oque: 'padding, margem ou gap arbitrário ([…]); vira token',
    re: /\b(?:(?:p|m)[xytrblse]?|gap(?:-[xy])?)-\[/g,
  },
  {
    id: 'space-xy',
    nivel: 'erro',
    secao: '3.6',
    oque: 'space-x-*/space-y-* (use flex flex-col gap-*)',
    re: /\bspace-[xy]-/g,
  },
  {
    id: 'espaco-solto',
    nivel: 'erro',
    secao: '3.6, 4.2',
    oque: 'número solto de espaço (scroll-mt-40, bottom-24, -top-1, inset-[5px]): vira token',
    // 0, px, full e frações (top-1/2) continuam permitidos.
    re: /(?<![\w-])-?(?:scroll-(?:m|p)[xytrblse]?|top|bottom|left|right|inset(?:-[xy])?)-(?:(?:[1-9]\d*|0)(?:\.5)?(?![\d/.])(?<!-0)|\[)/g,
  },
  {
    id: 'texto-arbitrario',
    nivel: 'erro',
    secao: '6.1, P3',
    oque: 'tamanho de texto arbitrário (text-[Npx]); use a escala 6.1',
    re: /\btext-\[\d/g,
  },
  {
    id: 'texto-tamanho-padrao',
    nivel: 'erro',
    secao: '6.1 (limpeza)',
    oque: 'tamanho padrão do Tailwind (text-xs…text-4xl); use a escala 6.1',
    re: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g,
    limpeza: true,
  },
  {
    id: 'raio-arbitrario',
    nivel: 'erro',
    secao: '5.3',
    oque: 'raio arbitrário (rounded-[…])',
    re: /\brounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?-\[/g,
  },
  {
    id: 'raio-fora-dos-tokens',
    nivel: 'erro',
    secao: '5.3',
    oque: 'raio fora dos cinco tokens (badge, controle, caixa, sobreposicao, full)',
    re: /\brounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?-(?:3xl|2xl|xl|lg|md|sm)\b/g,
  },
  {
    id: 'hex',
    nivel: 'erro',
    secao: '5.1, guia §3',
    oque: 'cor hex no código (use token)',
    re: /(?<![&\w])#[0-9a-fA-F]{3,8}\b/g,
    aplica: (p) => !ehLogin(p) && !ehMarca(p),
  },
  {
    id: 'degrade',
    nivel: 'erro',
    secao: 'Ajuste 2, 5.2',
    oque: 'degradê fora do painel de marca do login',
    re: /gradient/gi,
    aplica: (p) => !ehLogin(p),
  },
  {
    id: 'transicao-proibida',
    nivel: 'erro',
    secao: '8.4, P7',
    oque: 'transition-all, transition-[…] ou animate-[…]',
    re: /\b(?:transition-all|transition-\[|animate-\[)/g,
  },
  {
    id: 'transicao-de-cor-fora-de-controle',
    nivel: 'erro',
    secao: '8.4',
    oque: 'transition-colors fora de src/components/ui e src/components/layout',
    re: /\btransition-colors\b/g,
    aplica: (p) => !emComponenteDeBase(p),
  },
  {
    id: 'dinheiro-fora-de-valor',
    nivel: 'erro',
    secao: '6.3',
    oque: 'formatCurrency(...) desenhado como filho de JSX (use <Valor />)',
    // Só a chamada que é filho de JSX: {formatCurrency(x)}, {a ? formatCurrency(x) : …},
    // {ok && formatCurrency(x)}. Atributo (title={…}), template (`${…}`) e string de
    // aria-label, toast e ConfirmDialog continuam permitidos (6.3).
    re: /(?<![=$])\{(?:\s*|[^{}=`'"]*?(?:\?|:|&&|\|\|)\s*)formatCurrency\(/g,
    aplica: (p) => p.endsWith('.tsx') && !p.endsWith('/Valor.tsx'),
  },
  {
    id: 'confirm-nativo',
    nivel: 'erro',
    secao: '7.11',
    oque: 'window.confirm (use ConfirmDialog)',
    re: /\bwindow\.confirm\b|(?<![\w.$])confirm\(\s*[`'"]/g,
  },
  {
    id: 'selo-traco',
    nivel: 'erro',
    secao: '7.7, Ajuste 3',
    oque: 'glifo="traco" (glifo de enchimento)',
    re: /glifo=["'{`]*traco/g,
  },
  {
    id: 'superficie-context',
    nivel: 'erro',
    secao: '3.6',
    oque: 'SuperficieContext (espaço herdado por contexto implícito)',
    re: /\bSuperficieContext\b/g,
  },
  {
    id: 'li-tr-a-mao',
    nivel: 'erro',
    secao: '3.6, 7.1',
    oque: '<li>/<tr> escrito à mão em tela ou formulário (use Linha, Parcela ou Tabela)',
    re: /<(?:li|tr)\b/g,
    aplica: ehTelaOuFormulario,
  },
  {
    id: 'z-literal',
    nivel: 'erro',
    secao: '4.5',
    oque: 'z-index literal ou arbitrário (use z-cabecalho, z-nav, z-painel, z-modal…)',
    re: /\bz-(?:\d|\[)/g,
  },
  {
    id: 'classe-morta',
    nivel: 'erro',
    secao: '5.2, 8.2',
    oque: 'classe que deixou de existir',
    re: /gold-edge|gold-glow|grad-brand-glow|surface-premium|card-surface|list-surface|modal-surface|nav-bg-blur|aurora|barra-atencao|atencao-pulse|shimmer|stagger-children|animate-fade-in|animate-recibo|\bcifra\b|\bassinatura\b|texture-grain/g,
    // "cifra" e "assinatura" também são palavras do português (glossário,
    // placeholder): só contam em linha que monta classe.
    ignora: (linha, m) =>
      /^(?:cifra|assinatura)$/.test(m[0]) && !/className|class=|\bcn\(|\bclsx\(|twMerge\(/.test(linha),
  },
  {
    id: 'alias-deprecado',
    nivel: 'erro',
    secao: '5.1, 10 Fase 2',
    oque: 'alias de cor deprecado (use os tokens do guia e os derivados de 5.1)',
    re: /\b(?:bg|text|border)-(?:surface-[23]|content|rule|income|expense|critical|action|forecast|seal|papel)\b/g,
  },
  {
    id: 'filete',
    nivel: 'erro',
    secao: 'Ajuste 1',
    oque: 'filete lateral (border-l/r de 2, 4 ou arbitrário)',
    re: /\bborder-[lr]-(?:2|4|\[)/g,
  },
  {
    id: 'lucide-sem-icone',
    nivel: 'aviso',
    secao: '7.14',
    oque: "ícone de 'lucide-react' desenhado direto em tela, sem Icone/IconeTom (strokeWidth ausente)",
    especial: 'lucide',
    aplica: ehTela,
  },
  {
    id: 'text-t4-pequeno',
    nivel: 'aviso',
    secao: '5.1',
    oque: 'text-t4 em texto < 18px (use text-t-meta)',
    re: /\btext-t4\b/g,
    // Texto grande (≥18px) ou ícone pode usar t4.
    ignora: (linha) =>
      /\btext-(?:lg|[2-9]?xl|numero-|titulo-pagina)|<[A-Z]\w*\s[^>]*\btext-t4\b/.test(linha),
  },
  {
    id: 'overflow-hidden',
    nivel: 'aviso',
    secao: '3.6, 5.3',
    oque: 'overflow-hidden: proibido em contêiner com filho focável, exceto [data-rolagem] (conferir à mão)',
    re: /\boverflow(?:-[xy])?-hidden\b/g,
    ignora: (linha) => /data-rolagem/.test(linha),
  },
]

// ─── Argumentos ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const argArquivo = args.find((a) => a.startsWith('--arquivo='))?.slice('--arquivo='.length)
const LIMPEZA = args.includes('--limpeza')
const SEM_ISENTOS = args.includes('--sem-isentos') || LIMPEZA || Boolean(argArquivo)
const RESUMO = args.includes('--resumo')
const conhecidos = ['--limpeza', '--sem-isentos', '--resumo']
const desconhecido = args.find((a) => !a.startsWith('--arquivo=') && !conhecidos.includes(a))
if (desconhecido) {
  console.error(`verificar-design: opção desconhecida "${desconhecido}"`)
  process.exit(2)
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

const posix = (p) => p.split(sep).join('/')

function listar(dir) {
  const saida = []
  for (const nome of readdirSync(dir)) {
    const cheio = join(dir, nome)
    const st = statSync(cheio)
    if (st.isDirectory()) saida.push(...listar(cheio))
    else if (/\.(ts|tsx)$/.test(nome)) saida.push(cheio)
  }
  return saida
}

/**
 * Troca comentários (// e /* *\/) por espaços, preservando quebras de linha e
 * o conteúdo de strings e templates. Assim o texto de um comentário
 * ("sem -mr-2", "DEPRECADO") não conta como violação e os números de linha
 * continuam iguais aos do arquivo.
 */
function semComentarios(src) {
  let out = ''
  let i = 0
  const n = src.length
  const pilha = [] // 'tpl' = dentro de template; número = profundidade de { em ${}
  let estado = 'codigo' // codigo | aspas1 | aspas2 | tpl | linha | bloco
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (estado === 'linha') {
      if (c === '\n') { out += c; estado = 'codigo' } else out += ' '
      i++
      continue
    }
    if (estado === 'bloco') {
      if (c === '*' && d === '/') { out += '  '; i += 2; estado = 'codigo'; continue }
      out += c === '\n' ? '\n' : ' '
      i++
      continue
    }
    if (estado === 'aspas1' || estado === 'aspas2') {
      const fecha = estado === 'aspas1' ? "'" : '"'
      out += c
      if (c === '\\') { out += d ?? ''; i += 2; continue }
      if (c === fecha || c === '\n') estado = 'codigo'
      i++
      continue
    }
    if (estado === 'tpl') {
      out += c
      if (c === '\\') { out += d ?? ''; i += 2; continue }
      if (c === '`') { pilha.pop(); estado = 'codigo'; i++; continue }
      if (c === '$' && d === '{') { out += d; pilha.push(1); estado = 'codigo'; i += 2; continue }
      i++
      continue
    }
    // código
    if (c === '/' && d === '/') { out += '  '; i += 2; estado = 'linha'; continue }
    if (c === '/' && d === '*') { out += '  '; i += 2; estado = 'bloco'; continue }
    if (c === '/' && /[(,=:[!&|?{};]/.test(anteriorVisivel(out))) {
      // literal de regex (/"/g): copia até a barra de fechamento, sem abrir string
      let k = i + 1
      let classe = false
      for (; k < n && src[k] !== '\n'; k++) {
        if (src[k] === '\\') { k++; continue }
        if (src[k] === '[') classe = true
        else if (src[k] === ']') classe = false
        else if (src[k] === '/' && !classe) break
      }
      if (k < n && src[k] === '/') { out += src.slice(i, k + 1); i = k + 1; continue }
    }
    if (c === "'") { out += c; estado = 'aspas1'; i++; continue }
    if (c === '"') { out += c; estado = 'aspas2'; i++; continue }
    if (c === '`') { out += c; pilha.push('tpl'); estado = 'tpl'; i++; continue }
    const topo = pilha[pilha.length - 1]
    if (typeof topo === 'number') {
      if (c === '{') pilha[pilha.length - 1] = topo + 1
      if (c === '}') {
        if (topo === 1) { pilha.pop(); out += c; estado = 'tpl'; i++; continue }
        pilha[pilha.length - 1] = topo - 1
      }
    }
    out += c
    i++
  }
  return out
}

function anteriorVisivel(texto) {
  for (let k = texto.length - 1; k >= 0; k--) if (!/\s/.test(texto[k])) return texto[k]
  return ';'
}

function linhaDe(texto, indice) {
  let l = 1
  for (let k = 0; k < indice; k++) if (texto.charCodeAt(k) === 10) l++
  return l
}

/** Aviso 7.14: <Icone de lucide> usado direto na tela sem strokeWidth. */
function verificarLucide(limpo) {
  const achados = []
  const reImport = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g
  const nomes = []
  let m
  while ((m = reImport.exec(limpo))) {
    for (const parte of m[1].split(',')) {
      const t = parte.trim()
      if (!t || t.startsWith('type ')) continue
      const local = t.includes(' as ') ? t.split(' as ')[1].trim() : t
      if (/^[A-Z]\w*$/.test(local)) nomes.push(local)
    }
  }
  for (const nome of nomes) {
    const reUso = new RegExp(`<${nome}\\b`, 'g')
    let u
    while ((u = reUso.exec(limpo))) {
      // lê a tag até o ">" de fechamento fora de chaves
      let prof = 0
      let k = u.index + 1
      for (; k < limpo.length; k++) {
        const ch = limpo[k]
        if (ch === '{') prof++
        else if (ch === '}') prof--
        else if (ch === '>' && prof === 0) break
      }
      const tag = limpo.slice(u.index, k + 1)
      if (!/\bstrokeWidth\b/.test(tag)) achados.push({ indice: u.index, trecho: `<${nome} …>` })
    }
  }
  return achados
}

// ─── Varredura ───────────────────────────────────────────────────────────────

let arquivos
if (argArquivo) {
  const abs = resolve(RAIZ, argArquivo)
  if (!existsSync(abs)) {
    console.error(`verificar-design: arquivo não encontrado: ${argArquivo}`)
    process.exit(2)
  }
  arquivos = [abs]
} else {
  arquivos = listar(join(RAIZ, 'src')).sort()
}

const isentos = new Set(SEM_ISENTOS ? [] : ISENTOS)
const regrasAtivas = REGRAS.filter((r) => !r.limpeza || LIMPEZA)

const ocorrencias = [] // { arquivo, linha, regra, nivel, trecho, isento }
for (const abs of arquivos) {
  const caminho = posix(relative(RAIZ, abs))
  const original = readFileSync(abs, 'utf8')
  const limpo = semComentarios(original)
  const linhasOriginais = original.split('\n')
  const linhasLimpas = limpo.split('\n')
  const isento = isentos.has(caminho)

  for (const regra of regrasAtivas) {
    if (regra.aplica && !regra.aplica(caminho)) continue
    if (regra.especial === 'lucide') {
      for (const a of verificarLucide(limpo)) {
        const linha = linhaDe(limpo, a.indice)
        ocorrencias.push({ arquivo: caminho, linha, regra, trecho: linhasOriginais[linha - 1].trim(), isento })
      }
      continue
    }
    linhasLimpas.forEach((texto, idx) => {
      regra.re.lastIndex = 0
      let m
      while ((m = regra.re.exec(texto))) {
        if (m[0] === '') { regra.re.lastIndex++; continue }
        if (regra.ignora && regra.ignora(texto, m)) continue
        ocorrencias.push({
          arquivo: caminho,
          linha: idx + 1,
          regra,
          trecho: linhasOriginais[idx].trim(),
          isento,
        })
      }
    })
  }
}

// ─── Saída ───────────────────────────────────────────────────────────────────

const falhas = ocorrencias.filter((o) => o.regra.nivel === 'erro' && !o.isento)
const avisosIsentos = ocorrencias.filter((o) => o.regra.nivel === 'erro' && o.isento)
const avisosRegra = ocorrencias.filter((o) => o.regra.nivel === 'aviso')

const corte = (s, max = 140) => (s.length > max ? s.slice(0, max - 1) + '…' : s)

function imprimir(titulo, lista) {
  if (!lista.length) return
  console.log(`\n${titulo} (${lista.length})`)
  let atual = ''
  for (const o of lista) {
    if (o.arquivo !== atual) { atual = o.arquivo; console.log(`\n  ${atual}`) }
    console.log(`    ${o.arquivo}:${o.linha}  [${o.regra.id}]  ${corte(o.trecho)}`)
  }
}

if (!RESUMO) {
  imprimir('AVISO: regras de aviso (não falham)', avisosRegra)
  imprimir('AVISO: violações em arquivos ISENTOS (não falham; a lista só diminui)', avisosIsentos)
  imprimir('ERRO: violações em arquivos migrados', falhas)
}

// contagem por regra
const porRegra = new Map()
for (const r of regrasAtivas) porRegra.set(r.id, { r, erro: 0, isento: 0, aviso: 0 })
for (const o of ocorrencias) {
  const c = porRegra.get(o.regra.id)
  if (o.regra.nivel === 'aviso') c.aviso++
  else if (o.isento) c.isento++
  else c.erro++
}
console.log('\nContagem por regra (erro = falha · isento = aviso em arquivo isento · aviso = regra de aviso)')
const larg = Math.max(...regrasAtivas.map((r) => r.id.length))
for (const { r, erro, isento, aviso } of porRegra.values()) {
  if (!erro && !isento && !aviso) continue
  console.log(
    `  ${r.id.padEnd(larg)}  erro ${String(erro).padStart(4)}  isento ${String(isento).padStart(4)}  aviso ${String(aviso).padStart(4)}   (${r.secao}) ${r.oque}`,
  )
}

// higiene da lista ISENTOS
if (!SEM_ISENTOS) {
  const comErro = new Set(ocorrencias.filter((o) => o.regra.nivel === 'erro').map((o) => o.arquivo))
  const inexistentes = ISENTOS.filter((p) => !existsSync(join(RAIZ, p)))
  const limpos = ISENTOS.filter((p) => existsSync(join(RAIZ, p)) && !comErro.has(p))
  const ordenada = [...ISENTOS].sort().join('\n') === ISENTOS.join('\n')
  if (inexistentes.length) console.log(`\nISENTOS com arquivo que não existe mais (tire da lista): ${inexistentes.join(', ')}`)
  if (limpos.length) console.log(`\nISENTOS já limpos (tire da lista): ${limpos.join(', ')}`)
  if (!ordenada) console.log('\nISENTOS fora de ordem alfabética: mantenha a lista ordenada.')
}

const nArquivosFalha = new Set(falhas.map((o) => o.arquivo)).size
console.log(
  `\n${arquivos.length} arquivo(s) · ${falhas.length} erro(s) em ${nArquivosFalha} arquivo(s) · ` +
    `${avisosIsentos.length} em isentos · ${avisosRegra.length} aviso(s)` +
    (argArquivo ? ` · --arquivo=${argArquivo} (ISENTOS ignorado)` : '') +
    (LIMPEZA ? ' · --limpeza' : ''),
)

if (falhas.length) {
  console.log('verificar-design: FALHOU')
  process.exit(1)
}
console.log('verificar-design: ok')
