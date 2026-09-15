import { Ban, CalendarClock, CircleAlert, CircleCheck, HandCoins, type LucideIcon } from 'lucide-react'
import { VOCABULARIO, fraseDeTempo, type Situacao } from '@/lib/situacao'
import { Chip } from './Chip'
import { TOM_DA_SITUACAO } from './tom'
import { cn } from '@/lib/utils'

/*
 * Um glifo por significado (7.7). As situações e as PALAVRAS são as de
 * src/lib/situacao.ts; aqui só se escolhe o desenho.
 *
 *   prevista   CalendarClock  info     tem data, ainda não é dinheiro
 *   liberada   HandCoins      atenção  é dinheiro, esperando alguém
 *   vencida    CircleAlert    risco    recebido e não repassado
 *   recebida   CircleCheck    sucesso  o dinheiro se moveu
 *   cancelada  Ban            neutro   fica no histórico
 */
export const ICONE_DA_SITUACAO: Record<Situacao, LucideIcon> = {
  prevista: CalendarClock,
  liberada: HandCoins,
  vencida: CircleAlert,
  recebida: CircleCheck,
  cancelada: Ban,
}

/** Chip de situação: tom, ícone e palavra saem dos mapas únicos. */
export function ChipSituacao({
  situacao,
  perfil = 'admin',
  className,
}: {
  situacao: Situacao
  /** O corretor lê as palavras dele (`palavraCorretor`). */
  perfil?: 'admin' | 'corretor'
  className?: string
}) {
  const v = VOCABULARIO[situacao]
  const palavra = perfil === 'corretor' ? v.palavraCorretor : v.palavra
  return (
    <Chip
      tom={TOM_DA_SITUACAO[situacao]}
      icone={ICONE_DA_SITUACAO[situacao]}
      className={cn(situacao === 'cancelada' && 'line-through', className)}
    >
      {palavra}
    </Chip>
  )
}

/**
 * A frase de tempo: data nunca aparece sem verbo. É meta (texto, não pílula):
 * `texto-meta` em t-meta. A frase vem de fraseDeTempo().
 */
export function FraseDeTempo({
  situacao,
  prevista,
  liberada,
  recebida,
  className,
}: {
  situacao: Situacao
  prevista: string
  liberada?: string | null
  recebida?: string | null
  className?: string
}) {
  return (
    <span className={cn('font-label text-texto-meta text-t-meta', className)}>
      {fraseDeTempo(situacao, { prevista, liberada, recebida })}
    </span>
  )
}
