import { useEffect, useState } from 'react'

/*
 * 7.13 — espera antes do esqueleto.
 *
 * `useAtraso(300, carregando)` fica `true` só depois de `carregando` estar
 * ligado por 300ms seguidos. Banco rápido não pisca esqueleto: antes disso a
 * tela reserva a altura vazia. Quando `ativo` desliga, volta a `false` na hora.
 */
export function useAtraso(ms: number, ativo = true): boolean {
  const [passou, setPassou] = useState(false)

  useEffect(() => {
    if (!ativo) {
      setPassou(false)
      return
    }
    const t = window.setTimeout(() => setPassou(true), ms)
    return () => window.clearTimeout(t)
  }, [ms, ativo])

  return ativo && passou
}
