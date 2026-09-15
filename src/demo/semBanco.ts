/**
 * Primeiro import da vitrine: corta o caminho até o banco ANTES de o cliente
 * do Supabase nascer.
 *
 * A vitrine roda na mesma origem do app (localhost:5173). Se o Rafael estiver
 * logado ali, a sessão dele está no localStorage e o cliente real a pegaria.
 * Por isso, três travas:
 *   1. fetch para o endereço do Supabase falha na hora, sem sair da máquina;
 *   2. o cliente não consegue gravar nem apagar chaves "sb-*" do localStorage
 *      (a sessão do app de verdade continua intacta);
 *   3. depois que o módulo do cliente carrega, desligarCliente() troca from,
 *      rpc e auth por versões que devolvem o erro "vitrine: sem banco".
 */

export const ERRO_VITRINE = 'vitrine: sem banco'

const urlDoBanco = String(import.meta.env.VITE_SUPABASE_URL ?? '')

const fetchOriginal = window.fetch.bind(window)
window.fetch = (entrada: RequestInfo | URL, init?: RequestInit) => {
  const alvo = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
  if (urlDoBanco && alvo.startsWith(urlDoBanco)) return Promise.reject(new TypeError(ERRO_VITRINE))
  if (/supabase\.(co|in)/.test(alvo)) return Promise.reject(new TypeError(ERRO_VITRINE))
  return fetchOriginal(entrada, init)
}

const guardar = Storage.prototype.setItem
const apagar = Storage.prototype.removeItem
Storage.prototype.setItem = function (chave: string, valor: string) {
  if (chave.startsWith('sb-')) return
  guardar.call(this, chave, valor)
}
Storage.prototype.removeItem = function (chave: string) {
  if (chave.startsWith('sb-')) return
  apagar.call(this, chave)
}

const erro = { message: ERRO_VITRINE, code: 'vitrine' }
const resposta = { data: null, error: erro, count: null, status: 0, statusText: ERRO_VITRINE }

/** Um construtor de consulta que aceita qualquer encadeamento e termina em erro. */
function consultaMorta(): unknown {
  const alvo = function () {} as unknown as object
  const proxy: unknown = new Proxy(alvo, {
    get(_t, prop) {
      if (prop === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(resposta).then(ok)
      return () => proxy
    },
    apply: () => proxy,
  })
  return proxy
}

type ClienteQualquer = {
  from: unknown
  rpc: unknown
  schema?: unknown
  channel?: unknown
  storage?: unknown
  auth: Record<string, unknown>
}

export function desligarCliente(cliente: unknown) {
  const c = cliente as ClienteQualquer
  c.from = () => consultaMorta()
  c.rpc = () => consultaMorta()
  c.schema = () => ({ from: () => consultaMorta(), rpc: () => consultaMorta() })
  const auth = c.auth
  const semSessao = async () => ({ data: { session: null, user: null }, error: erro })
  auth.getSession = semSessao
  auth.getUser = semSessao
  auth.signInWithPassword = semSessao
  auth.updateUser = semSessao
  auth.resetPasswordForEmail = async () => ({ data: null, error: erro })
  auth.signOut = async () => ({ error: null })
  auth.refreshSession = semSessao
  auth.startAutoRefresh = async () => {}
  try {
    ;(auth.stopAutoRefresh as (() => unknown) | undefined)?.call(auth)
  } catch {
    // sem refresh em andamento: nada a parar
  }
  auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } })
}
