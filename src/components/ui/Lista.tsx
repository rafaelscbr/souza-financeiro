import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * A LISTA — a estrutura que substituiu a grade de cartões.
 *
 * O ofício aqui é conferir parcela contra extrato bancário e contrato. Extrato
 * tem rótulo à esquerda, valor à direita, um fio entre linhas e nenhuma
 * decoração. Por isso listas separadas por fio, e por isso uma única borda
 * direita onde todo dinheiro se alinha: as 16 parcelas de R$ 201,61 a
 * R$ 2.692,89 passam a ser comparadas por contagem de dígitos, não por leitura.
 *
 * A grade de quatro indicadores morre aqui. Um número em herói; o resto em
 * linhas.
 */
export function Lista({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('divide-y divide-line', className)}>{children}</ul>
}

interface LinhaProps {
  /** O selo com o ordinal da parcela, na goteira esquerda. */
  selo?: ReactNode
  titulo: ReactNode
  /** Metadado: a frase de tempo, o empreendimento, "base × %". */
  meta?: ReactNode
  situacao?: ReactNode
  /** O valor. Pousa sempre na mesma borda direita. */
  valor?: ReactNode
  /** Ação inline — "Pagar", "Recebi", "Dar baixa". Sem três toques extras. */
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
  const conteudo = (
    <>
      {selo && <span className="flex w-6 shrink-0 justify-center pt-0.5">{selo}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base font-medium text-content">{titulo}</span>
        {meta && <span className="text-sm text-content-faint">{meta}</span>}
        {/* No celular a situação fica sob o texto; no computador vira coluna. */}
        {situacao && <span className="mt-0.5 sm:hidden">{situacao}</span>}
      </span>
      {situacao && <span className="hidden shrink-0 sm:block">{situacao}</span>}
      {valor && <span className="shrink-0 text-right">{valor}</span>}
      {(para || aoClicar) && !acao && (
        <ChevronRight className="h-4 w-4 shrink-0 text-content-faint" aria-hidden />
      )}
    </>
  )

  const classes = cn(
    'flex min-h-[3.5rem] w-full items-center gap-3 py-2.5 text-left',
    (para || aoClicar) && 'transition-colors hover:bg-action-soft',
    recibo && 'animate-recibo',
    className,
  )

  return (
    <li className={cn('relative', acao && 'flex items-center gap-2')}>
      {para ? (
        <Link to={para} className={cn(classes, acao && 'flex-1')}>
          {conteudo}
        </Link>
      ) : aoClicar ? (
        <button type="button" onClick={aoClicar} className={cn(classes, acao && 'flex-1')}>
          {conteudo}
        </button>
      ) : (
        <div className={cn(classes, acao && 'flex-1')}>{conteudo}</div>
      )}
      {acao && <div className="shrink-0">{acao}</div>}
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
  return (
    <li className="relative flex items-center gap-2 py-2" aria-hidden>
      <span className="h-px flex-1 bg-rule" />
      <span className="cifra text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">
        {rotulo}
      </span>
      <span className="h-px flex-1 border-t border-dashed border-rule bg-transparent" />
    </li>
  )
}
