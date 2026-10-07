import { AlarmClock, FileCheck2, Flag, Hourglass, type LucideIcon } from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import type { Tom } from '@/components/ui/tom'
import {
  ETAPA_DO_CORRETOR,
  etapaDoCorretor,
  fraseDaEtapaDoCorretor,
  type EtapaDoCorretor,
  type MarcosDaParcela,
} from '@/lib/etapas'
import { VOCABULARIO, fraseDeTempo, type Situacao } from '@/lib/situacao'
import { toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * Chip e frase de uma parcela na tela do corretor.
 *
 * Enquanto a imobiliária não recebeu (situação "prevista"), "Prevista" sozinho
 * escondia o que importa: de quem depende agora. Aqui a prevista se abre nas
 * etapas de src/lib/etapas.ts — aguardando o cliente, gatilho atingido, nota
 * emitida, em atraso. Nas outras situações, nada muda.
 *
 * As três primeiras ficam no tom de previsão (`info`): ainda não é dinheiro.
 * "Em atraso" é âmbar, como no resto do sistema — cobrança, não dívida.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const ICONE_DA_ETAPA: Record<EtapaDoCorretor, LucideIcon> = {
  aguardando_cliente: Hourglass,
  gatilho_atingido: Flag,
  nota_emitida: FileCheck2,
  em_atraso: AlarmClock,
}

// eslint-disable-next-line react-refresh/only-export-components
export const TOM_DA_ETAPA: Record<EtapaDoCorretor, Tom> = {
  aguardando_cliente: 'info',
  gatilho_atingido: 'info',
  nota_emitida: 'info',
  em_atraso: 'atencao',
}

type Parcela = MarcosDaParcela & { received_date?: string | null; paid_date?: string | null }

export function ChipDaParcela({ p, s, className }: { p: MarcosDaParcela; s: Situacao; className?: string }) {
  if (s !== 'prevista') return <ChipSituacao situacao={s} perfil="corretor" className={className} />
  const etapa = etapaDoCorretor(p)
  return (
    <Chip tom={TOM_DA_ETAPA[etapa]} icone={ICONE_DA_ETAPA[etapa]} className={className}>
      {ETAPA_DO_CORRETOR[etapa].palavra}
    </Chip>
  )
}

/** A frase com verbo e tempo; na prevista, a da etapa. */
// eslint-disable-next-line react-refresh/only-export-components
export function fraseDaParcela(p: Parcela, s: Situacao, hoje = toDateOnly(new Date())): string {
  if (s === 'prevista') return fraseDaEtapaDoCorretor(p, hoje)
  return fraseDeTempo(s, { prevista: p.expected_date, liberada: p.received_date, recebida: p.paid_date }, hoje)
}

export function FraseDaParcela({ p, s, className }: { p: Parcela; s: Situacao; className?: string }) {
  if (s !== 'prevista')
    return (
      <FraseDeTempo
        situacao={s}
        prevista={p.expected_date}
        liberada={p.received_date}
        recebida={p.paid_date}
        className={className}
      />
    )
  return <span className={cn('font-label text-texto-meta text-t-meta', className)}>{fraseDaEtapaDoCorretor(p)}</span>
}

/** Por que a parcela está onde está, em uma frase. */
// eslint-disable-next-line react-refresh/only-export-components
export function explicaDaParcela(p: MarcosDaParcela, s: Situacao): string {
  return s === 'prevista' ? ETAPA_DO_CORRETOR[etapaDoCorretor(p)].explica : VOCABULARIO[s].explica
}
