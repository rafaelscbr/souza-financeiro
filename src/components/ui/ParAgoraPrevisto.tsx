import { ValorComOrigem } from './Valor'
import { cn } from '@/lib/utils'

/*
 * PAR "agora · previsto" (7.3.4): dois números que NUNCA se somam, separados
 * pela palavra. `agora R$ 10.000,00 · previsto R$ 18.645,33`.
 *
 * O primeiro em valor-fato (dinheiro que existe), o segundo em valor-fato
 * previsto (t2, nunca ouro). PENDENTE: 7.3.4 pede o primeiro em t1, e o
 * Valor ainda não tem forma de pôr posto="fato" em t1 sem a prop DEPRECADA
 * `tinta` (pedido ao dono de Valor.tsx). Os dois abrem a composição. Não existe prop
 * `total`: somar previsão com dinheiro é o erro que este componente impede.
 */
export interface LadoDoPar {
  valor: number
  aoAbrir: () => void
  rotuloAcessivel: string
}

export interface ParAgoraPrevistoProps {
  agora: LadoDoPar
  previsto: LadoDoPar
  className?: string
  total?: never
}

export function ParAgoraPrevisto({ agora, previsto, className }: ParAgoraPrevistoProps) {
  return (
    <span
      data-par-agora-previsto
      className={cn('inline-flex flex-wrap items-center justify-end gap-x-2 text-t-meta', className)}
    >
      <span className="inline-flex items-center gap-1">
        <span className="font-label text-texto-meta">agora</span>
        <ValorComOrigem
          valor={agora.valor}
          posto="fato"
          forte
          aoAbrir={agora.aoAbrir}
          rotuloAcessivel={agora.rotuloAcessivel}
        />
      </span>
      <span aria-hidden className="text-texto-meta text-t5">
        ·
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="font-label text-texto-meta">previsto</span>
        <ValorComOrigem
          valor={previsto.valor}
          posto="fato"
          previsto
          aoAbrir={previsto.aoAbrir}
          rotuloAcessivel={previsto.rotuloAcessivel}
        />
      </span>
    </span>
  )
}
