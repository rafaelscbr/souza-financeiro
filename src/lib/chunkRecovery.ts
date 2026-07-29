/**
 * Recuperação de "Failed to fetch dynamically imported module".
 *
 * O app é um PWA com telas carregadas sob demanda. Quando sobe uma versão
 * nova, o hash de todos os arquivos muda — mas o service worker antigo continua
 * servindo o index velho, que aponta para arquivos que já não existem. Abrir
 * qualquer tela ainda não carregada quebra.
 *
 * Recarregar a página NÃO basta: o mesmo service worker devolve o mesmo index
 * cacheado, e a recarga falha igual. Por isso a recuperação aqui derruba o
 * service worker e apaga os caches ANTES de recarregar — só assim o navegador
 * volta à rede e pega o index novo.
 *
 * A trava é por tempo, não por sessão: uma recarga a cada 15 s no máximo (não
 * vira laço), mas continua funcionando se um segundo deploy sair enquanto a
 * pessoa está com o app aberto. A versão anterior marcava um sinalizador e
 * nunca o limpava — depois da primeira recuperação, a segunda falha só
 * quebrava a tela.
 */
const CHAVE = 'sgf.chunk-reload'
const INTERVALO_MS = 15_000

function agora(): number {
  return new Date().getTime()
}

function podeRecarregar(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0)
    return agora() - ultima > INTERVALO_MS
  } catch {
    // Safari em aba privada bloqueia sessionStorage: melhor tentar recarregar
    // uma vez do que deixar a tela quebrada.
    return true
  }
}

function marcarRecarga(): void {
  try {
    sessionStorage.setItem(CHAVE, String(agora()))
  } catch {
    /* sem storage, seguimos assim mesmo */
  }
}

/** Some com a versão em cache e volta para a rede. */
async function recarregarLimpo(): Promise<void> {
  marcarRecarga()
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* sem service worker registrado */
  }
  try {
    const chaves = (await caches?.keys?.()) ?? []
    await Promise.all(chaves.map((k) => caches.delete(k)))
  } catch {
    /* Cache Storage indisponível */
  }
  window.location.reload()
}

/**
 * Recuperação manual, para o botão da tela de erro: apaga a versão em cache e
 * recarrega, ignorando a trava de tempo. É a saída quando a recuperação
 * automática já tentou e o usuário continua preso.
 */
export function forcarAtualizacao(): void {
  void recarregarLimpo()
}

/** Sucesso: libera a trava para que um deploy futuro também possa se recuperar. */
function limparTravaDeRecarga(): void {
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    /* nada a limpar */
  }
}

/**
 * Envolve o `import()` de uma tela. Em caso de falha de rede/cache, limpa e
 * recarrega; se já recarregou há pouco, deixa o erro subir para o
 * ErrorBoundary em vez de insistir.
 */
export async function carregarComRecuperacao<T>(load: () => Promise<T>): Promise<T> {
  try {
    const modulo = await load()
    limparTravaDeRecarga()
    return modulo
  } catch (erro) {
    if (podeRecarregar()) {
      void recarregarLimpo()
      // A recarga é assíncrona: esta promessa nunca resolve, e é de propósito —
      // o React fica no fallback do Suspense até a página trocar.
      return new Promise<T>(() => {})
    }
    throw erro
  }
}
