import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Valor, type EstadoValor } from './Valor'
import { cn } from '@/lib/utils'
import { useRolagem } from '@/lib/useRolagem'

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
  /** Souza 3.0: o número que responde a tela; maior, em negrito, coluna mais larga. */
  lider?: boolean
}

/*
 * SOUZA 3.0: um painel, fio de 1px entre as células, número que ROLA quando
 * muda (useRolagem). A célula líder (o saldo) é maior e mais larga; as
 * outras ficam do mesmo tamanho entre si. A tendência é texto colorido, sem
 * pílula: verde bom, vermelho ruim, cinza quando não há o que comparar.
 */
function NumeroDaMetrica({ m }: { m: Metrica }) {
  const v = useRolagem(m.valor)
  if (m.texto !== undefined)
    return <span className="num whitespace-nowrap text-t1 text-numero-kpi-m xl:text-numero-kpi">{m.texto}</span>
  return <Valor posto={m.lider ? 'lider' : 'kpi'} valor={v} estado={m.estado} />
}

export function FaixaDeMetricas({ metricas, rotuloAcessivel }: { metricas: Metrica[]; rotuloAcessivel: string }) {
  const temLider = metricas.some((m) => m.lider)
  const n = metricas.length
  return (
    <section
      aria-label={rotuloAcessivel}
      data-caixa=""
      style={
        temLider
          ? ({ '--colunas-faixa': metricas.map((m) => (m.lider ? '1.35fr' : '1fr')).join(' ') } as CSSProperties)
          : undefined
      }
      className={cn(
        // Fio de 1px entre as métricas: o vão da grade mostra a cor da linha por trás.
        'grid gap-px overflow-hidden rounded-caixa border border-fio-caixa bg-[color:var(--line)]',
        'grid-cols-2 md:grid-cols-3',
        temLider
          ? 'xl:[grid-template-columns:var(--colunas-faixa)]'
          : n >= 5
            ? 'xl:grid-cols-5'
            : n === 4
              ? 'xl:grid-cols-4'
              : '',
      )}
    >
      {metricas.map((m, i) => {
        const conteudo = (
          <>
            <span className="truncate text-t4 text-texto-meta">{m.rotulo}</span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <NumeroDaMetrica m={m} />
            </span>
            {(m.nota || m.tendencia) && (
              <span className="line-clamp-3 text-t4 text-texto-meta">
                {m.tendencia && (
                  <span
                    className={cn(
                      'num me-1.5 font-medium',
                      m.tendencia.tom === 'sucesso' && 'text-success-ink',
                      m.tendencia.tom === 'risco' && 'text-error-ink',
                      m.tendencia.tom === 'neutro' && 'text-t4',
                    )}
                  >
                    {m.tendencia.texto}
                  </span>
                )}
                {m.nota}
              </span>
            )}
          </>
        )
        const classes = cn(
          'flex min-w-0 flex-col gap-1.5 bg-surface px-recuo py-5',
          m.lider && 'max-md:col-span-2 md:max-xl:col-span-3',
          // A última célula ocupa o resto da fileira quando a conta não fecha.
          !temLider && i === n - 1 && n % 2 === 1 && 'max-md:col-span-2',
          !temLider && i === n - 1 && n % 3 === 2 && 'md:max-xl:col-span-2',
          !temLider && i === n - 1 && n % 3 === 1 && 'md:max-xl:col-span-3',
          temLider && i === n - 1 && (n - 1) % 2 === 1 && 'max-md:col-span-2',
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
