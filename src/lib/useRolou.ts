import { useEffect, useRef, useState } from 'react'

/*
 * 4.2 — o fio do cabeçalho.
 *
 * Um sentinela de 1px no topo do <main> é observado por IntersectionObserver.
 * Quando ele passa por baixo do cabeçalho, `rolou` vira `true` e a casca põe
 * `data-rolou` no `.cabecalho` (o fio mora no `::after`: a altura nunca muda).
 * Sem listener de scroll, sem layout por quadro.
 *
 *   const [sentinela, rolou] = useRolou()
 *   <header className="cabecalho" data-rolou={rolou || undefined}>…
 *   <main><div ref={sentinela} aria-hidden className="h-px" />…
 */
function alturaDoCabecalho(): number {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue('--altura-cabecalho')
  const px = parseFloat(bruto)
  return Number.isFinite(px) ? px : 56
}

export function useRolou<T extends Element = HTMLDivElement>() {
  const sentinela = useRef<T>(null)
  const [rolou, setRolou] = useState(false)

  useEffect(() => {
    const alvo = sentinela.current
    if (!alvo || typeof IntersectionObserver === 'undefined') return
    let observador: IntersectionObserver | null = null

    const observar = () => {
      observador?.disconnect()
      observador = new IntersectionObserver(
        ([e]) => setRolou(!e.isIntersecting),
        { rootMargin: `-${alturaDoCabecalho()}px 0px 0px 0px`, threshold: 0 },
      )
      observador.observe(alvo)
    }
    observar()
    // A altura do cabeçalho muda em 1024 (56 → 64): refaz a margem.
    const m = window.matchMedia('(min-width: 1024px)')
    m.addEventListener('change', observar)
    return () => {
      m.removeEventListener('change', observar)
      observador?.disconnect()
    }
  }, [])

  return [sentinela, rolou] as const
}
