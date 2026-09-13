import { useEffect, useState } from 'react'
import { TOM, type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * A barra de progresso (seções 5, 7 e 8).
 *
 * Trilho `bg-s3` de 6px. Só o tom `marca` ganha o degradê de ouro com halo
 * (`barra-marca`), porque ouro é dinheiro e meta; qualquer outro tom é chapado
 * na cor dele, sem halo, para não disputar com o único bloco dourado da tela.
 *
 * Nasce com largura 0 e transiciona até o valor em 520ms. A transição é de
 * largura porque é assim que o guia descreve a barra; com
 * prefers-reduced-motion o index.css zera a duração e ela aparece pronta.
 * O trilho não corta o conteúdo: `overflow-hidden` apagaria o halo.
 */
export function Barra({
  valor,
  tom = 'marca',
  rotuloAcessivel,
  className,
}: {
  /** Fração de 0 a 1. Fora disso é cortado, a barra nunca vaza do trilho. */
  valor: number
  tom?: Tom
  rotuloAcessivel: string
  className?: string
}) {
  const alvo = Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0
  const [largura, setLargura] = useState(0)

  useEffect(() => {
    // Um quadro de atraso para o navegador pintar a largura 0 antes de
    // transicionar; sem isso a barra já nasce cheia.
    const raf = requestAnimationFrame(() => setLargura(alvo))
    return () => cancelAnimationFrame(raf)
  }, [alvo])

  const pct = Math.round(alvo * 100)
  return (
    <div
      role="progressbar"
      aria-label={rotuloAcessivel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      className={cn('h-1.5 w-full rounded-full bg-s3', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          tom === 'marca' && 'barra-marca',
        )}
        style={{
          width: `${largura * 100}%`,
          backgroundColor: tom === 'marca' ? undefined : TOM[tom].solido,
        }}
      />
    </div>
  )
}
