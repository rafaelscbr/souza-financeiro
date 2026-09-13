import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useSuperficie, type Superficie } from './Painel'
import { cn } from '@/lib/utils'

/*
 * A LISTA (seção 9).
 *
 * O ofício aqui é conferir parcela contra extrato e contrato. Extrato tem
 * rótulo à esquerda, valor à direita e um fio entre linhas; por isso o valor
 * tem coluna própria, tabular e alinhada à direita, e as 16 parcelas de
 * R$ 201,61 a R$ 2.692,89 se comparam por contagem de dígitos, não por leitura.
 *
 * A Lista sabe onde está (ver SuperficieContext em Painel.tsx): solta na página
 * ela é o objeto e desenha a `list-surface`; dentro de um painel ela é só
 * linhas, porque caixa dentro de caixa é o que a seção 5 proíbe.
 *
 * `stagger-children` faz as linhas entrarem em escada uma vez, na montagem.
 */
const CONTAINER: Record<Superficie, string> = {
  solta: 'list-surface overflow-hidden rounded-xl border border-line',
  painel: '',
  // O corpo da Secao tem px-4/sm:px-5 e pb-3: a lista devolve essa margem
  // para o hover e o fio irem de borda a borda do painel.
  sangria: '-mx-4 first:border-t first:border-line last:-mb-3 sm:-mx-5',
  plano: '-mx-2',
}

const RECUO: Record<Superficie, string> = {
  solta: 'px-4 sm:px-5',
  painel: 'px-4 sm:px-5',
  sangria: 'px-4 sm:px-5',
  plano: 'px-2',
}

export function Lista({ children, className }: { children: ReactNode; className?: string }) {
  const superficie = useSuperficie()
  return <ul className={cn('stagger-children', CONTAINER[superficie], className)}>{children}</ul>
}

interface LinhaProps {
  /** O selo com o ordinal da parcela, na goteira esquerda. */
  selo?: ReactNode
  titulo: ReactNode
  /** Contexto: a frase de tempo, o empreendimento, "base × %". Texto, não pílula. */
  meta?: ReactNode
  situacao?: ReactNode
  /** O valor. Pousa sempre na mesma borda direita. */
  valor?: ReactNode
  /** Ação inline — "Pagar", "Recebi", "Dar baixa". */
  acao?: ReactNode
  para?: string
  aoClicar?: () => void
  /** Lava do ouro para transparente, uma vez, depois de uma baixa confirmada. */
  recibo?: boolean
  className?: string
}

export function Linha({
  selo,
  titulo,
  meta,
  situacao,
  valor,
  acao,
  para,
  aoClicar,
  recibo,
  className,
}: LinhaProps) {
  const superficie = useSuperficie()
  const clicavel = Boolean(para || aoClicar)

  const conteudo = (
    <>
      {selo && <span className="flex w-7 shrink-0 justify-center">{selo}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-t1">{titulo}</span>
        {meta && <span className="text-xs text-t3">{meta}</span>}
        {/* No celular a situação fica sob o texto; no computador vira coluna. */}
        {situacao && <span className="mt-1 sm:hidden">{situacao}</span>}
      </span>
      {situacao && <span className="hidden shrink-0 sm:block">{situacao}</span>}
      {valor && <span className="shrink-0 text-right tabular-nums">{valor}</span>}
      {clicavel && !acao && (
        <ChevronRight
          size={16}
          strokeWidth={1.6}
          className="shrink-0 text-t5 transition-colors group-hover:text-t3"
          aria-hidden
        />
      )}
    </>
  )

  // `lista-linha` é o gancho da densidade: html.compacta reduz só o py.
  const classes = cn(
    'lista-linha flex w-full min-w-0 items-center gap-3 py-3.5 text-left sm:gap-4',
    RECUO[superficie],
    acao && 'flex-1',
    className,
  )

  return (
    <li
      className={cn(
        'group relative border-b border-line last:border-0',
        clicavel && 'transition-colors hover:bg-s3/50',
        acao && 'flex items-center',
        recibo && 'animate-recibo',
      )}
    >
      {para ? (
        <Link to={para} className={classes}>
          {conteudo}
        </Link>
      ) : aoClicar ? (
        <button type="button" onClick={aoClicar} className={classes}>
          {conteudo}
        </button>
      ) : (
        <div className={classes}>{conteudo}</div>
      )}
      {acao && (
        /*
         * Ações numa faixa à direita, visíveis no hover e no foco (seção 9).
         * Só esconde onde existe hover de verdade: em tela de toque não há
         * como "passar o mouse", e a ação precisa estar a um toque.
         */
        <div
          className={cn(
            'shrink-0 transition-opacity',
            superficie === 'plano' ? 'pr-2' : 'pr-4 sm:pr-5',
            '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
          )}
        >
          {acao}
        </div>
      )}
    </li>
  )
}

/**
 * A LINHA DE HOJE.
 *
 * Um fio atravessando a lista de parcelas, com a palavra HOJE: cheio acima,
 * tracejado abaixo. Acima é fato, abaixo é promessa.
 *
 * Isto não é ornamento — é a regra de negócio virando impossibilidade
 * geométrica. Nenhum total consegue abraçar os dois lados sem atravessar
 * visivelmente o marco, então "a pagar no mês" não pode voltar a somar
 * previsão com dívida: não há onde pôr esse número.
 */
export function LinhaDeHoje({ rotulo = 'hoje' }: { rotulo?: string }) {
  const superficie = useSuperficie()
  return (
    <li className={cn('flex items-center gap-2 border-b border-line py-2', RECUO[superficie])} aria-hidden>
      <span className="h-px flex-1 bg-line-strong" />
      <span className="font-label text-[11px] uppercase tracking-[0.14em] text-t4">{rotulo}</span>
      <span className="h-px flex-1 border-t border-dashed border-line-strong" />
    </li>
  )
}
