import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Icone } from './Icone'
import { Valor, type EstadoValor } from './Valor'
import { type Tom } from './tom'
import { cn } from '@/lib/utils'

/*
 * KPI (7.4). Substitui KpiCard.
 *
 * O tom colore o ÍCONE, nunca o número. Número colorido só com estado real,
 * que vem da tela (o componente mostra o que recebe). Sem contagem (8.4).
 * Hover: sobe 2px e acende a sombra `dropdown` por um ::after (opacidade,
 * 150ms); a borda não muda. Pressionar: scale(.98) em 100ms.
 * Abaixo de 768px a tela troca a grade por um `Cartao.Lista` (7.4).
 */

export interface KpiProps {
  rotulo: string
  /** Dinheiro (padrão) ou contagem/percentual já formatados pela tela. */
  valor: number
  icone: LucideIcon
  tom?: Tom
  /** Estado real do número; `negativo` só para negativo de verdade. */
  estado?: EstadoValor
  /** Quando o número não é dinheiro: o texto já formatado ("12 vendas", "6,0%"). */
  texto?: string
  nota?: ReactNode
  /** Souza 2.0: variação discreta ao lado do número ("+12%", "−R$ 3 mil"). */
  tendencia?: { texto: string; tom: 'sucesso' | 'risco' | 'neutro' }
  para?: string
  aoClicar?: () => void
  className?: string
}

export function Kpi({ rotulo, valor, icone: _icone, tom: _tom = 'neutro', estado, texto, nota, tendencia, para, aoClicar, className }: KpiProps) {
  const clicavel = Boolean(para || aoClicar)

  /*
   * Souza 2.0 (23/10/2026): o quadradinho de ícone colorido saiu — cor
   * competindo em cada indicador. Fica o rótulo, o número grande e a nota; a
   * cor só aparece no número quando é estado real (negativo, recebido) e na
   * tendência.
   */
  const conteudo = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-t4 text-texto-meta font-medium">{rotulo}</span>
        {clicavel && (
          <span className="flex text-t5 transition-colors group-hover:text-t3">
            <Icone icone={ChevronRight} tamanho={16} />
          </span>
        )}
      </span>
      <span className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        {texto !== undefined ? (
          <span className="num whitespace-nowrap text-t1 text-numero-kpi-m lg:text-numero-kpi">{texto}</span>
        ) : (
          <Valor posto="kpi" valor={valor} estado={estado} />
        )}
        {tendencia && (
          <span
            className={cn(
              'num inline-flex h-5 items-center rounded-badge px-1.5 text-chip',
              tendencia.tom === 'sucesso' && 'bg-success-bg text-success-ink',
              tendencia.tom === 'risco' && 'bg-error-bg text-error-ink',
              tendencia.tom === 'neutro' && 'bg-s3 text-t3',
            )}
          >
            {tendencia.texto}
          </span>
        )}
      </span>
      {nota && <span className="mt-1 line-clamp-2 text-t4 text-nota">{nota}</span>}
    </>
  )

  const classes = cn(
    'relative flex min-w-0 flex-col rounded-caixa border border-fio-caixa bg-surface px-5 py-4 text-left shadow-card',
    clicavel &&
      'group cursor-pointer transition-colors duration-micro hover:border-[color:var(--line-input)] hover:bg-s2 active:bg-s3',
    className,
  )

  if (para) {
    return (
      <Link to={para} onClick={aoClicar} data-caixa="" data-kpi="" data-clicavel="" className={classes}>
        {conteudo}
      </Link>
    )
  }
  if (aoClicar) {
    return (
      <button type="button" onClick={aoClicar} data-caixa="" data-kpi="" data-clicavel="" className={cn(classes, 'w-full')}>
        {conteudo}
      </button>
    )
  }
  return (
    <div data-caixa="" data-kpi="" className={classes}>
      {conteudo}
    </div>
  )
}
Kpi.displayName = 'Kpi'
