/**
 * CFO virtual — a ÚNICA porta de dados do agente financeiro.
 *
 * O agente (o modelo) não calcula nada. Ele chama este script, este script
 * chama funções SQL determinísticas e devolve o que o banco respondeu. Toda a
 * aritmética mora no Postgres, onde pode ser conferida linha a linha.
 *
 * As decisões de projeto e o porquê de cada uma:
 *
 * · SÓ LÊ, por padrão. As únicas escritas possíveis são nas tabelas do próprio
 *   CFO (memória, propostas, decisões), e mesmo elas passam por funções
 *   `cfo_*`. Não existe caminho neste arquivo que escreva em `transactions`,
 *   `sales` ou `sale_installments` — nem por engano, nem por opção escondida:
 *   o nome da função é validado contra uma lista fixa antes de qualquer chamada.
 * · JSON por padrão, markdown com `--md`. O consumidor normal é um modelo, e
 *   modelo lê JSON sem ambiguidade. O `briefing` inverte o padrão porque ele
 *   existe para ser lido por gente.
 * · O `_meta` da função SQL NUNCA é descartado, e o script acrescenta um
 *   `_meta.cli` com o que ele mesmo decidiu (período padrão, limites, truncagem).
 *   Sem isso, um número certo com período errado passa por número certo.
 * · Erro é erro: imprime a mensagem do banco e sai com código 1. Nunca estima,
 *   nunca completa lacuna com chute, nunca engole falha.
 * · Nenhuma chave aparece na saída, nem em mensagem de erro. Falta de variável
 *   de ambiente é reportada pelo NOME da variável.
 * · Dinheiro em markdown sai em pt-BR com centavos e sem abreviação. "R$ 1,2 M"
 *   não serve para conferir nada.
 *
 * Rodar:  npm run cfo -- briefing --md
 *         node --env-file=.env scripts/cfo.mjs posicao
 */
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------- ambiente

const URL_BANCO = process.env.VITE_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY

// Guarda de projeto, igual à do backup.mjs. O icrm é o CRM de produção e nenhum
// script deste repositório pode tocá-lo, nem para ler. Se o .env for trocado, o
// script morre aqui em vez de consultar o banco errado com cara de acerto.
const PROJETO_ALVO = 'iejmrzcgoeoxhhcnqodn' // souza-financeiro
const PROJETO_PROIBIDO = 'dczexbzsfdavcrwiungk' // icrm

const FUSO = 'America/Sao_Paulo'
const TETO_LINHAS = 500 // teto duro de linhas por lista, em qualquer comando
const TIMEOUT_MS = 60_000

// ------------------------------------------------------------- utilidades

const fmtDinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const fmtInteiro = new Intl.NumberFormat('pt-BR')

/** Data de hoje no fuso de Itajaí, em YYYY-MM-DD. O 'sv-SE' já sai nesse formato. */
const hojeISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO }).format(new Date())

