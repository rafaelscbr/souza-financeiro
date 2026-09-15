import { createContext, useContext } from 'react'
import { ValorComOrigem } from './Valor'
import { cn } from '@/lib/utils'

/*
 * PAR "agora · previsto" (7.3.4): dois números que NUNCA se somam, separados
 * pela palavra. `agora R$ 10.000,00 · previsto R$ 18.645,33`.
 *
 * O primeiro em valor-fato forte (t1, dinheiro que existe), o segundo em
 * valor-fato previsto (t2, nunca ouro). Os dois abrem a composição. Não existe
 * prop `total`: somar previsão com dinheiro é o erro que este componente impede.
 *
 * Forma (CSS em src/index.css, `[data-par-agora-previsto]`):
 *   - numa linha: `agora R$ … · previsto R$ …`, o "·" só entre dois lados;
 *   - com o contêiner < 30rem (celular): uma linha por lado, rótulo à esquerda
 *     e valor à direita, sem "·".
 *
 * Dentro de um LinhaGrupo (subtotal do mês) o par é resumo do grupo: o lado
 * com valor zero não aparece; se os dois forem zero, fica "previsto R$ 0,00".
 * No celular os lados encostam à direita, sob o rótulo do mês.
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

/** O LinhaGrupo avisa o par que ele é subtotal de grupo (esconde o lado zerado). */
export const ParNoGrupoContext = createContext(false)

export function ParAgoraPrevisto({ agora, previsto, className }: ParAgoraPrevistoProps) {
  const noGrupo = useContext(ParNoGrupoContext)
  const zero = (v: number) => Math.round(Math.abs(v) * 100) === 0
  const mostraAgora = !noGrupo || !zero(agora.valor)
  const mostraPrevisto = !noGrupo || !zero(previsto.valor) || !mostraAgora
  return (
    <span
      data-par-agora-previsto
      data-no-grupo={noGrupo ? '' : undefined}
      className={cn('text-t-meta', className)}
    >
      <span data-par-linha>
      {mostraAgora && (
        <span data-lado>
          <span className="font-label text-texto-meta">agora</span>
          <ValorComOrigem
            valor={agora.valor}
            posto="fato"
            forte
            aoAbrir={agora.aoAbrir}
            rotuloAcessivel={agora.rotuloAcessivel}
          />
        </span>
      )}
      {mostraPrevisto && (
        <span data-lado>
          <span className="font-label text-texto-meta">previsto</span>
          <ValorComOrigem
            valor={previsto.valor}
            posto="fato"
            previsto
            aoAbrir={previsto.aoAbrir}
            rotuloAcessivel={previsto.rotuloAcessivel}
          />
        </span>
      )}
      </span>
    </span>
  )
}
