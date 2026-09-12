import { type ReactNode } from 'react'
import { Rotulo, type Tom } from './Assinatura'
import { cn } from '@/lib/utils'

/**
 * A SEÇÃO — o card.
 *
 * Superfície com gradiente vertical curto, fio de 1px e realce de 1px no topo,
 * como os cards do CRM. O título é o rótulo em caixa alta com a barra
 * colorida, e a cor da barra diz o assunto antes de a pessoa ler.
 *
 * `variante="simples"` é para uso DENTRO de uma folha ou modal, onde um card
 * sobre um card só acrescenta moldura.
 */
export function Secao({
  titulo,
  tom = 'neutro',
  acao,
  /** Subtotal em DUAS parcelas, nunca uma. Ver `SubtotalDuplo`. */
  subtotal,
  children,
  className,
  variante = 'bloco',
}: {
  titulo?: string
  tom?: Tom
  acao?: ReactNode
  subtotal?: ReactNode
  children: ReactNode
  className?: string
  variante?: 'bloco' | 'simples'
}) {
  const bloco = variante === 'bloco'
  const temCabecalho = Boolean(titulo || acao || subtotal)
  return (
    <section
      className={cn(
        'first:mt-0',
        bloco ? 'superficie mt-4 overflow-hidden rounded-3xl border border-line' : 'mt-7',
        className,
      )}
    >
      {temCabecalho && (
        <header
          className={cn(
            'flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
            bloco ? 'border-b border-line px-4 py-3.5 sm:px-5' : 'mb-2 border-b border-line pb-2',
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {titulo && <Rotulo tom={tom}>{titulo}</Rotulo>}
            {subtotal}
          </div>
          {acao && <div className="shrink-0">{acao}</div>}
        </header>
      )}
      <div className={cn(bloco && 'px-4 py-2 sm:px-5 sm:py-3')}>{children}</div>
    </section>
  )
}

/**
 * O subtotal de grupo, SEMPRE em duas parcelas.
 *
 * Um total único somaria o que a imobiliária já tem com o que ela espera, que
 * é precisamente o erro que fazia o Início contar previsão como dívida.
 */
export function SubtotalDuplo({
  agora,
  previsto,
  rotuloAgora = 'agora',
}: {
  agora: ReactNode
  previsto: ReactNode
  rotuloAgora?: string
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-content-muted">
      <span>{rotuloAgora}</span>
      <span className="font-semibold text-content">{agora}</span>
      <span aria-hidden className="text-content-faint">
        ·
      </span>
      <span>previsto</span>
      <span>{previsto}</span>
    </p>
  )
}