/** Soma dias a uma data YYYY-MM-DD sem passar por fuso (aritmética em UTC puro). */
function somaDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(a, m - 1, d) + dias * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Primeiro e último dia do mês de uma data YYYY-MM-DD. */
function mesDe(iso) {
  const [a, m] = iso.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { de: `${a}-${mm}-01`, ate: `${a}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/** Valida YYYY-MM-DD de verdade: 2026-02-31 é sintaticamente válido e não existe. */
function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [a, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function morre(mensagem, detalhe = '') {
  console.error(mensagem + (detalhe ? `\n${detalhe}` : ''))
  process.exit(1)
}

// -------------------------------------------------------- leitura dos args

const BOOLEANAS = new Set(['md', 'json', 'ajuda', 'help', 'h'])

/**
 * Aceita `--chave=valor` e `--chave valor`. Traço vira underscore no nome
 * (`--revisar-em` → `revisar_em`) porque o agente escreve das duas formas e
 * uma opção "quase certa" que é ignorada calada é pior do que um erro.
 */
function lerArgs(argv) {
  const posicionais = []
  const opcoes = {}
  for (let i = 0; i < argv.length; i++) {
    const bruto = argv[i]
    if (!bruto.startsWith('--')) {
      posicionais.push(bruto)
      continue
    }
    const corpo = bruto.slice(2)
    const igual = corpo.indexOf('=')
    let nome = (igual === -1 ? corpo : corpo.slice(0, igual)).replace(/-/g, '_')
    if (igual !== -1) {
      opcoes[nome] = corpo.slice(igual + 1)
      continue
    }
    if (BOOLEANAS.has(nome)) {
      opcoes[nome] = true
      continue
    }
    const proximo = argv[i + 1]
    if (proximo === undefined || proximo.startsWith('--')) morre(`A opção --${nome} exige um valor.`)
    opcoes[nome] = proximo
    i++
  }
  return { posicionais, opcoes }
}

// -------------------------------------------------------- catálogo de comandos
//
// Tudo o que este script sabe fazer está aqui. Um comando que não esteja nesta
// tabela não roda, e uma função que não comece com `cfo_` não é chamada: o
// alcance do CFO é fechado por construção, não por disciplina de quem edita.

const PERIODO = ['de', 'ate']
const COMUNS = ['md', 'json', 'limite']

const COMANDOS = {
  briefing: { opcoes: [...COMUNS], escreve: false },
  posicao: { rpc: 'cfo_posicao', opcoes: [...COMUNS], params: () => ({}) },
  dre: {
    rpc: 'cfo_dre',
    opcoes: [...COMUNS, ...PERIODO, 'regime'],
    periodo: true,
    params: (o, p) => ({ p_de: p.de, p_ate: p.ate, p_regime: regime(o) }),
  },
  fluxo: {
    rpc: 'cfo_fluxo_semanal',
    opcoes: [...COMUNS, 'semanas'],
    params: (o, _p, cli) => ({ p_semanas: inteiro(o.semanas, 13, 1, 104, 'semanas', cli) }),
  },
  recebiveis: { rpc: 'cfo_recebiveis', opcoes: [...COMUNS, ...PERIODO], periodo: true, params: periodoParams },
  pagaveis: { rpc: 'cfo_pagaveis', opcoes: [...COMUNS, ...PERIODO], periodo: true, params: periodoParams },
  despesas: { rpc: 'cfo_despesas', opcoes: [...COMUNS, ...PERIODO], periodo: true, params: periodoParams },
  vendas: { rpc: 'cfo_vendas', opcoes: [...COMUNS, ...PERIODO], periodo: true, params: periodoParams },
  corretores: { rpc: 'cfo_corretores', opcoes: [...COMUNS, ...PERIODO], periodo: true, params: periodoParams },
  empreendimentos: {
    rpc: 'cfo_empreendimentos',
    opcoes: [...COMUNS, ...PERIODO],
    periodo: true,
    params: periodoParams,
  },
  concentracao: { rpc: 'cfo_concentracao', opcoes: [...COMUNS], params: () => ({}) },
  serie: {
    rpc: 'cfo_serie_mensal',
    opcoes: [...COMUNS, 'meses'],
    params: (o, _p, cli) => ({ p_meses: inteiro(o.meses, 12, 1, 120, 'meses', cli) }),
  },
  lacunas: { rpc: 'cfo_lacunas', opcoes: [...COMUNS], params: () => ({}) },
  lancamentos: {
    rpc: 'cfo_lancamentos',
    opcoes: [...COMUNS, 'filtro'],
    params: (o) => {
      if (o.filtro === undefined) morre('lancamentos exige --filtro com um objeto JSON.')
      return { p_filtro: json(o.filtro, 'filtro') }
    },
  },

  // subcomandos ------------------------------------------------------------
  memoria: {
    sub: {
      listar: {
        rpc: 'cfo_memoria_listar',
        opcoes: [...COMUNS, 'tipo'],
        // null = todos. Mandar sempre o parâmetro evita depender de um DEFAULT
        // do SQL que este script não controla.
        params: (o) => ({ p_tipo: o.tipo ?? null }),
      },
      gravar: {
        rpc: 'cfo_memoria_gravar',
        escreve: true,
        opcoes: [...COMUNS, 'tipo', 'chave', 'valor', 'status', 'origem'],
        params: (o, _p, cli) => {
          exigir(o, ['tipo', 'chave', 'valor'], 'memoria gravar')
          const status = o.status ?? 'confirmado'
          if (!['confirmado', 'inferido', 'hipotese'].includes(status)) {
            morre(`--status inválido: "${status}". Use confirmado, inferido ou hipotese.`)
          }
          if (o.status === undefined) cli.padroes_aplicados.push('status=confirmado (não informado)')
          return {
            p_tipo: o.tipo,
            p_chave: o.chave,
            p_valor: o.valor,
            p_status: status,
            p_origem: o.origem ?? null,
          }
        },
      },
      remover: {
        rpc: 'cfo_memoria_remover',
        escreve: true,
        opcoes: [...COMUNS, 'chave'],
        params: (o) => {
          exigir(o, ['chave'], 'memoria remover')
          return { p_chave: o.chave }
        },
      },
    },
  },
  proposta: {
    sub: {
      criar: {
        rpc: 'cfo_proposta_criar',
        escreve: true,
        opcoes: [...COMUNS, 'titulo', 'problema', 'evidencia', 'impacto', 'mudanca', 'prioridade', 'criterios'],
        params: (o) => {
          exigir(o, ['titulo', 'problema', 'evidencia', 'impacto', 'mudanca'], 'proposta criar')
          return {
            p_titulo: o.titulo,
            p_problema: o.problema,
            p_evidencia: o.evidencia,
            p_impacto: o.impacto,
            p_mudanca: o.mudanca,
            // prioridade e critérios vão como null quando não informados: quem
            // define o valor aceito é a constraint do banco, não este script.
            p_prioridade: o.prioridade ?? null,
            p_criterios: o.criterios ?? null,
          }
        },
      },
      listar: {
        rpc: 'cfo_propostas_listar',
        opcoes: [...COMUNS, 'status'],
        params: (o) => ({ p_status: o.status ?? null }),
      },
    },
  },
  decisao: {
    sub: {
      registrar: {
        rpc: 'cfo_decisao_registrar',
        escreve: true,
        opcoes: [...COMUNS, 'pergunta', 'recomendacao', 'numeros', 'decidido', 'esperado', 'revisar_em'],
        params: (o) => {
          exigir(o, ['pergunta', 'recomendacao'], 'decisao registrar')
          if (o.revisar_em !== undefined && !dataValida(o.revisar_em)) {
            morre(`--revisar-em inválida: "${o.revisar_em}". Use YYYY-MM-DD.`)
          }
          return {
            p_pergunta: o.pergunta,
            p_recomendacao: o.recomendacao,
            p_numeros: o.numeros === undefined ? null : json(o.numeros, 'numeros'),
            p_decidido: o.decidido ?? null,
            p_esperado: o.esperado ?? null,
            p_revisar_em: o.revisar_em ?? null,
          }
        },
      },
      listar: {
        rpc: 'cfo_decisoes_listar',
        opcoes: [...COMUNS, 'status'],
        params: (o) => ({ p_status: o.status ?? null }),
      },
    },
  },
}

/**
 * Comandos que alguém (pessoa ou modelo) tentaria escrever achando que o CFO
 * opera o sistema. O CFO analisa; quem lança é a secretária, pelo app. Recusar
 * com nome é melhor do que "comando desconhecido": deixa claro que a ausência
 * é deliberada.
 */
const ESCRITA_FINANCEIRA =
  /^(lancar|lançar|lancamento_criar|baixar|baixa|pagar|receber|quitar|criar|inserir|insert|editar|atualizar|update|excluir|deletar|delete|remover_lancamento|apagar|drop|truncate|sql|query|exec|executar|transacao|transação|venda|parcela|conciliar|estornar)$/i

function periodoParams(_o, p) {
  return { p_de: p.de, p_ate: p.ate }
}

function regime(o) {
  const r = o.regime ?? 'accrual'
  if (!['accrual', 'cash'].includes(r)) morre(`--regime inválido: "${r}". Use accrual ou cash.`)
  return r
}

function inteiro(valor, padrao, min, max, nome, cli) {
  if (valor === undefined) {
    cli.padroes_aplicados.push(`${nome}=${padrao} (não informado)`)
    return padrao
  }
  const n = Number(valor)
  if (!Number.isInteger(n) || n < min) morre(`--${nome} deve ser um inteiro >= ${min}. Recebi "${valor}".`)
  if (n > max) {
    cli.padroes_aplicados.push(`${nome} reduzido de ${n} para o teto ${max}`)
    return max
  }
  return n
}

function json(texto, nome) {
  let v
  try {
    v = JSON.parse(texto)
  } catch (e) {
    morre(`--${nome} não é JSON válido.`, e.message)
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    morre(`--${nome} precisa ser um objeto JSON (ex.: --${nome}='{"categoria":"Marketing"}').`)
  }
  return v
}

function exigir(o, campos, comando) {
  const faltando = campos.filter((c) => o[c] === undefined || o[c] === '')
  if (faltando.length) morre(`${comando} exige: ${faltando.map((c) => '--' + c.replace(/_/g, '-')).join(', ')}`)
}

// ------------------------------------------------------------------- ajuda

const AJUDA = `CFO virtual da Souza Imobiliária — porta única de dados (somente leitura, salvo memória/propostas/decisões).

  node --env-file=.env scripts/cfo.mjs <comando> [opções]

  briefing                    TUDO de uma vez: posição, lacunas, fluxo de 13 semanas,
                              DRE do mês, recebíveis, pagáveis e memória. Sai em markdown.
  posicao                     posição de hoje: caixa, a receber, devido agora, previsto, carteira
  dre        --de=YYYY-MM-DD --ate=YYYY-MM-DD [--regime=accrual|cash]
  fluxo      [--semanas=13]
  recebiveis [--de=] [--ate=]
  pagaveis   [--de=] [--ate=]
  despesas   [--de=] [--ate=]
  vendas     [--de=] [--ate=]
  corretores [--de=] [--ate=]
  empreendimentos [--de=] [--ate=]
  concentracao
  serie      [--meses=12]
  lacunas
  lancamentos --filtro='{"categoria":"Marketing"}'

  memoria listar [--tipo=]
  memoria gravar --tipo= --chave= --valor= [--status=confirmado|inferido|hipotese] [--origem=]
  memoria remover --chave=

  proposta criar --titulo= --problema= --evidencia= --impacto= --mudanca= [--prioridade=] [--criterios=]
  proposta listar [--status=]

  decisao registrar --pergunta= --recomendacao= [--numeros=JSON] [--decidido=] [--esperado=] [--revisar-em=]
  decisao listar [--status=]

  Opções gerais:
    --md            saída em markdown para humano (padrão do briefing)
    --json          força JSON (útil para pedir o briefing em JSON)
    --limite=N      teto de linhas por lista, máximo ${TETO_LINHAS} (padrão ${TETO_LINHAS})

  Sem --de/--ate, usa o mês corrente e registra isso em _meta.cli.
  Todo resultado carrega o _meta da função SQL. Erro do banco sai inteiro e o
  código de saída é 1.`

// ------------------------------------------------------- chamada ao banco

function cliente() {
  const faltando = []
  if (!URL_BANCO) faltando.push('VITE_SUPABASE_URL')
  if (!CHAVE) faltando.push('SUPABASE_SERVICE_ROLE_KEY')
  if (faltando.length) {
    morre(
      `Faltam variáveis de ambiente: ${faltando.join(', ')}.`,
      'Rode com --env-file=.env (ou npm run cfo -- <comando>).',
    )
  }
  if (URL_BANCO.includes(PROJETO_PROIBIDO)) {
    morre('ABORTADO: a URL aponta para o projeto icrm. Este script nunca toca no icrm.')
  }
  if (!URL_BANCO.includes(PROJETO_ALVO)) {
    morre(`ABORTADO: a URL não é do souza-financeiro (esperado o projeto ${PROJETO_ALVO}).`)
  }
  return createClient(URL_BANCO, CHAVE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Chama uma função `cfo_*`. Devolve { ok, dados } ou { ok: false, erro } — quem
 * chama decide entre morrer (comando único) e seguir marcando o bloco como
 * falho (briefing). Em nenhum caso um erro vira número.
 */
async function rpc(db, nome, params) {
  if (!nome.startsWith('cfo_')) {
    // Trava estrutural: nada fora do namespace do CFO é alcançável daqui.
    morre(`ABORTADO: "${nome}" não é uma função do CFO.`)
  }
  try {
    const { data, error } = await db.rpc(nome, params).abortSignal(AbortSignal.timeout(TIMEOUT_MS))
    if (error) return { ok: false, erro: descreveErro(nome, error) }
    return { ok: true, dados: data }
  } catch (e) {
    const msg = e?.name === 'TimeoutError' ? `sem resposta em ${TIMEOUT_MS / 1000}s` : e.message
    return { ok: false, erro: { funcao: nome, mensagem: msg } }
  }
}

function descreveErro(nome, error) {
  const faltou = error.code === 'PGRST202' || /could not find the function|does not exist/i.test(error.message ?? '')
  return {
    funcao: nome,
    mensagem: error.message,
    detalhe: error.details ?? null,
    dica: faltou
      ? `A função ${nome} ainda não existe neste banco (migração do CFO não aplicada). Aplique a migração e rode de novo.`
      : (error.hint ?? null),
    codigo: error.code ?? null,
  }
}

function imprimeErro(erro) {
  console.error(`ERRO na função ${erro.funcao}: ${erro.mensagem}`)
  if (erro.detalhe) console.error(`detalhe: ${erro.detalhe}`)
  if (erro.dica) console.error(`dica: ${erro.dica}`)
  if (erro.codigo) console.error(`código: ${erro.codigo}`)
}

// ------------------------------------------------------- pós-processamento

/** Corta listas longas e registra o corte. Nunca mexe em nada dentro de _meta. */
function truncar(valor, limite, caminho, registro) {
  if (Array.isArray(valor)) {
    let lista = valor
    if (lista.length > limite) {
      registro.push({ caminho: caminho || '(raiz)', total: lista.length, mostrando: limite })
      lista = lista.slice(0, limite)
    }
    return lista.map((v, i) => truncar(v, limite, `${caminho}[${i}]`, registro))
  }
  if (valor && typeof valor === 'object') {
    const saida = {}
    for (const [k, v] of Object.entries(valor)) {
      saida[k] = k === '_meta' ? v : truncar(v, limite, caminho ? `${caminho}.${k}` : k, registro)
    }
    return saida
  }
  return valor
}

/** Junta o _meta do banco com o _meta.cli, sem perder nada do que veio do SQL. */
function comMeta(dados, cli) {
  if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
    const doBanco = dados._meta && typeof dados._meta === 'object' ? dados._meta : null
    return {
      ...dados,
      _meta: doBanco
        ? { ...doBanco, cli }
        : { cli, aviso_cli: 'A função SQL não devolveu _meta. Confira a migração.' },
    }
  }
  return {
    dados,
    _meta: { cli, aviso_cli: 'A função SQL não devolveu um objeto com _meta. Confira a migração.' },
  }
}

// ------------------------------------------------------------- markdown
//
// O markdown é apresentação: o JSON continua sendo a fonte. Por isso o
// formatador de número é heurístico pelo nome do campo — e, na dúvida, formata
// como dinheiro com centavos, que é o caso esmagador neste sistema.

const CHAVE_PERCENTUAL = /(_pct$|percentual|percent|aliquota)/i
// Contagens: palavras que só existem como "quantas". `dias`, `semanas` e `meses`
// contam apenas no INÍCIO da chave, porque "proximos_30_dias" é dinheiro e
// "dias_vencidos" é contagem.
const CHAVE_CONTAGEM =
  /(^|_)(linhas|parcelas|qtd|qtde|quantidade|quantas|quantos|count|contagem|itens|registros|lancamentos|ocorrencias|vendas|clientes|corretores|contatos|corretor)(_|$)/i
const CHAVE_CONTAGEM_INICIO = /^(dias|semanas|meses|anos|num|numero|total_de)(_|$)/i
const CHAVE_INDICE = /(^|_)(id|ano|mes|dia|semana|codigo|numero_da_parcela)(_|$)/i

/**
 * Formatação de número para o markdown. O JSON continua sendo a fonte; aqui é
 * heurística consciente, na seguinte ordem (e o porquê de cada degrau):
 *   1. percentual, quando o nome diz percentual;
 *   2. QUALQUER número com casas decimais é dinheiro — contagem não tem centavo;
 *   3. nome de contagem → inteiro;
 *   4. índice (ano, mês, id) → inteiro sem formatação de moeda;
 *   5. o resto → dinheiro. Neste sistema, um número solto é quase sempre R$.
 */
function formataValor(chave, v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'number') {
    if (CHAVE_PERCENTUAL.test(chave)) return `${v.toFixed(2).replace('.', ',')}%`
    if (!Number.isInteger(v)) return fmtDinheiro.format(v)
    if (CHAVE_CONTAGEM.test(chave) || CHAVE_CONTAGEM_INICIO.test(chave)) return fmtInteiro.format(v)
    if (CHAVE_INDICE.test(chave)) return String(v)
    return fmtDinheiro.format(v)
  }
  if (typeof v === 'object') return '`' + JSON.stringify(v) + '`'
  return String(v)
}

const titulo = (k) => {
  const s = k.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const celula = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')

function tabela(lista) {
  if (lista.length === 0) return ['_(nada)_']
  if (lista.some((x) => x === null || typeof x !== 'object' || Array.isArray(x))) {
    return lista.map((x) => `- ${typeof x === 'object' ? '`' + JSON.stringify(x) + '`' : x}`)
  }
  const colunas = []
  for (const item of lista) for (const k of Object.keys(item)) if (!colunas.includes(k)) colunas.push(k)
  const numerica = (c) => lista.some((l) => typeof l[c] === 'number')
  return [
    `| ${colunas.map(titulo).join(' | ')} |`,
    `| ${colunas.map((c) => (numerica(c) ? '---:' : '---')).join(' | ')} |`,
    ...lista.map((l) => `| ${colunas.map((c) => celula(formataValor(c, l[c]))).join(' | ')} |`),
  ]
}

/** Renderiza um objeto: escalares primeiro (viram lista), depois os blocos. */
function renderiza(obj, nivel) {
  const linhas = []
  const entradas = Object.entries(obj).filter(([k]) => k !== '_meta')
  const escalares = entradas.filter(([, v]) => v === null || typeof v !== 'object')
  const compostos = entradas.filter(([, v]) => v !== null && typeof v === 'object')

  for (const [k, v] of escalares) linhas.push(`- **${titulo(k)}**: ${formataValor(k, v)}`)
  if (escalares.length && compostos.length) linhas.push('')

  for (const [k, v] of compostos) {
    linhas.push(`${'#'.repeat(Math.min(nivel, 6))} ${titulo(k)}`, '')
    if (Array.isArray(v)) linhas.push(...tabela(v))
    else linhas.push(...renderiza(v, nivel + 1))
    linhas.push('')
  }
  return linhas
}

function momento(meta) {
  const iso = meta?.consultado_em
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${d.toLocaleString('pt-BR', { timeZone: FUSO })} (${iso})`
}

/** Rodapé: o que permite conferir período, filtros e momento da consulta. */
function rodape(meta) {
  const linhas = ['---', '']
  const m = momento(meta)
  if (m) linhas.push(`Consultado em ${m}`, '')
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (k === 'consultado_em' || k === 'premissas' || k === 'cli') continue
    if (v !== null && typeof v === 'object') continue
    linhas.push(`- ${titulo(k)}: ${v}`)
  }
  if (Array.isArray(meta?.premissas) && meta.premissas.length) {
    linhas.push('', 'Premissas da função SQL:')
    for (const p of meta.premissas) linhas.push(`- ${p}`)
  }
  if (meta?.cli) {
    linhas.push('', 'Decisões deste comando:')
    linhas.push(`- comando: ${meta.cli.comando}`)
    if (meta.cli.funcoes) linhas.push(`- funções: ${meta.cli.funcoes.join(', ')}`)
    else if (meta.cli.funcao) linhas.push(`- função: ${meta.cli.funcao}`)
    linhas.push(`- parâmetros enviados: ${JSON.stringify(meta.cli.parametros)}`)
    for (const [bloco, janela] of Object.entries(meta.cli.janelas ?? {})) {
      linhas.push(`- janela de ${bloco}: ${janela}`)
    }
    for (const p of meta.cli.padroes_aplicados ?? []) linhas.push(`- padrão aplicado: ${p}`)
    for (const t of meta.cli.truncado ?? []) {
      linhas.push(`- TRUNCADO em ${t.caminho}: mostrando ${t.mostrando} de ${t.total} linhas (use --limite)`)
    }
  }
  linhas.push('')
  return linhas
}

