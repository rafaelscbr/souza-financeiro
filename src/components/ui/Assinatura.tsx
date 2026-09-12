import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tom = 'ouro' | 'verde' | 'critico' | 'neutro'

const tons: Record<Tom, string> = {
  ouro: 'rotulo-ouro',
  verde: 'rotulo-verde',
  critico: 'rotulo-critico',
  neutro: '',
}

/**
 * O RÓTULO com a barra.
 *
 * Um traço vertical curto e colorido antes do texto em caixa alta. É o gesto
 * mais reconhecível do CRM que a imobiliária já usa, e ele carrega significado:
 * a cor da barra diz o assunto da seção antes de a pessoa ler o título.
 *
 *   ouro    o que espera uma ação
 *   verde   o que já é fato, dinheiro que se moveu
 *   crítico o que quebrou
 *   neutro  contexto
 *
 * Substituiu a regra anterior de "um disco de ouro por tela". Aquela regra
 * nasceu de uma leitura correta do logotipo (o ouro é 0,15% da tinta) e de uma
 * leitura errada da casa: o produto da Souza é escuro e usa ouro à vontade.
 */
export function Rotulo({
  children,
  tom = 'ouro',
  className,
}: {
  children: ReactNode
  tom?: Tom
  className?: string
}) {
  return <p className={cn('rotulo', tons[tom], className)}>{children}</p>
}

/** Mantido para o lockup e o login: a slab do descritor, com o ponto de ouro. */
export function Assinatura({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('assinatura', className)}>{children}</p>
}

/**
 * A DOBRA. Rótulo com barra, o número que responde a tela, e o contexto.
 *
 * É o bloco mais presente da página: superfície com gradiente, realce de 1px
 * no topo e um brilho de ouro no canto superior direito — o mesmo tratamento
 * do card de meta do CRM. A hierarquia vem do tamanho do número.
 *
 * `contexto` é a única frase que acompanha o herói, e existe para dizer o que
 * o número NÃO é. "Devido agora" sem a frase "previsão não entra nesta conta"
 * é o mesmo número que estava errado antes.
 *
 * `apoio` é a linha logo abaixo do número, onde cabem o valor de apoio e o
 * chip de situação — é ali que o CRM põe "R$ 825k realizado · 83% DA META".
 */
export function Heroi({
  rotulo,
  tom = 'ouro',
  children,
  apoio,
  contexto,
  acao,
  rodape,
}: {
  rotulo: string
  tom?: Tom
  children: ReactNode
  apoio?: ReactNode
  contexto?: ReactNode
  acao?: ReactNode
  rodape?: ReactNode
}) {
  return (
    <section className="superficie relative overflow-hidden rounded-3xl border border-line">
      <span className="brilho-ouro absolute inset-0" aria-hidden />
      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <Rotulo tom={tom}>{rotulo}</Rotulo>
          {acao && <div className="shrink-0">{acao}</div>}
        </div>

        <div className="mt-3 min-w-0">{children}</div>

        {apoio && <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">{apoio}</div>}

        {contexto && (
          <p className="mt-3 max-w-[42rem] text-base text-content-muted">{contexto}</p>
        )}
      </div>

      {rodape && (
        <div className="relative border-t border-line px-5 py-4 sm:px-6">{rodape}</div>
      )}
    </section>
  )
}
