import { Check, Minus } from 'lucide-react'
import { VOCABULARIO, type Situacao } from '@/lib/situacao'
import { cn } from '@/lib/utils'

/*
 * O SELO — o componente que traz a marca para dentro do dado.
 *
 * É a moldura do símbolo da Souza, a 24px, no raio medido de 23,5% (por isso
 * `rounded-marca`, que é percentual: um raio fixo viraria 39% a 36px e 22% a
 * 80px, e é exatamente por isso que a marca antiga não escalava). Dentro dele
 * vai o ORDINAL REAL da parcela — o "3" de 3/9.
 *
 * Isso funde duas informações num objeto de 24px que se varre sem ler: QUAL
 * parcela é, e o QUE o dinheiro é. Numa venda de 9 parcelas irregulares, é a
 * diferença entre procurar e reconhecer.
 *
 * O estado é dito por PREENCHIMENTO e PESO, não por traço tracejado de 1px —
 * tracejado de 1px é a primeira coisa que desaparece num celular a meio brilho
 * sob o sol, que é a condição real de uso do corretor. A escala de
 * preenchimento é semântica, não decorativa:
 *
 *   prevista  vazio ................. ainda não é dinheiro
 *   liberada  ouro ................... é dinheiro, esperando um humano
 *   vencida   ouro + anel vermelho ... é o mesmo dinheiro, esperando demais
 *   recebida  navy, ordinal invertido . o dinheiro se moveu
 *   cancelada vazio, riscado ......... registro risca, não apaga
 *
 * Em escala de cinza: vazio · médio · médio-com-anel · escuro · riscado.
 */

const fundos: Record<Situacao, string> = {
  prevista: 'border border-rule text-forecast-ink',
  liberada: 'bg-seal text-seal-ink',
  vencida: 'bg-seal text-seal-ink ring-2 ring-critical',
  recebida: 'bg-content text-papel',
  cancelada: 'border border-line text-content-faint line-through',
}

export function Selo({
  situacao,
  idx,
  count,
  /** Linhas sem ordinal — guia de imposto, despesa — usam o glifo substituto. */
  glifo,
  className,
}: {
  situacao: Situacao
  idx?: number | null
  count?: number | null
  glifo?: 'traco' | 'check'
  className?: string
}) {
  const v = VOCABULARIO[situacao]
  const temOrdinal = typeof idx === 'number' && typeof count === 'number' && count > 1
  return (
    <span
      className={cn(
        'cifra inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-marca text-xs font-semibold',
        fundos[situacao],
        className,
      )}
      // A informação já está escrita na palavra e na frase de tempo ao lado;
      // o selo é reforço visual e não deve ser lido duas vezes.
      aria-hidden
      title={`${v.palavra}${temOrdinal ? ` · parcela ${idx}/${count}` : ''}`}
    >
      {temOrdinal ? (
        idx
      ) : glifo === 'check' || situacao === 'recebida' ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      ) : (
        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
      )}
    </span>
  )
}

/**
 * O marcador solto — anel, disco, quadrado, check, riscado.
 *
 * Usado onde não há ordinal e o selo seria pesado (dentro de um chip, numa
 * legenda). Reconhecível por silhueta, sem depender de cor nenhuma.
 */
export function Marcador({ situacao }: { situacao: Situacao }) {
  const m = VOCABULARIO[situacao].marcador
  const base = 'inline-block h-2.5 w-2.5 shrink-0'
  if (m === 'anel') return <span className={cn(base, 'rounded-full border-[1.5px] border-current')} aria-hidden />
  if (m === 'disco') return <span className={cn(base, 'rounded-full bg-current')} aria-hidden />
  if (m === 'quadrado') return <span className={cn(base, 'bg-current')} aria-hidden />
  if (m === 'check') return <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
  return <span className={cn(base, 'rounded-full border-[1.5px] border-current opacity-60')} aria-hidden />
}