function saida(resultado, formatoMd, tituloDoc) {
  if (!formatoMd) {
    console.log(JSON.stringify(resultado, null, 2))
    return
  }
  const linhas = [`# ${tituloDoc}`, '']
  linhas.push(...renderiza(resultado, 2))
  linhas.push(...rodape(resultado._meta))
  console.log(linhas.join('\n'))
}

// ------------------------------------------------------------- briefing

/**
 * O comando de abertura. Sete blocos, cada um com o seu próprio _meta.
 *
 * Se algum bloco falhar, ele aparece na saída como falha explícita e o código
 * de saída é 1. Briefing com buraco calado é o jeito mais fácil de um CFO
 * aconselhar sobre uma empresa que ele não enxergou inteira.
 */
async function briefing(db, opcoes, cli, limite) {
  const hoje = hojeISO()
  const mes = mesDe(hoje)
  // Janela dos recebíveis/pagáveis: 90 dias para trás pega o que está vencido,
  // 90 para a frente cobre o horizonte de decisão. A posição já traz o total
  // vencido consolidado, então esta janela é para ver as linhas.
  const de = somaDias(hoje, -90)
  const ate = somaDias(hoje, 90)

  const blocos = [
    ['posicao', 'cfo_posicao', {}],
    ['lacunas', 'cfo_lacunas', {}],
    ['fluxo_13_semanas', 'cfo_fluxo_semanal', { p_semanas: 13 }],
    ['dre_do_mes', 'cfo_dre', { p_de: mes.de, p_ate: mes.ate, p_regime: 'accrual' }],
    ['recebiveis', 'cfo_recebiveis', { p_de: de, p_ate: ate }],
    ['pagaveis', 'cfo_pagaveis', { p_de: de, p_ate: ate }],
    ['memoria', 'cfo_memoria_listar', { p_tipo: null }],
  ]

  cli.funcoes = blocos.map(([, f]) => f)
  cli.parametros = Object.fromEntries(blocos.map(([nome, , p]) => [nome, p]))
  cli.janelas = {
    dre_do_mes: `${mes.de} a ${mes.ate} (mês corrente, padrão)`,
    recebiveis_pagaveis: `${de} a ${ate} (90 dias para trás e para a frente, padrão)`,
  }

  const resultados = await Promise.all(blocos.map(([, funcao, params]) => rpc(db, funcao, params)))

  const montado = {}
  const falhas = []
  const registroTrunc = []
  blocos.forEach(([nome, funcao], i) => {
    const r = resultados[i]
    if (r.ok) montado[nome] = truncar(r.dados, limite, nome, registroTrunc)
    else falhas.push({ bloco: nome, ...r.erro })
  })
  if (registroTrunc.length) cli.truncado = registroTrunc
  if (falhas.length) cli.blocos_que_falharam = falhas.map((f) => f.bloco)

  const resultado = {
    ...montado,
    ...(falhas.length ? { nao_foi_possivel_ler: falhas } : {}),
    _meta: {
      funcao: 'briefing (composto)',
      empresa: montado.posicao?._meta?.empresa ?? null,
      data_de_referencia: hoje,
      consultado_em: new Date().toISOString(),
      cli,
    },
  }

  // Único comando cujo padrão é markdown; só sai em JSON se pedirem --json.
  if (opcoes.json === true) {
    console.log(JSON.stringify(resultado, null, 2))
  } else {
    // Markdown é o padrão aqui: o briefing existe para ser lido.
    const linhas = [`# Briefing do CFO — ${resultado._meta.empresa ?? 'Souza Imobiliária'}`, '', `Referência: ${hoje}`, '']
    if (falhas.length) {
      linhas.push(
        `> ATENÇÃO: ${falhas.length} de ${blocos.length} blocos NÃO puderam ser lidos. Este briefing está incompleto.`,
        '',
      )
    }
    for (const [nome] of blocos) {
      if (!montado[nome]) continue
      linhas.push(`## ${titulo(nome)}`, '')
      linhas.push(...renderiza(montado[nome], 3))
      const m = momento(montado[nome]._meta)
      if (m) linhas.push(`_${montado[nome]._meta.funcao ?? nome} · consultado em ${m}_`, '')
    }
    if (falhas.length) {
      linhas.push('## Não foi possível ler', '')
      for (const f of falhas) linhas.push(`- **${f.bloco}** (${f.funcao}): ${f.mensagem}${f.dica ? ` — ${f.dica}` : ''}`)
      linhas.push('')
    }
    linhas.push(...rodape(resultado._meta))
    console.log(linhas.join('\n'))
  }

  // Erro é erro, mesmo quando o resto do briefing saiu.
  if (falhas.length) process.exit(1)
}

