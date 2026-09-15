import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Icone } from './Icone'
import { IconeTom } from './IconeTom'
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
  para?: string
  aoClicar?: () => void
  className?: string
}

export function Kpi({ rotulo, valor, icone, tom = 'neutro', estado, texto, nota, para, aoClicar, className }: KpiProps) {
  const clicavel = Boolean(para || aoClicar)

  const conteudo = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <IconeTom icone={icone} tom={tom} tamanho="sm" />
        <span className="min-w-0 flex-1 truncate font-label uppercase text-t-meta text-rotulo">{rotulo}</span>
        {clicavel && (
          <span className="flex text-t3">
            <Icone icone={ChevronRight} tamanho={16} />
          </span>
        )}
      </span>
      <span className="mt-3 flex min-w-0">
        {texto !== undefined ? (
          <span className="num whitespace-nowrap font-heading text-t1 text-numero-kpi-m lg:text-numero-kpi">{texto}</span>
        ) : (
          <Valor posto="kpi" valor={valor} estado={estado} />
        )}
      </span>
      {nota && <span className="mt-1 line-clamp-2 text-t-meta text-nota">{nota}</span>}
    </>
  )

  const classes = cn(
    'relative flex min-w-0 flex-col rounded-caixa border border-fio-caixa bg-surface p-recuo text-left shadow-card',
    clicavel &&
      'group cursor-pointer transition-transform duration-micro ease-entra after:pointer-events-none after:absolute after:inset-0 after:rounded-caixa after:opacity-0 after:shadow-dropdown after:transition-opacity after:duration-micro hover:-translate-y-0.5 hover:after:opacity-100 active:scale-[.98] active:duration-toque',
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
