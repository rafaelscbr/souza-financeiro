import { useSyncExternalStore } from 'react'

/*
 * 8.5 — `prefers-reduced-motion: reduce`, reativo.
 *
 * Escuta `matchMedia(...).addEventListener('change')`: quem liga a preferência
 * com o app aberto é atendido na hora, sem recarregar. Com ela ligada, `.animar`
 * sai do <html>, a contagem mostra o valor final, a barra já nasce cheia e
 * `usePresenca` desmonta em 0ms.
 */
const CONSULTA = '(prefers-reduced-motion: reduce)'

function midia(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(CONSULTA)
    : null
}

/** Leitura pontual, para código fora de componente (ex.: `animar.ts`). */
export function movimentoReduzido(): boolean {
  return midia()?.matches ?? false
}

/** Assina a mudança da preferência. Devolve a função que cancela. */
export function aoMudarMovimento(avisar: (reduzido: boolean) => void): () => void {
  const m = midia()
  if (!m) return () => {}
  const ouvir = (e: MediaQueryListEvent) => avisar(e.matches)
  m.addEventListener('change', ouvir)
  return () => m.removeEventListener('change', ouvir)
}

export function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(
    (avisar) => aoMudarMovimento(() => avisar()),
    movimentoReduzido,
    () => false,
  )
}
