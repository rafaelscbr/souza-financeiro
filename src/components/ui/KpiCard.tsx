import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Kpi } from './Kpi'
import { Valor } from './Valor'
import { type Tom } from './tom'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * DEPRECADO — apagar na limpeza final. Use `Kpi` (7.4).
 *
 * Mantido para admin/pages/Vendas até a Fase 6. Agora só traduz para o `Kpi`:
 * caixa com `fio-caixa` e `p-recuo`, sem contagem (8.4). O estado continua
 * vindo da tela: 'sucesso' vira `recebido`, 'risco' vira `vencido`; zero nunca
 * fica em risco (o `Valor` já pinta zero em t-meta).
 */

type Formato = 'moeda' | 'numero' | 'percentual'

function texto(valor: number, formato: Formato): string | undefined {
  if (formato === 'moeda') return undefined
  if (formato === 'percentual') return formatPercent(valor)
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** DEPRECADO — apagar na limpeza final. Use `Valor`. `contar` é ignorado: só o herói conta (8.3). */
export function Numero({
  valor,
  formato = 'moeda',
  tamanho = 'md',
  className,
}: {
  valor: number
  formato?: Formato
  tamanho?: 'sm' | 'md' | 'lg'
  contar?: boolean
  className?: string
}) {
  if (formato === 'moeda') {
    return <Valor posto={tamanho === 'sm' ? 'destaque' : 'kpi'} valor={valor} className={className} />
  }
  return (
    <span className={`${cn('num whitespace-nowrap font-heading text-t1', className)} text-numero-kpi-m`}>
      {texto(valor, formato)}
    </span>
  )
}

export function KpiCard({
  rotulo,
  valor,
  formato = 'moeda',
  icone,
  tom = 'neutro',
  nota,
  estado = 'normal',
  para,
  aoClicar,
}: {
  rotulo: string
  valor: number
  formato?: Formato
  icone: LucideIcon
  tom?: Tom
  nota?: ReactNode
  estado?: 'normal' | 'sucesso' | 'risco'
  para?: string
  aoClicar?: () => void
}) {
  const efetivo = estado === 'risco' && valor === 0 ? 'normal' : estado
  return (
    <Kpi
      rotulo={rotulo}
      valor={valor}
      texto={texto(valor, formato)}
      icone={icone}
      tom={tom}
      nota={nota}
      estado={efetivo === 'sucesso' ? 'recebido' : efetivo === 'risco' ? 'vencido' : undefined}
      para={para}
      aoClicar={aoClicar}
    />
  )
}