// ------------------------------------------------------------------ main

const { posicionais, opcoes } = lerArgs(process.argv.slice(2))
const comando = posicionais[0]

if (!comando || opcoes.ajuda || opcoes.help || opcoes.h) {
  console.log(AJUDA)
  process.exit(comando ? 0 : 1)
}

if (ESCRITA_FINANCEIRA.test(comando)) {
  morre(
    `RECUSADO: "${comando}" é escrita financeira e o CFO não faz isso.`,
    'Este script só LÊ os números da imobiliária. Ele escreve apenas na memória,\n' +
      'nas propostas e nas decisões do próprio CFO (memoria/proposta/decisao).\n' +
      'Lançamento, baixa e edição de venda são feitos no aplicativo.',
  )
}

const entrada = COMANDOS[comando]
if (!entrada) {
  morre(`Comando desconhecido: "${comando}".`, `Comandos: ${Object.keys(COMANDOS).join(', ')}.\n\n${AJUDA}`)
}

// Resolve subcomando (memoria/proposta/decisao).
let spec = entrada
let nomeCompleto = comando
if (entrada.sub) {
  const sub = posicionais[1]
  if (!sub) morre(`"${comando}" exige um subcomando: ${Object.keys(entrada.sub).join(', ')}.`)
  spec = entrada.sub[sub]
  if (!spec) {
    morre(`Subcomando desconhecido: "${comando} ${sub}".`, `Use: ${Object.keys(entrada.sub).join(', ')}.`)
  }
  nomeCompleto = `${comando} ${sub}`
} else if (posicionais.length > 1) {
  morre(`"${comando}" não aceita "${posicionais[1]}".`, AJUDA)
}

