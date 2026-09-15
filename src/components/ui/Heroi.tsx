import type { ReactNode } from 'react'
import { ValorComOrigem } from './Valor'
import { Demonstrativo, type DemonstrativoProps } from './Demonstrativo'
import { Rotulo } from './Rotulo'
import { cn } from '@/lib/utils'

/*
 * HERÓI (7.5): o número que decide a tela. Um por rota, no máximo.
 *
 * Duas variantes, e a prop é obrigatória (sem padrão implícito):
 *   'ouro'     dinheiro realizado, saldo real ou obrigação real.
 *              borda borda-ouro + número em brand-text (error-ink só se negativo real).
 *   'previsto' o número que decide é previsão. data-previsto, rótulo com a
 *              palavra previsto/prevista, borda fio-caixa, número em t1 no
 *              mesmo tamanho. NUNCA ouro.
 *
 * Proibido aqui: grão, sheen, halo, degradê, botão vermelho, segundo número
 * ≥ 22px. Os apoios são valor-destaque (17px).
 */
export interface ApoioHeroi {
  rotulo: string
  valor: number
  /** Todo número abre no que o compõe. */
  aoAbrir: () => void
  rotuloAcessivel: string
  /** Apoio que é previsão: t2, nunca ouro. */
  previsto?: boolean
}

interface HeroiBase {
  /** "Já ficou para a imobiliária". Na variante previsto, contém "previsto/prevista". */
  rotulo: string
  valor: number
  aoAbrir: () => void
  rotuloAcessivel: string
  /** Conta de 0 até o valor na 1ª exibição desta rota (8.3). */
  contar?: boolean
  /** O que o número NÃO é (ou, no previsto, de que depende). */
  frase: ReactNode
  /** ≤ 1 ação secundária não destrutiva, Button sm. No celular vai para o fim, largura total. */
  acao?: ReactNode
  /** Barra opcional (6px, cor lisa): passe um <Barra />. */
  barra?: ReactNode
  /** Até 3 apoios. Exclusivo com `demonstrativo`. */
  apoios?: ApoioHeroi[]
  /** A conta contratada no lugar dos apoios (Venda, 9.2). */
  demonstrativo?: DemonstrativoProps
  className?: string
}

export interface HeroiOuroProps extends HeroiBase {
  variante: 'ouro'
  /** Só o negativo real troca o ouro por error-ink (6.3). */
  estado?: 'negativo'
}

export interface HeroiPrevistoProps extends HeroiBase {
  variante: 'previsto'
  estado?: never
}

export type HeroiProps = HeroiOuroProps | HeroiPrevistoProps

export function Heroi(props: HeroiProps) {
  const { rotulo, valor, aoAbrir, rotuloAcessivel, contar, frase, acao, barra, apoios, demonstrativo, className } = props
  const previsto = props.variante === 'previsto'
  if (import.meta.env.DEV) {
    if (previsto && !/previst/i.test(rotulo))
      console.error(`[Heroi] variante "previsto" exige a palavra previsto/prevista no rótulo (7.5): "${rotulo}"`)
    if (apoios && demonstrativo) console.error('[Heroi] use apoios OU demonstrativo, não os dois (7.5).')
    if (apoios && apoios.length > 3) console.error('[Heroi] no máximo 3 apoios (7.5).')
  }
  const temLado = !!(apoios?.length || demonstrativo)
  return (
    <section
      data-caixa
      data-heroi
      data-previsto={previsto ? '' : undefined}
      className={cn(
        'grid gap-6 rounded-caixa border bg-surface p-recuo shadow-card lg:gap-12 lg:p-8',
        previsto ? 'border-fio-caixa' : 'border-borda-ouro',
        temLado && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-4">
          <Rotulo as="h2">{rotulo}</Rotulo>
          {acao && <div className="hidden shrink-0 sm:block">{acao}</div>}
        </div>
        <p className="mt-3 min-w-0">
          {props.variante === 'previsto' ? (
            <ValorComOrigem
              posto="heroi"
              variante="previsto"
              valor={valor}
              contar={contar}
              aoAbrir={aoAbrir}
              rotuloAcessivel={rotuloAcessivel}
            />
          ) : (
            <ValorComOrigem
              posto="heroi"
              variante="ouro"
              estado={props.estado}
              valor={valor}
              contar={contar}
              aoAbrir={aoAbrir}
              rotuloAcessivel={rotuloAcessivel}
            />
          )}
        </p>
        <p className="mt-2 max-w-[62ch] text-texto-corrido text-t3">{frase}</p>
        {barra && <div className="mt-6">{barra}</div>}
      </div>

      {apoios && apoios.length > 0 && <Apoios apoios={apoios} />}
      {demonstrativo && <ContaDoHeroi demonstrativo={demonstrativo} />}

      {acao && <div className="flex flex-col sm:hidden">{acao}</div>}
    </section>
  )
}

/*
 * Apoios: dt rótulo + dd valor-destaque. No celular empilham como linhas de
 * 44px com fio entre elas; de 640 a 1023 em três colunas; ≥1024 em uma coluna
 * ao lado do número.
 */
function Apoios({ apoios }: { apoios: ApoioHeroi[] }) {
  return (
    <dl
      data-celulas
      className="grid border-t border-fio-linha pt-2 sm:grid-cols-3 sm:gap-4 sm:pt-6 lg:grid-cols-1 lg:border-t-0 lg:pt-0"
    >
      {apoios.map((a, i) => (
        <div
          key={`${a.rotulo}-${i}`}
          className={cn(
            'flex min-h-11 items-center justify-between gap-4',
            'sm:min-h-0 sm:flex-col sm:items-start sm:justify-start sm:gap-1',
            i > 0 && 'border-t border-fio-linha sm:border-t-0',
          )}
        >
          <Rotulo as="dt">{a.rotulo}</Rotulo>
          <dd>
            {a.previsto ? (
              <ValorComOrigem
                posto="destaque"
                previsto
                valor={a.valor}
                aoAbrir={a.aoAbrir}
                rotuloAcessivel={a.rotuloAcessivel}
              />
            ) : (
              <ValorComOrigem posto="destaque" valor={a.valor} aoAbrir={a.aoAbrir} rotuloAcessivel={a.rotuloAcessivel} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* A conta no lado do herói. No celular vira <details> "Ver a conta (N linhas)" com área de 44px. */
function ContaDoHeroi({ demonstrativo }: { demonstrativo: DemonstrativoProps }) {
  const n = demonstrativo.linhas.length
  return (
    <div data-celulas className="border-t border-fio-linha pt-6 lg:border-t-0 lg:pt-0">
      <details className="group sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-controle font-medium text-t1">
          <span className="text-texto-titulo">{`Ver a conta (${n} ${n === 1 ? 'linha' : 'linhas'})`}</span>
          <span aria-hidden className="text-texto-meta text-t-meta group-open:hidden">
            abrir
          </span>
          <span aria-hidden className="hidden text-texto-meta text-t-meta group-open:inline">
            fechar
          </span>
        </summary>
        <div className="pt-2">
          <Demonstrativo {...demonstrativo} />
        </div>
      </details>
      <div className="hidden sm:block">
        <Demonstrativo {...demonstrativo} />
      </div>
    </div>
  )
}
