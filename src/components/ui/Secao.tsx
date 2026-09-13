import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { type Tom } from './Assinatura'
import { Painel, PainelTitulo, SuperficieContext } from './Painel'
import { SecaoTitulo } from './SecaoTitulo'
import { normalizarTom } from './tom'
import { cn } from '@/lib/utils'

/**
 * A SEÇÃO — um Painel com título de filete + ícone (seção 6).
 *
 * "Toda seção tem título com filete + ícone": o filete na cor do tom diz o
 * assunto, o ícone dá memória de lugar. O tom padrão é neutro, porque o ouro
 * da tela já está no herói.
 *
 * `variante="simples"` é para uso DENTRO de uma folha ou formulário, onde um
 * card sobre um card só acrescenta moldura: fica o título, some a caixa.
 *
 * O corpo avisa a Lista, por contexto, que ela está dentro de um painel com
 * padding: as linhas vazam até a borda e não desenham superfície própria.
 */
export function Secao({
  titulo,
  tom = 'neutro',
  icone,
  acao,
  /** Subtotal em DUAS parcelas, nunca uma. Ver `SubtotalDuplo`. */
  subtotal,
  children,
  className,
  variante = 'bloco',
}: {
  titulo?: string
  tom?: Tom
  icone?: LucideIcon
  acao?: ReactNode
  subtotal?: ReactNode
  children: ReactNode
  className?: string
  variante?: 'bloco' | 'simples'
}) {
  const temCabecalho = Boolean(titulo || acao || subtotal)
  const t = normalizarTom(tom)

  if (variante === 'simples') {
    return (
      <section className={cn('mt-7 first:mt-0', className)}>
        {temCabecalho && (
          <header className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {titulo ? (
              <SecaoTitulo titulo={titulo} icone={icone} tom={t} descricao={subtotal} />
            ) : (
              subtotal
            )}
            {acao && <div className="shrink-0">{acao}</div>}
          </header>
        )}
        <SuperficieContext.Provider value="plano">{children}</SuperficieContext.Provider>
      </section>
    )
  }

  return (
    <Painel className={cn('mt-4 first:mt-0', className)}>
      {temCabecalho && <PainelTitulo titulo={titulo} icone={icone} tom={t} descricao={subtotal} extra={acao} />}
      <SuperficieContext.Provider value="sangria">
        <div className={cn('px-4 pb-3 sm:px-5', !temCabecalho && 'pt-3')}>{children}</div>
      </SuperficieContext.Provider>
    </Painel>
  )
}

/**
 * O subtotal de grupo, SEMPRE em duas parcelas.
 *
 * Um total único somaria o que a imobiliária já tem com o que ela espera, que
 * é precisamente o erro que fazia o Início contar previsão como dívida. O
 * previsto fica sem cor tônica e sem peso: é espera, não dinheiro.
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
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] normal-case tracking-normal text-t3">
      <span>{rotuloAgora}</span>
      <span className="font-semibold text-t1 tabular-nums">{agora}</span>
      <span aria-hidden className="text-t5">
        ·
      </span>
      <span>previsto</span>
      <span className="tabular-nums">{previsto}</span>
    </p>
  )
}
