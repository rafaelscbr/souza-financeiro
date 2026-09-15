import { useEffect, useState, type CSSProperties } from 'react'
import { aoMudarMovimento, movimentoReduzido } from './useMovimentoReduzido'

/*
 * 8.2 — quem liga o movimento.
 *
 * O estado padrão de tudo é VISÍVEL. As entradas (`.entrada-pagina`, `.escada`,
 * `.barra-preenchimento[data-primeira]`) só animam debaixo de `html.animar`, e
 * esta classe só entra quando a aba está visível
 * (`document.visibilityState === 'visible'`) e sem movimento reduzido. Uma aba
 * aberta em segundo plano não roda quadros: se a classe já estivesse lá, as
 * linhas ficariam presas no primeiro quadro (a corrida que deixou 5 linhas
 * invisíveis no Início do celular).
 *
 * A classe não sai quando a aba some: tirar e pôr de novo reiniciaria toda
 * animação da tela. Sai só se a pessoa ligar o movimento reduzido.
 */
export function ligarAnimar(raiz: HTMLElement = document.documentElement): () => void {
  const aplicar = () => {
    if (movimentoReduzido()) raiz.classList.remove('animar')
    else if (document.visibilityState === 'visible') raiz.classList.add('animar')
  }
  aplicar()
  document.addEventListener('visibilitychange', aplicar)
  const cancelarMidia = aoMudarMovimento(aplicar)
  return () => {
    document.removeEventListener('visibilitychange', aplicar)
    cancelarMidia()
  }
}

/*
 * 8.2 / 8.3 — a escada e a rede de segurança.
 *
 * A escada roda só na 1ª montagem daquela lista naquela rota: remontar (voltar
 * para a rota, trocar o mês, filtrar, refetch) não refaz. O registro é por
 * `rota + chave`, fora do componente, porque um `useRef` morre com a remontagem.
 *
 * Rede de segurança: 600ms depois de montar, `data-animou` entra e o seletor
 * `.escada:not([data-animou])` deixa de casar. Se o navegador não rodou os
 * quadros (iframe fora da tela, aba congelada), o item aparece mesmo assim.
 *
 *   const escada = useEscada('parcelas')
 *   <div className="lista escada" {...escada}>
 *     {itens.map((it, i) => <div className="linha" style={indiceEscada(i)} …/>)}
 *
 * `semEscada` (ex.: o conteúdo chegou depois de um esqueleto, 8.3) já nasce
 * marcado; quem chama usa `esmaeceEntra` no lugar.
 */
const REDE_DE_SEGURANCA_MS = 600
const jaAnimaram = new Set<string>()

function chaveDaRota(chave: string): string {
  return `${typeof window === 'undefined' ? '' : window.location.pathname}|${chave}`
}

export function useEscada(chave: string, semEscada = false): { 'data-animou'?: '' } {
  const [animou, setAnimou] = useState(() => semEscada || jaAnimaram.has(chaveDaRota(chave)))

  useEffect(() => {
    const k = chaveDaRota(chave)
    if (semEscada || jaAnimaram.has(k)) {
      jaAnimaram.add(k)
      setAnimou(true)
      return
    }
    const t = window.setTimeout(() => {
      jaAnimaram.add(k)
      setAnimou(true)
    }, REDE_DE_SEGURANCA_MS)
    return () => window.clearTimeout(t)
  }, [chave, semEscada])

  return animou ? { 'data-animou': '' } : {}
}

/** `--i` inline de cada filho da escada (8.2: `nth-child` sai). */
export function indiceEscada(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}