// Opção desconhecida é erro. Uma opção escrita errado que é ignorada calada
// devolve o número de um período que ninguém pediu.
for (const chave of Object.keys(opcoes)) {
  if (BOOLEANAS.has(chave)) continue
  if (!spec.opcoes.includes(chave)) {
    morre(
      `Opção desconhecida em "${nomeCompleto}": --${chave.replace(/_/g, '-')}.`,
      `Aceitas: ${spec.opcoes
        .filter((o) => !['md', 'json'].includes(o))
        .map((o) => '--' + o.replace(/_/g, '-'))
        .join(', ')}`,
    )
  }
}

const cli = {
  comando: nomeCompleto,
  versao_script: 'scripts/cfo.mjs',
  padroes_aplicados: [],
  somente_leitura: spec.escreve !== true,
}

const limite = (() => {
  if (opcoes.limite === undefined) return TETO_LINHAS
  const n = Number(opcoes.limite)
  if (!Number.isInteger(n) || n < 1) morre(`--limite deve ser um inteiro >= 1. Recebi "${opcoes.limite}".`)
  if (n > TETO_LINHAS) {
    cli.padroes_aplicados.push(`limite reduzido de ${n} para o teto ${TETO_LINHAS}`)
    return TETO_LINHAS
  }
  return n
})()
cli.limite_de_linhas = limite

