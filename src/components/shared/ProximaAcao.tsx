import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, type LucideIcon } from 'lucide-react'
import { IconeTom } from '@/components/ui/IconeTom'
import { Rotulo } from '@/components/ui/Rotulo'
import { TOM, type Tom } from '@/components/ui/tom'
import { cn } from '@/lib/utils'

/*
 * PRÓXIMA MELHOR AÇÃO (seção 10), logo abaixo do herói.
 *
 * A tela sugere a ação em vez de só medir. Um bloco, uma sugestão principal
 * com título, o porquê escrito como a regra da casa e UM botão que executa.
 * As outras sugestões ficam abaixo em chips, em ordem de urgência, que é a
 * ordem em que a tela as passa: este componente não reordena nada, porque
 * quem sabe o que é mais urgente é quem conhece o dado.
 *
 * Só sugere o que o sistema observou. Quem monta a sugestão escreve o número
 * real no porquê; aqui não se inventa texto.
 *
 * Se a principal é risco, o bloco ganha borda de erro e o halo que pulsa três
 * vezes e para (`atencao-pulse`): incomoda o suficiente para ser visto, e não
 * vira sirene. Sem pendência, nunca silêncio: "Tudo em dia" com uma sugestão.
 */

interface Acao {
  rotulo: string
  aoClicar?: () => void
  para?: string
}

interface Principal {
  tom: Tom
  icone: LucideIcon
  titulo: string
  porque: string
  acao: Acao
}

interface Outra {
  id: string
  rotulo: string
  porque: string
  tom: Tom
  aoClicar?: () => void
  para?: string
}

/** Link quando há destino (abre em outra aba, entra no histórico); botão quando executa. */
function Acionador({
  para,
  aoClicar,
  className,
  title,
  children,
}: {
  para?: string
  aoClicar?: () => void
  className: string
  title?: string
  children: ReactNode
}) {
  if (para) {
    return (
      <Link to={para} onClick={aoClicar} className={className} title={title}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={aoClicar} className={className} title={title}>
      {children}
    </button>
  )
}

export function ProximaAcao({
  principal,
  outras,
  tudoEmDia,
}: {
  principal?: Principal
  outras?: Outra[]
  tudoEmDia?: { titulo: string; sugestao: string }
}) {
  const risco = principal?.tom === 'risco'
  const calma = tudoEmDia ?? { titulo: 'Tudo em dia', sugestao: 'Nenhuma pendência observada agora.' }

  return (
    <section
      aria-label="Próxima melhor ação"
      className={cn(
        'relative rounded-[16px] border p-4 shadow-card surface-premium sm:p-5',
        risco ? 'atencao-pulse border-error-line' : 'border-line',
      )}
    >
      <Rotulo as="h2">Próxima melhor ação</Rotulo>

      {principal ? (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <IconeTom icone={principal.icone} tom={principal.tom} tamanho="lg" />
            <div className="min-w-0">
              <h3 className="font-heading text-[17px] font-extrabold leading-snug tracking-[-0.015em] text-t1">
                {principal.titulo}
              </h3>
              <p className="mt-1 max-w-[62ch] text-[13px] text-t3">{principal.porque}</p>
            </div>
          </div>
          <Acionador
            para={principal.acao.para}
            aoClicar={principal.acao.aoClicar}
            className={cn(
              'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-4',
              'grad-brand font-heading text-[13px] font-bold',
              'transition-transform duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/40',
            )}
          >
            {principal.acao.rotulo}
            <ArrowRight size={15} strokeWidth={1.6} aria-hidden />
          </Acionador>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3.5">
          <IconeTom icone={CircleCheck} tom="sucesso" tamanho="lg" />
          <div className="min-w-0">
            <h3 className="font-heading text-[17px] font-extrabold leading-snug tracking-[-0.015em] text-t1">
              {calma.titulo}
            </h3>
            <p className="mt-1 max-w-[62ch] text-[13px] text-t3">{calma.sugestao}</p>
          </div>
        </div>
      )}

      {outras && outras.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3" aria-label="Outras sugestões">
          {outras.map((o) => (
            <li key={o.id}>
              <Acionador
                para={o.para}
                aoClicar={o.aoClicar}
                title={o.porque}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold',
                  'transition-colors duration-150 hover:border-line-strong active:scale-[0.98]',
                  TOM[o.tom].fundo,
                  TOM[o.tom].borda,
                  TOM[o.tom].texto,
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TOM[o.tom].ponto)} aria-hidden />
                {o.rotulo}
                {/* O porquê fica no `title` para o mouse; o leitor de tela ouve junto. */}
                <span className="sr-only">. {o.porque}</span>
              </Acionador>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
