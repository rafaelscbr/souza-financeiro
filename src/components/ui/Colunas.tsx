import { cn } from '@/lib/utils'
import type { Tom } from './tom'

/*
 * COLUNAS — uma série no tempo, em barras verticais.
 *
 * A casa já tinha a Barra (uma fração, ou segmentos empilhados numa linha).
 * O que faltava era comparar MESES entre si: doze valores lado a lado, onde a
 * leitura é a forma da série, não cada número.
 *
 * As regras são as mesmas da Barra: cor lisa, sem degradê, sem halo, e a
 * coluna é reforço — o número exato vem da folha que ela abre, e o mês está
 * escrito embaixo. Coluna vazia não some: ela vira um traço no chão, para o
 * mês sem venda continuar existindo na série.
 */

const COR: Record<Tom, string> = {
  marca: 'bg-brand-fill',
  sucesso: 'bg-success',
  atencao: 'bg-warning',
  risco: 'bg-error',
  info: 'bg-info',
  neutro: 'bg-t3',
}

export interface ItemColuna {
  /** O que vai escrito embaixo da coluna: "set", "out". */
  rotulo: string
  valor: number
  /** O texto do balão e do leitor de tela: "setembro de 2026 · R$ 12.000,00". */
  descricao: string
  /** O mês em foco na tela. */
  ativo?: boolean
}

export interface ColunasProps {
  itens: ItemColuna[]
  rotuloAcessivel: string
  tom?: Tom
  /** Toque na coluna: abre o que ela soma. */
  aoClicar?: (i: number) => void
  className?: string
}

export function Colunas({ itens, rotuloAcessivel, tom = 'marca', aoClicar, className }: ColunasProps) {
  const maior = itens.reduce((m, i) => (Number.isFinite(i.valor) && i.valor > m ? i.valor : m), 0)

  return (
    <div
      role="img"
      aria-label={rotuloAcessivel}
      className={cn('flex min-w-0 items-end gap-2 border-b border-fio-linha', className)}
    >
      {itens.map((item, i) => {
        const fracao = maior > 0 && item.valor > 0 ? item.valor / maior : 0
        const coluna = (
          <>
            <span className="flex h-32 w-full items-end">
              {fracao > 0 ? (
                <span
                  className={cn('w-full rounded-controle', COR[tom], !item.ativo && 'opacity-70')}
                  style={{ height: `${Math.max(fracao * 100, 2)}%` }}
                />
              ) : (
                <span className="h-px w-full bg-fio-caixa" />
              )}
            </span>
            <span
              className={cn(
                'w-full truncate pb-2 pt-2 text-center font-label text-rotulo',
                item.ativo ? 'text-t1' : 'text-t-meta',
              )}
            >
              {item.rotulo}
            </span>
          </>
        )
        const classes = 'flex min-w-0 flex-1 flex-col items-center'
        return aoClicar ? (
          <button
            key={item.rotulo + i}
            type="button"
            title={item.descricao}
            aria-label={item.descricao}
            onClick={() => aoClicar(i)}
            className={cn(classes, 'rounded-controle hover:bg-linha-hover')}
          >
            {coluna}
          </button>
        ) : (
          <span key={item.rotulo + i} title={item.descricao} className={classes}>
            {coluna}
          </span>
        )
      })}
    </div>
  )
}
