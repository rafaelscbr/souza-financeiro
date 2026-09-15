import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Tom } from './tom'

/*
 * A BARRA (7.5, 8.3, 8.4). Uma só primitiva para progresso e para trilha.
 *
 * Trilho `bg-s3` de 6px, `rounded-full`, cor lisa: sem degradê, sem halo.
 * Uma fração (`valor` + `tom`) ou segmentos empilhados (`segmentos`, a antiga
 * Trilha: recebido · liberado · previsto). A barra é reforço, nunca a única
 * fonte: o número vem escrito ao lado pela tela.
 *
 * Movimento (8.3): na 1ª exibição o preenchimento enche com `barraEnche` 520ms
 * em `scaleX` a partir da esquerda (`.barra-preenchimento[data-primeira]`, que
 * só anima debaixo de `html.animar`). A largura de cada segmento é estática:
 * valor novo (troca de mês, refetch, gravação) troca SEM transição, como os
 * números (8.4). Com movimento reduzido `.animar` não existe e a barra já nasce
 * cheia. O trilho não usa `overflow-hidden`: nada vaza porque as frações são
 * cortadas em [0, 1].
 */

const COR: Record<Tom, string> = {
  marca: 'bg-brand-fill',
  sucesso: 'bg-success',
  atencao: 'bg-warning',
  risco: 'bg-error',
  info: 'bg-info',
  neutro: 'bg-t3',
}

export interface SegmentoBarra {
  /** Valor absoluto (qualquer unidade); a barra calcula a proporção. */
  valor: number
  tom: Tom
}

type BarraProps = {
  /** Nome acessível. Na barra de segmentos, diga os valores por extenso. */
  rotuloAcessivel: string
  className?: string
  /** `false` quando a tela remonta a barra por troca de dado (8.4). Padrão `true`. */
  animarEntrada?: boolean
} & (
  | { /** Fração de 0 a 1, cortada nesse intervalo. */ valor: number; tom?: Tom; segmentos?: never }
  | { segmentos: SegmentoBarra[]; valor?: never; tom?: never }
)

const fracao = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/** `data-primeira` fica só o tempo da 1ª exibição (520ms + folga). */
function usePrimeiraExibicao(ativo: boolean): boolean {
  const [primeira, setPrimeira] = useState(ativo)
  useEffect(() => {
    if (!primeira) return
    const t = window.setTimeout(() => setPrimeira(false), 600)
    return () => window.clearTimeout(t)
  }, [primeira])
  return primeira
}

export function Barra(props: BarraProps) {
  const { rotuloAcessivel, className, animarEntrada = true } = props
  const primeira = usePrimeiraExibicao(animarEntrada)

  const segmentado = props.segmentos !== undefined
  const partes: { largura: number; tom: Tom }[] = segmentado
    ? (() => {
        const validos = props.segmentos!.filter((s) => Number.isFinite(s.valor) && s.valor > 0)
        const total = validos.reduce((soma, s) => soma + s.valor, 0)
        return total > 0 ? validos.map((s) => ({ largura: s.valor / total, tom: s.tom })) : []
      })()
    : [{ largura: fracao(props.valor as number), tom: props.tom ?? 'marca' }]

  const pct = segmentado ? 0 : Math.round(fracao(props.valor as number) * 100)
  const papel = segmentado
    ? ({ role: 'img', 'aria-label': rotuloAcessivel } as const)
    : ({
        role: 'progressbar',
        'aria-label': rotuloAcessivel,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': pct,
        'aria-valuetext': `${pct}%`,
      } as const)

  return (
    <div {...papel} data-barra className={cn('h-1.5 w-full rounded-full bg-s3', className)}>
      <div
        className="barra-preenchimento flex h-full w-full gap-px"
        data-primeira={primeira ? '' : undefined}
        aria-hidden
      >
        {partes.map((p, i) =>
          p.largura > 0 ? (
            <span key={i} className={cn('h-full rounded-full', COR[p.tom])} style={{ width: `${p.largura * 100}%` }} />
          ) : null,
        )}
      </div>
    </div>
  )
}

/**
 * A legenda de uma barra de segmentos. Uma linha, uma vez por tela: quem troca
 * número por cor ensina a cor uma vez.
 */
export function LegendaBarra({ itens, className }: { itens: { tom: Tom; rotulo: string }[]; className?: string }) {
  return (
    <p data-barra className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-nota text-t-meta', className)}>
      {itens.map((it) => (
        <span key={it.rotulo} className="inline-flex items-center gap-2">
          <span className={cn('h-1.5 w-4 rounded-full', COR[it.tom])} aria-hidden />
          {it.rotulo}
        </span>
      ))}
    </p>
  )
}

/*
 * A trilha da comissão, pronta: recebido (verde) · liberado, a pagar (âmbar) ·
 * depende da construtora (azul-petróleo). Nenhum segmento é ouro: não mede meta.
 * Previsão é informação, nunca dívida.
 */
export function BarraTrilha({
  recebido,
  liberado,
  previsto,
  rotuloAcessivel,
  className,
}: {
  recebido: number
  liberado: number
  previsto: number
  rotuloAcessivel?: string
  className?: string
}) {
  return (
    <Barra
      className={className}
      rotuloAcessivel={
        rotuloAcessivel ??
        `recebido ${formatCurrency(recebido)}, liberado ${formatCurrency(liberado)}, previsto ${formatCurrency(previsto)}`
      }
      segmentos={[
        { valor: recebido, tom: 'sucesso' },
        { valor: liberado, tom: 'atencao' },
        { valor: previsto, tom: 'info' },
      ]}
    />
  )
}

export function LegendaTrilha({ className }: { className?: string }) {
  return (
    <LegendaBarra
      className={className}
      itens={[
        { tom: 'sucesso', rotulo: 'recebido' },
        { tom: 'atencao', rotulo: 'liberado, a pagar' },
        { tom: 'info', rotulo: 'depende da construtora' },
      ]}
    />
  )
}
