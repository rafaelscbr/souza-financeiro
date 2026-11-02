import { useEffect, useRef, useState } from 'react'
import { useMovimentoReduzido } from './useMovimentoReduzido'

/*
 * O NÚMERO QUE ROLA (Souza 3.0, 02/11/2026).
 *
 * Quando um saldo muda (outro mês, uma baixa, um lançamento), ele não troca
 * de repente: rola do valor antigo ao novo em 600ms, desacelerando. É o que
 * mostra ao olho QUAL número mudou. Na primeira pintura já nasce no valor
 * certo (nada de contar do zero a cada tela). Com movimento reduzido, troca
 * direto.
 */
export function useRolagem(alvo: number, duracao = 600): number {
  const reduzido = useMovimentoReduzido()
  const [exibido, setExibido] = useState(alvo)
  const atual = useRef(alvo)

  useEffect(() => {
    const de = atual.current
    if (reduzido || de === alvo) {
      atual.current = alvo
      setExibido(alvo)
      return
    }
    const inicio = performance.now()
    let raf = 0
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      const v = de + (alvo - de) * (1 - Math.pow(1 - t, 3))
      atual.current = t >= 1 ? alvo : v
      setExibido(t >= 1 ? alvo : Math.round(v * 100) / 100)
      if (t < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [alvo, duracao, reduzido])

  return exibido
}