const db = cliente()

if (comando === 'briefing') {
  await briefing(db, opcoes, cli, limite)
  process.exit(0)
}

// Período: obrigatório para as funções que o pedem. Sem --de/--ate, o mês
// corrente — e isso fica dito no _meta, porque período implícito é a origem
// mais comum de um número certo respondendo à pergunta errada.
const periodo = {}
if (spec.periodo) {
  const hoje = hojeISO()
  const mes = mesDe(hoje)
  for (const campo of PERIODO) {
    const informado = opcoes[campo]
    if (informado === undefined) {
      periodo[campo] = mes[campo]
      cli.padroes_aplicados.push(`${campo}=${mes[campo]} (mês corrente, não informado)`)
    } else {
      if (!dataValida(informado)) morre(`--${campo} inválida: "${informado}". Use YYYY-MM-DD.`)
      periodo[campo] = informado
    }
  }
  if (periodo.de > periodo.ate) morre(`Período invertido: --de=${periodo.de} é depois de --ate=${periodo.ate}.`)
}

const params = spec.params(opcoes, periodo, cli)
cli.funcao = spec.rpc
cli.parametros = params

const r = await rpc(db, spec.rpc, params)
if (!r.ok) {
  imprimeErro(r.erro)
  process.exit(1)
}

const registroTrunc = []
const dados = truncar(r.dados, limite, '', registroTrunc)
if (registroTrunc.length) cli.truncado = registroTrunc

const resultado = comMeta(dados, cli)
saida(resultado, opcoes.md === true, `${titulo(nomeCompleto)} — ${resultado._meta?.empresa ?? 'Souza Imobiliária'}`)

if (registroTrunc.length && opcoes.md !== true) {
  // Em JSON o corte já está no _meta.cli; no stderr para quem olha o terminal.
  for (const t of registroTrunc) {
    console.error(`AVISO: ${t.caminho} truncado — mostrando ${t.mostrando} de ${t.total} linhas (use --limite).`)
  }
}
process.exit(0)
