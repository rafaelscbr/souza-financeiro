import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * A ASSINATURA — identidade e arquitetura resolvidas com o mesmo gesto.
 *
 * No logotipo, o ouro aparece exatamente UMA vez: um disco de 11px no fim de
 * "IMOBILIÁRIA". São 89 pixels em 60.634 — 0,15% de toda a tinta da marca.
 *
 * A interface reproduz essa construção literalmente: cada tela tem UM rótulo
 * em slab de 12px, caixa alta, entreletrado, seguido de um disco de ouro; e
 * diretamente abaixo dele, em nenhum outro lugar, o único número em degrau
 * herói da tela. Um por tela. Nunca dois.
 *
 * O ganho não é estético. É que a regra "um ponto de ouro por tela" é a MESMA
 * regra que proíbe uma tela de exibir três valores concorrentes: se só um
 * número pode ser herói, a tela é obrigada a declarar qual pergunta ela
 * responde. Era esse o defeito do Início do administrador, onde três
 * indicadores se contradiziam entre si e contradiziam as telas de destino.
 *
 * Por isso o ponto vive DENTRO do componente (na classe .assinatura, via
 * ::after) e não numa lembrança de quem edita: em três meses haveria ponto
 * dourado em toda seção.
 */
export function Assinatura({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('assinatura', className)}>{children}</p>
}

/**
 * O par assinatura + número herói. A dobra de toda tela.
 *
 * É o bloco mais presente da página: mesmo papel das outras seções, mas com
 * respiro maior — a hierarquia vem do tamanho do número, não de uma cor de
 * fundo diferente nem de uma borda de acento.
 *
 * `contexto` é a única frase que acompanha o herói, e ela existe para dizer
 * o que o número NÃO é. "Devido agora" sem a frase "previsão não entra nesta
 * conta" é o mesmo número que estava errado antes.
 */
export function Heroi({
  rotulo,
  children,
  contexto,
  acao,
}: {
  rotulo: string
  children: ReactNode
  contexto?: ReactNode
  acao?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface px-4 py-5 shadow-card sm:px-6 sm:py-6">
      <Assinatura>{rotulo}</Assinatura>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">{children}</div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      {contexto && <p className="mt-3 max-w-[42rem] text-base text-content-muted">{contexto}</p>}
    </section>
  )
}
