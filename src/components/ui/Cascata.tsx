import { type ReactNode } from 'react'
import { Valor } from './Valor'
import { cn } from '@/lib/utils'

/*
 * A CASCATA — a conta da comissão, como documento.
 *
 * Comissão é uma conta que precisa ser mostrada INTEIRA para ser aceita. A
 * conta é única em src/lib/sales.ts, e a apresentação também é, aqui.
 *
 * A ordem é fixa e é a que já estava correta no banco (migração 009):
 *   parcela da comissão
 *   (−) ISS retido na fonte
 *   (−) Imposto (Simples 6%)
 *   = base
 *   corretor: base × %
 *   (−) desconto combinado
 *   = fica para a imobiliária
 *
 * Duas densidades, que mudam só o espaçamento — nunca o alinhamento, nunca o
 * peso, nunca a ordem.
 *
 * As linhas são COMPOSTAS por quem usa, e isso é proposital: o corretor vê a
 * parcela e a base do cálculo dele, e não pode ver o líquido da imobiliária.
 * Uma prop `perfil` que escondesse a linha seria uma permissão dependendo de
 * um booleano de interface; compor só as linhas permitidas é mais difícil de
 * errar.
 */
export function Cascata({
  densidade = 'completa',
  children,
  className,
}: {
  densidade?: 'completa' | 'compacta'
  children: ReactNode
  className?: string
}) {
  return (
    <dl className={cn(densidade === 'completa' ? 'space-y-2' : 'space-y-1', className)}>{children}</dl>
  )
}

/** Uma linha da conta. `subtracao` escreve o "(−)" e o nome inteiro do tributo. */
export function LinhaCascata({
  rotulo,
  valor,
  subtracao,
  detalhe,
}: {
  rotulo: string
  valor: number
  subtracao?: boolean
  /** "base × 65%", "3% sobre a parcela" — a conta, escrita. */
  detalhe?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="min-w-0 text-sm text-t3">
        {subtracao && (
          // O "(−)" é informação da conta, então fica em t4 e não no t5 decorativo.
          <span className="mr-1 text-t4" aria-label="menos">
            (&#8722;)
          </span>
        )}
        {rotulo}
        {detalhe && <span className="ml-1.5 text-xs text-t4">{detalhe}</span>}
      </dt>
      <dd className="shrink-0">
        <Valor valor={subtracao ? -Math.abs(valor) : valor} posto="fato" />
      </dd>
    </div>
  )
}

/**
 * O total. Fio forte acima (`line-strong`), porque ele carrega leitura: separa
 * a conta do resultado. O rótulo sobe para o corpo de título e o valor para o
 * degrau de comparação.
 */
export function TotalCascata({
  rotulo,
  valor,
  tinta,
  nota,
}: {
  rotulo: string
  valor: number
  tinta?: string
  nota?: string
}) {
  return (
    <div className="mt-1 border-t border-line-strong pt-2">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm font-semibold text-t1">{rotulo}</dt>
        <dd className="shrink-0">
          <Valor valor={valor} posto="linha" tinta={tinta} />
        </dd>
      </div>
      {nota && <p className="mt-1 text-xs text-t4">{nota}</p>}
    </div>
  )
}
