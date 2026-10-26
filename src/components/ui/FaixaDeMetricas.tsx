import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Valor, type EstadoValor } from './Valor'
import { cn } from '@/lib/utils'

/*
 * FAIXA DE MÉTRICAS (Souza 2.0, 23/10/2026).
 *
 * Os números de resumo de uma tela num painel só, lado a lado, separados por
 * fio vertical — não uma fileira de cartões soltos. Cada métrica: o nome, o
 * número grande, uma tendência discreta e uma nota de uma linha. Toda métrica
 * leva à tela que manda no número.
 *
 * Celular: duas por linha; tablet: três; computador: todas numa fileira.
 */

export interface Metrica {
  rotulo: string
  valor: number
  /** Quando não é dinheiro ("5 vendas", "12%"). */
  texto?: string
  estado?: EstadoValor
  tendencia?: { texto: string; tom: 'sucesso' | 'risco' | 'neutro' } | null
  nota?: ReactNode
  para?: string
  /** Abre algo nesta tela (a composição do número). */
  aoClicar?: () => void
}

export function FaixaDeMetricas({ metricas, rotuloAcessivel }: { metricas: Metrica[]; rotuloAcessivel: string }) {
  return (
    <section
      aria-label={rotuloAcessivel}
      data-caixa=""
      className={cn(
        // Fio de 1px entre as métricas: o vão da grade mostra a cor da linha por trás.
        'grid gap-px overflow-hidden rounded-caixa border border-fio-caixa bg-[color:var(--line-strong)] shadow-card',
        'grid-cols-2 md:grid-cols-3',
        metricas.length >= 5 ? 'xl:grid-cols-5' : metricas.length === 4 ? 'xl:grid-cols-4' : '',
      )}
    >
      {metricas.map((m, i) => {
        const conteudo = (
          <>
            <span className="truncate font-medium text-t4 text-texto-meta">{m.rotulo}</span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              {m.texto !== undefined ? (
                <span className="num whitespace-nowrap text-t1 text-numero-kpi-m xl:text-numero-kpi">{m.texto}</span>
              ) : (
                <Valor posto="kpi" valor={m.valor} estado={m.estado} />
              )}
              {m.tendencia && (
                <span
                  className={cn(
                    'num inline-flex h-5 items-center rounded-badge px-1.5 text-chip',
                    m.tendencia.tom === 'sucesso' && 'bg-success-bg text-success-ink',
                    m.tendencia.tom === 'risco' && 'bg-error-bg text-error-ink',
                    m.tendencia.tom === 'neutro' && 'bg-s3 text-t3',
                  )}
                >
                  {m.tendencia.texto}
                </span>
              )}
            </span>
            {m.nota && <span className="line-clamp-1 text-t4 text-nota">{m.nota}</span>}
          </>
        )
        const n = metricas.length
        const classes = cn(
          'flex min-w-0 flex-col gap-1.5 bg-surface px-5 py-4',
          // A última célula ocupa o resto da fileira quando a conta não fecha.
          i === n - 1 && n % 2 === 1 && 'max-md:col-span-2',
          i === n - 1 && n % 3 === 2 && 'md:max-xl:col-span-2',
          i === n - 1 && n % 3 === 1 && 'md:max-xl:col-span-3',
          (m.para || m.aoClicar) && 'text-left transition-colors duration-micro hover:bg-s2',
        )
        if (m.aoClicar && !m.para) {
          return (
            <button key={m.rotulo} type="button" onClick={m.aoClicar} className={classes}>
              {conteudo}
            </button>
          )
        }
        return m.para ? (
          <Link key={m.rotulo} to={m.para} className={classes}>
            {conteudo}
          </Link>
        ) : (
          <div key={m.rotulo} className={classes}>
            {conteudo}
          </div>
        )
      })}
    </section>
  )
}

/** "+12%", "−3%": a tendência em texto, com o sinal certo. */
export function textoDaVariacao(v: number | null): string | null {
  if (v == null || !Number.isFinite(v)) return null
  const pct = Math.round(v * 100)
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`
}
