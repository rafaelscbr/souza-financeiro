import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react'
import { useMovimentoReduzido } from './useMovimentoReduzido'

/*
 * 8.3 — "Fechar painel": o que entra também sai.
 *
 * Substitui `{aberto && …}`. Enquanto `aberto` é `true` o elemento fica montado
 * com `data-estado="entrando"` (a entrada é `backwards`, então nada fica
 * aplicado depois). Quando `aberto` vira `false`, continua montado com
 * `data-estado="saindo"` e desmonta no `animationend` da própria saída; se o
 * evento não vier (aba congelada, animação cortada), um timeout de garantia
 * desmonta em `saida + 40` ms (220 para a saída padrão de 180). Com movimento
 * reduzido desmonta em 0ms. Vale para SidePanel, ConfirmDialog, Toast, Tip,
 * popovers e paleta.
 *
 *   const p = usePresenca(aberto)
 *   {p.montado && createPortal(
 *     <div className="painel" {...p.props}>…</div>, document.body)}
 */
export type EstadoPresenca = 'entrando' | 'saindo'

export interface Presenca {
  /** Renderize só com `montado`. */
  montado: boolean
  estado: EstadoPresenca
  /** Espalhe no elemento que anima (o que tem `.painel`, `.veu`, `.modal`…). */
  props: {
    'data-estado': EstadoPresenca
    onAnimationEnd: (e: AnimationEvent<Element>) => void
  }
}

export function usePresenca(aberto: boolean, saida = 180): Presenca {
  const reduzido = useMovimentoReduzido()
  const [montado, setMontado] = useState(aberto)
  const abertoRef = useRef(aberto)
  abertoRef.current = aberto

  useEffect(() => {
    if (aberto) {
      setMontado(true)
      return
    }
    if (reduzido) {
      setMontado(false)
      return
    }
    const garantia = window.setTimeout(() => setMontado(false), saida + 40)
    return () => window.clearTimeout(garantia)
  }, [aberto, reduzido, saida])

  const onAnimationEnd = useCallback((e: AnimationEvent<Element>) => {
    // Só a animação do próprio elemento conta: a de um filho borbulha até aqui.
    if (e.target !== e.currentTarget) return
    if (!abertoRef.current) setMontado(false)
  }, [])

  const estado: EstadoPresenca = aberto ? 'entrando' : 'saindo'
  return {
    montado: aberto || montado,
    estado,
    props: { 'data-estado': estado, onAnimationEnd },
  }
}
