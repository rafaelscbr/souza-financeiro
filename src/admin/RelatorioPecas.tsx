import { Fragment } from 'react'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import type { TipoPeriodo } from '@/lib/dre'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * As peças comuns aos relatórios (DRE e Fluxo de caixa): o filtro de período
 * e a conta escrita de cima para baixo. Os dois relatórios se leem do mesmo
 * jeito — quem aprendeu um, lê o outro.
 */

export function FiltrosDePeriodo({ ativo, aoMudar }: { ativo: TipoPeriodo; aoMudar: (t: TipoPeriodo) => void }) {
  return (
    <FiltrosRapidos
      rotuloAcessivel="Período"
      ativo={ativo}
      aoMudar={aoMudar}
      filtros={[
        { id: 'mes', rotulo: 'Mês' },
        { id: 'trimestre', rotulo: 'Trimestre' },
        { id: 'ano', rotulo: 'Ano' },
        { id: 'acumulado', rotulo: 'No ano até aqui', dica: 'De janeiro até o mês escolhido.' },
      ]}
    />
  )
}

/**
 * A variação contra o período anterior, em palavras. Resultado e saldo se
 * comparam com sinal (de +6.500 para −4.000 "virou negativo", nunca "caiu
 * 39%"); custo se compara pelo tamanho (despesa de 5 mil para 7 mil "subiu").
 */
export function variacaoEmPalavras(agora: number, antes: number, custo = false): string {
  if (antes === 0) return agora === 0 ? 'igual' : 'não havia no período anterior'
  if (!custo && antes > 0 && agora < 0) return 'virou negativo'
  if (!custo && antes < 0 && agora >= 0) return 'virou positivo'
  const v = custo ? (Math.abs(agora) - Math.abs(antes)) / Math.abs(antes) : (agora - antes) / Math.abs(antes)
  if (Math.abs(v) < 0.005) return 'igual'
  return `${v > 0 ? 'subiu' : 'caiu'} ${formatPercent(Math.abs(v), 0)}`
}

/** O mínimo que uma linha precisa para entrar na conta. */
export interface LinhaDaConta {
  id: string
  rotulo: string
  /** `conta` recua; `subtotal` e `resultado` ganham fio acima e peso. */
  tipo: 'grupo' | 'conta' | 'subtotal' | 'resultado'
  valor: number
}

/**
 * A conta de cima para baixo. Linha principal com a frase do que ela é;
 * conta aberta recuada; total com fio acima. Com `base`, a coluna do meio
 * diz quanto a linha pesa nela (no DRE, o faturamento). Valor zero não abre:
 * botão que abre folha vazia é promessa quebrada.
 */
export function ContaDoRelatorio<L extends LinhaDaConta>({
  linhas,
  base,
  emPalavras,
  aoAbrir,
  rotuloAcessivel,
}: {
  linhas: L[]
  base?: number
  emPalavras: Record<string, string>
  aoAbrir: (l: L) => void
  rotuloAcessivel: string
}) {
  const comBase = base !== undefined
  return (
    <dl
      aria-label={rotuloAcessivel}
      className={cn(
        'grid min-w-0 items-center gap-x-4',
        comBase ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      {linhas.map((l, i) => {
        const total = l.tipo === 'subtotal' || l.tipo === 'resultado'
        const conta = l.tipo === 'conta'
        const nome = l.rotulo.replace('(−) ', '').replace('(+) ', '')
        return (
          <Fragment key={l.id}>
            {total && i > 0 && (
              <hr aria-hidden className={cn('my-1 border-0 border-t border-fio-caixa', comBase ? 'col-span-3' : 'col-span-2')} />
            )}
            <dt className={cn('flex min-w-0 flex-col py-2', conta && 'pl-5')}>
              <span className={cn(conta ? 'text-texto text-t2' : 'text-texto-titulo text-t1', total && 'font-semibold')}>
                {l.rotulo}
              </span>
              {emPalavras[l.id] && <span className="text-texto-meta text-t-meta">{emPalavras[l.id]}</span>}
            </dt>
            {comBase && (
              <dd className="text-right text-texto-meta text-t-meta tabular-nums">
                {base > 0 && l.valor !== 0 ? formatPercent(Math.abs(l.valor) / base, 0) : ''}
              </dd>
            )}
            <dd className="flex justify-end">
              {l.valor === 0 ? (
                <Valor valor={0} posto="linha" forte={total} />
              ) : (
                <ValorComOrigem
                  valor={l.valor}
                  posto={l.tipo === 'resultado' ? 'destaque' : 'linha'}
                  forte={total}
                  estado={l.valor < 0 ? 'negativo' : undefined}
                  rotuloAcessivel={`Ver os lançamentos de ${nome}`}
                  aoAbrir={() => aoAbrir(l)}
                />
              )}
            </dd>
          </Fragment>
        )
      })}
    </dl>
  )
}
